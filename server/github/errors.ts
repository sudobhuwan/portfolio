/*
 * A single, closed set of failure modes for the GitHub integration.
 *
 * Every error the service can produce carries a `code` that the browser can
 * switch on to render a specific, honest message, and an HTTP `status` for the
 * transport. Nothing else about the upstream failure crosses the wire — GitHub
 * error payloads can echo back request details, so they stay on the server.
 */

export type GitHubErrorCode =
  | "missing_config"
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "user_not_found"
  | "rate_limited"
  | "upstream_unavailable"
  | "upstream_error"
  | "malformed_response";

const STATUS_BY_CODE: Record<GitHubErrorCode, number> = {
  missing_config: 503,
  invalid_request: 400,
  unauthorized: 502,
  forbidden: 502,
  user_not_found: 404,
  rate_limited: 429,
  upstream_unavailable: 503,
  upstream_error: 502,
  malformed_response: 502,
};

/* Safe to show a visitor. Deliberately vague about server-side misconfiguration
   so a broken deploy never advertises what is missing. */
const PUBLIC_MESSAGE_BY_CODE: Record<GitHubErrorCode, string> = {
  missing_config: "GitHub activity is not configured yet.",
  invalid_request: "That GitHub request wasn't valid.",
  unauthorized: "GitHub activity is temporarily unavailable.",
  forbidden: "GitHub activity is temporarily unavailable.",
  user_not_found: "That GitHub account could not be found.",
  rate_limited: "GitHub's rate limit was reached. Activity will return shortly.",
  upstream_unavailable: "GitHub is unreachable right now.",
  upstream_error: "GitHub activity is temporarily unavailable.",
  malformed_response: "GitHub returned data we couldn't read.",
};

export class GitHubServiceError extends Error {
  readonly code: GitHubErrorCode;
  readonly status: number;
  readonly publicMessage: string;
  /** Seconds until the caller should retry, when upstream tells us. */
  readonly retryAfterSeconds?: number;

  constructor(
    code: GitHubErrorCode,
    /** Developer-facing detail. Logged on the server, never serialised. */
    detail?: string,
    options?: { retryAfterSeconds?: number; cause?: unknown },
  ) {
    super(detail ?? code, { cause: options?.cause });
    this.name = "GitHubServiceError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.publicMessage = PUBLIC_MESSAGE_BY_CODE[code];
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

export function toServiceError(error: unknown): GitHubServiceError {
  if (error instanceof GitHubServiceError) return error;
  // `fetch` rejects on DNS/TLS/socket failures — GitHub is simply not reachable.
  return new GitHubServiceError("upstream_unavailable", "Unexpected failure reaching GitHub", {
    cause: error,
  });
}
