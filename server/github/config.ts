/*
 * Server-only configuration. GITHUB_TOKEN is read here and nowhere else in the
 * repository; it is never referenced from `src/`, so it cannot reach the client
 * bundle. Vite only inlines `VITE_`-prefixed variables, and these two are
 * deliberately unprefixed.
 */

// `.js` extension required for Node's native ESM loader in production —
// see api/_github-handler.ts.
import { GitHubServiceError } from "./errors.js";

export interface GitHubConfig {
  username: string;
  token: string;
}

/* https://github.com/join — 1-39 chars, alphanumeric or single hyphens. */
const USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

export function loadGitHubConfig(): GitHubConfig {
  const username = process.env.GITHUB_USERNAME?.trim();
  const token = process.env.GITHUB_TOKEN?.trim();

  const missing: string[] = [];
  if (!username) missing.push("GITHUB_USERNAME");
  if (!token) missing.push("GITHUB_TOKEN");
  if (missing.length > 0) {
    throw new GitHubServiceError("missing_config", `Missing env var(s): ${missing.join(", ")}`);
  }

  if (!USERNAME_PATTERN.test(username!)) {
    throw new GitHubServiceError("invalid_request", `GITHUB_USERNAME is not a valid GitHub login`);
  }

  return { username: username!, token: token! };
}
