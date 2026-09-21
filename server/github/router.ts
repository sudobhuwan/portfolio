/*
 * A transport-free router.
 *
 * It takes a route name plus query params and returns a plain
 * {status, headers, body} result. The Vite dev middleware and the serverless
 * functions are both ~15-line adapters over this, which is what keeps `npm run
 * dev` and production behaving identically.
 */

import type { GitHubApiError } from "../../src/types/github";
// `.js` extensions are required for Node's native ESM loader in production
// (see api/_github-handler.ts for why); type-only imports above are erased at
// compile time and never hit that loader, so they're left extensionless.
import { GitHubServiceError, toServiceError } from "./errors.js";
import { getContributions, getProfile, getRepositories, resolveYear } from "./service.js";

export type GitHubRoute = "profile" | "contributions" | "repositories";

export interface ApiResult {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export const GITHUB_ROUTES: readonly GitHubRoute[] = ["profile", "contributions", "repositories"];

export function isGitHubRoute(value: string): value is GitHubRoute {
  return (GITHUB_ROUTES as readonly string[]).includes(value);
}

/**
 * Let a shared CDN serve the section while a refresh happens in the
 * background, so a visitor never waits on GitHub. `s-maxage` is shorter than
 * the in-process TTL on purpose: the memory cache absorbs the difference.
 */
function cacheHeaders(maxAgeSeconds: number, stale: boolean): Record<string, string> {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": `public, max-age=0, s-maxage=${maxAgeSeconds}, stale-while-revalidate=86400`,
    // Signals that the payload is a last-known-good value, not a fresh read.
    ...(stale ? { "X-GitHub-Data-Stale": "true" } : {}),
  };
}

function errorResult(error: unknown): ApiResult {
  const serviceError: GitHubServiceError = toServiceError(error);

  // Full detail to the server log, never to the client.
  console.error(`[github] ${serviceError.code}: ${serviceError.message}`, serviceError.cause ?? "");

  const body: GitHubApiError = {
    error: {
      code: serviceError.code,
      message: serviceError.publicMessage,
      ...(serviceError.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: serviceError.retryAfterSeconds }
        : {}),
    },
  };

  return {
    status: serviceError.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(serviceError.retryAfterSeconds !== undefined
        ? { "Retry-After": String(serviceError.retryAfterSeconds) }
        : {}),
    },
    body,
  };
}

export async function handleGitHubRequest(
  route: GitHubRoute,
  params: URLSearchParams,
): Promise<ApiResult> {
  try {
    switch (route) {
      case "profile": {
        const { value, stale } = await getProfile();
        return { status: 200, headers: cacheHeaders(1800, stale), body: value };
      }
      case "contributions": {
        const year = resolveYear(params.get("year"));
        const { value, stale } = await getContributions(year);
        const isCurrentYear = year === new Date().getUTCFullYear();
        return {
          status: 200,
          headers: cacheHeaders(isCurrentYear ? 900 : 86400, stale),
          body: value,
        };
      }
      case "repositories": {
        const { value, stale } = await getRepositories();
        return { status: 200, headers: cacheHeaders(900, stale), body: value };
      }
    }
  } catch (error) {
    return errorResult(error);
  }
}
