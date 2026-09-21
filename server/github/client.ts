/*
 * Minimal GraphQL transport for api.github.com.
 *
 * GitHub signals failure in three different ways and this is the one place that
 * knows about all of them: HTTP status, a `errors[].type` discriminator inside
 * a 200 response, and the `x-ratelimit-*` headers. Everything downstream just
 * sees a GitHubServiceError.
 */

// `.js` extension required for Node's native ESM loader in production —
// see api/_github-handler.ts.
import { GitHubServiceError } from "./errors.js";
import type { GitHubConfig } from "./config";

const ENDPOINT = "https://api.github.com/graphql";
const REQUEST_TIMEOUT_MS = 10_000;

export interface RateLimitSnapshot {
  limit: number;
  remaining: number;
  resetAt: string;
}

interface GraphQLEnvelope<T> {
  data?: T;
  errors?: Array<{ type?: string; message?: string }>;
}

function secondsUntil(epochSeconds: number): number | undefined {
  // A missing header parses to 0; that is "unknown", not "retry immediately".
  if (!Number.isFinite(epochSeconds) || epochSeconds <= 0) return undefined;
  return Math.max(0, Math.round(epochSeconds - Date.now() / 1000));
}

export async function graphqlRequest<T>(
  config: GitHubConfig,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `bearer ${config.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        // GitHub asks every client to identify itself.
        "User-Agent": `${config.username}-portfolio`,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    throw new GitHubServiceError(
      "upstream_unavailable",
      timedOut ? "GitHub request timed out" : "Could not reach GitHub",
      { cause: error },
    );
  }

  const remaining = Number(response.headers.get("x-ratelimit-remaining"));
  const retryAfterHeader = Number(response.headers.get("retry-after"));
  const retryAfterSeconds =
    Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
      ? retryAfterHeader
      : secondsUntil(Number(response.headers.get("x-ratelimit-reset")));

  if (response.status === 401) {
    throw new GitHubServiceError("unauthorized", "GITHUB_TOKEN was rejected by GitHub");
  }
  if (response.status === 403 || response.status === 429) {
    // A 403 with no quota left is a rate limit; otherwise the token lacks scope.
    const isRateLimit = remaining === 0 || response.status === 429;
    throw new GitHubServiceError(
      isRateLimit ? "rate_limited" : "forbidden",
      isRateLimit ? "GitHub rate limit exhausted" : "GITHUB_TOKEN lacks the required scope",
      { retryAfterSeconds },
    );
  }
  if (response.status >= 500) {
    throw new GitHubServiceError("upstream_unavailable", `GitHub responded ${response.status}`);
  }
  if (!response.ok) {
    throw new GitHubServiceError("upstream_error", `GitHub responded ${response.status}`);
  }

  let envelope: GraphQLEnvelope<T>;
  try {
    envelope = (await response.json()) as GraphQLEnvelope<T>;
  } catch (error) {
    throw new GitHubServiceError("malformed_response", "GitHub response was not JSON", {
      cause: error,
    });
  }

  if (envelope.errors?.length) {
    const types = new Set(envelope.errors.map((e) => e.type));
    const detail = envelope.errors.map((e) => e.message ?? e.type).join("; ");

    if (types.has("RATE_LIMITED")) {
      throw new GitHubServiceError("rate_limited", detail, { retryAfterSeconds });
    }
    if (types.has("NOT_FOUND")) {
      throw new GitHubServiceError("user_not_found", detail);
    }
    if (types.has("FORBIDDEN")) {
      throw new GitHubServiceError("forbidden", detail);
    }
    throw new GitHubServiceError("upstream_error", detail);
  }

  if (!envelope.data) {
    throw new GitHubServiceError("malformed_response", "GitHub returned no data");
  }

  return envelope.data;
}
