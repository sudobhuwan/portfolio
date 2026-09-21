/*
 * Browser-side access to /api/github/*.
 *
 * No GitHub credentials exist on this side of the wire — this talks only to
 * the portfolio's own origin, and the server decides what is safe to return.
 */

import type {
  GitHubApiError,
  GitHubContributions,
  GitHubErrorCode,
  GitHubProfile,
} from "@/types/github";

export class GitHubRequestError extends Error {
  readonly code: GitHubErrorCode;
  readonly retryAfterSeconds?: number;

  constructor(code: GitHubErrorCode, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "GitHubRequestError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/* The exact set our own API can emit (see src/types/github.ts). A platform-level
   failure — Vercel's own error page, a proxy, a CDN — can return JSON shaped
   exactly like ours (Vercel's happens to use the same {error:{code,message}}
   envelope) without being ours, so `code` is checked against this list rather
   than trusted on shape alone. Surfacing a stranger's message as if it were
   ours is more than a cosmetic bug: it renders arbitrary upstream text inside
   the page verbatim. */
const KNOWN_ERROR_CODES = new Set<GitHubErrorCode>([
  "missing_config",
  "invalid_request",
  "unauthorized",
  "forbidden",
  "user_not_found",
  "rate_limited",
  "upstream_unavailable",
  "upstream_error",
  "malformed_response",
]);

function isOurApiError(payload: unknown): payload is GitHubApiError {
  const error = (payload as { error?: unknown } | null)?.error;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    typeof (error as { message: unknown }).message === "string" &&
    KNOWN_ERROR_CODES.has((error as { code: string }).code as GitHubErrorCode)
  );
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { signal, headers: { Accept: "application/json" } });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new GitHubRequestError("upstream_unavailable", "Couldn't reach the server.");
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isOurApiError(payload)) {
      const { code, message, retryAfterSeconds } = payload.error;
      throw new GitHubRequestError(code, message, retryAfterSeconds);
    }
    // Some other failure shaped this response — a Vercel platform error, a
    // proxy, an HTML error page — so fall back to our own generic wording
    // rather than repeat text we can't vouch for.
    throw new GitHubRequestError("upstream_error", "GitHub activity is temporarily unavailable.");
  }

  if (payload === null) {
    throw new GitHubRequestError("malformed_response", "GitHub returned data we couldn't read.");
  }

  return payload as T;
}

export const fetchProfile = (signal?: AbortSignal) =>
  getJson<GitHubProfile>("/api/github/profile", signal);

export const fetchContributions = (year: number | null, signal?: AbortSignal) =>
  getJson<GitHubContributions>(
    year === null ? "/api/github/contributions" : `/api/github/contributions?year=${year}`,
    signal,
  );
