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
    const apiError = (payload as GitHubApiError | null)?.error;
    throw new GitHubRequestError(
      apiError?.code ?? "upstream_error",
      apiError?.message ?? "GitHub activity is temporarily unavailable.",
      apiError?.retryAfterSeconds,
    );
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
