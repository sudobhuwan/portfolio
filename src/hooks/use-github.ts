/*
 * React Query bindings for the GitHub endpoints.
 *
 * Staleness here mirrors the server's cache windows, so a visitor moving around
 * the page never triggers a second request, and switching years re-uses any
 * year already loaded. Requests only start once the section is in view.
 *
 * The repositories endpoint still exists server-side, but the section links out
 * to GitHub instead of listing repos, so nothing fetches it from the browser.
 */

import { useQuery } from "@tanstack/react-query";

import { fetchContributions, fetchProfile, GitHubRequestError } from "@/lib/github-client";

const THIRTY_MINUTES = 30 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

/** Retrying a bad token, a missing user or an exhausted quota just burns quota. */
const RETRYABLE: ReadonlySet<string> = new Set(["upstream_unavailable", "upstream_error"]);

function retry(failureCount: number, error: unknown): boolean {
  if (error instanceof GitHubRequestError && !RETRYABLE.has(error.code)) return false;
  return failureCount < 2;
}

export function useGitHubProfile(enabled: boolean) {
  return useQuery({
    queryKey: ["github", "profile"],
    queryFn: ({ signal }) => fetchProfile(signal),
    enabled,
    staleTime: ONE_HOUR,
    gcTime: ONE_HOUR,
    retry,
  });
}

export function useGitHubContributions(year: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ["github", "contributions", year ?? "current"],
    queryFn: ({ signal }) => fetchContributions(year, signal),
    enabled,
    staleTime: THIRTY_MINUTES,
    gcTime: ONE_HOUR,
    // Keeps the previous year's grid on screen while the next one loads,
    // so switching years doesn't collapse the layout.
    placeholderData: (previous) => previous,
    retry,
  });
}
