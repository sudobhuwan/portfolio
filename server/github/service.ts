/*
 * The GitHub service: fetch -> validate -> normalise -> cache.
 *
 * Nothing above this layer knows about GraphQL, and nothing below it knows
 * about HTTP. Each exported function returns a value ready to serialise.
 */

import type {
  GitHubContributions,
  GitHubProfile,
  GitHubRepositories,
} from "../../src/types/github";
// `.js` extensions required for Node's native ESM loader in production —
// see api/_github-handler.ts.
import { cached, type CachedResult } from "./cache.js";
import { graphqlRequest } from "./client.js";
import { loadGitHubConfig } from "./config.js";
import { GitHubServiceError } from "./errors.js";
import { normalizeContributions, normalizeProfile, normalizeRepositories } from "./normalize.js";
import { contributionsSchema, profileSchema, repositoriesSchema } from "./schemas.js";
import { CONTRIBUTIONS_QUERY, PROFILE_QUERY, REPOSITORIES_QUERY } from "./queries.js";

/* A portfolio's GitHub data changes on the order of hours, not seconds. */
const PROFILE_TTL_MS = 60 * 60 * 1000;
const REPOSITORIES_TTL_MS = 30 * 60 * 1000;
const CURRENT_YEAR_TTL_MS = 30 * 60 * 1000;
const PAST_YEAR_TTL_MS = 24 * 60 * 60 * 1000;

/** GitHub launched in 2008; nothing before that can have contributions. */
const EARLIEST_YEAR = 2008;

function parse<T>(
  schema: { safeParse: (input: unknown) => { success: boolean; data?: T } },
  raw: unknown,
): T {
  const result = schema.safeParse(raw);
  if (!result.success || result.data === undefined) {
    throw new GitHubServiceError("malformed_response", "GitHub response failed validation");
  }
  return result.data;
}

export async function getProfile(): Promise<CachedResult<GitHubProfile>> {
  const config = loadGitHubConfig();

  return cached(`profile:${config.username}`, PROFILE_TTL_MS, async () => {
    const raw = await graphqlRequest<unknown>(config, PROFILE_QUERY, { login: config.username });
    const parsed = parse(profileSchema, raw);
    if (!parsed.user) {
      throw new GitHubServiceError("user_not_found", `No such GitHub user: ${config.username}`);
    }
    return normalizeProfile(parsed.user);
  });
}

export function resolveYear(requested: string | null): number {
  const currentYear = new Date().getUTCFullYear();
  if (requested === null || requested === "") return currentYear;

  const year = Number(requested);
  if (!Number.isInteger(year) || year < EARLIEST_YEAR || year > currentYear) {
    throw new GitHubServiceError("invalid_request", `Unsupported year: ${requested}`);
  }
  return year;
}

export async function getContributions(year: number): Promise<CachedResult<GitHubContributions>> {
  const config = loadGitHubConfig();
  const currentYear = new Date().getUTCFullYear();
  const isCurrentYear = year === currentYear;

  // GitHub caps `contributionsCollection` at a one-year window, so a calendar
  // year fits exactly. For the year in progress we stop at now, which is what
  // makes the headline total match GitHub's own.
  const from = `${year}-01-01T00:00:00Z`;
  const to = isCurrentYear ? new Date().toISOString() : `${year}-12-31T23:59:59Z`;

  return cached(
    `contributions:${config.username}:${year}`,
    isCurrentYear ? CURRENT_YEAR_TTL_MS : PAST_YEAR_TTL_MS,
    async () => {
      const raw = await graphqlRequest<unknown>(config, CONTRIBUTIONS_QUERY, {
        login: config.username,
        from,
        to,
      });
      const parsed = parse(contributionsSchema, raw);
      if (!parsed.user) {
        throw new GitHubServiceError("user_not_found", `No such GitHub user: ${config.username}`);
      }
      return normalizeContributions(parsed.user, year);
    },
  );
}

export async function getRepositories(): Promise<CachedResult<GitHubRepositories>> {
  const config = loadGitHubConfig();

  return cached(`repositories:${config.username}`, REPOSITORIES_TTL_MS, async () => {
    const raw = await graphqlRequest<unknown>(config, REPOSITORIES_QUERY, {
      login: config.username,
    });
    const parsed = parse(repositoriesSchema, raw);
    if (!parsed.user) {
      throw new GitHubServiceError("user_not_found", `No such GitHub user: ${config.username}`);
    }
    return normalizeRepositories(parsed.user);
  });
}
