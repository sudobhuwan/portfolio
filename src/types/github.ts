/*
 * The contract between the server-side GitHub service and the browser.
 *
 * These are normalised, minimal shapes — only the fields the UI actually
 * renders. GitHub's raw GraphQL payloads are validated and reduced to this on
 * the server so nothing unnecessary (node IDs, owner objects, viewer
 * permissions) is ever sent to the client.
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

export interface GitHubApiError {
  error: { code: GitHubErrorCode; message: string; retryAfterSeconds?: number };
}

export interface GitHubProfile {
  login: string;
  name: string | null;
  bio: string | null;
  avatarUrl: string;
  url: string;
  company: string | null;
  location: string | null;
  followers: number;
  following: number;
  publicRepos: number;
  createdAt: string;
}

/** GitHub's own quartile bucketing, passed through rather than re-derived. */
export type ContributionLevel = 0 | 1 | 2 | 3 | 4;

export interface ContributionDay {
  /** ISO calendar date, `YYYY-MM-DD`. */
  date: string;
  count: number;
  level: ContributionLevel;
  /** 0 = Sunday … 6 = Saturday, as GitHub reports it. */
  weekday: number;
  /** False for the padding days GitHub includes to square off the first and
   *  last weeks. They are real dates with real counts, just outside the year. */
  inSelectedYear: boolean;
}

export interface ContributionWeek {
  /** ISO date of the first day GitHub returned for this column. */
  firstDay: string;
  days: ContributionDay[];
}

/**
 * Year-level totals. GitHub exposes contribution *types* only in aggregate —
 * there is no per-day breakdown in the API — so these describe the whole year.
 */
export interface ContributionBreakdown {
  commits: number;
  issues: number;
  pullRequests: number;
  reviews: number;
  repositories: number;
  /** Contributions in private repos, which GitHub counts but does not detail. */
  restricted: number;
}

export interface GitHubContributions {
  year: number;
  /** Years GitHub has contribution data for, newest first. */
  availableYears: number[];
  total: number;
  weeks: ContributionWeek[];
  breakdown: ContributionBreakdown;
  /** Longest run of consecutive days with at least one contribution,
   *  computed from the returned days inside the year. */
  longestStreak: number;
  busiestDay: { date: string; count: number } | null;
  /** True when the year is still in progress. */
  isPartialYear: boolean;
}

export interface RepositoryLanguage {
  name: string;
  color: string | null;
  /** Share of the repository's analysed bytes, 0-1. */
  share: number;
}

export interface GitHubRepository {
  name: string;
  description: string | null;
  url: string;
  homepageUrl: string | null;
  stars: number;
  forks: number;
  topics: string[];
  primaryLanguage: { name: string; color: string | null } | null;
  languages: RepositoryLanguage[];
  pushedAt: string;
  isArchived: boolean;
  isPrivate: boolean;
  isFork: boolean;
  /** True when the repository is pinned on the GitHub profile. */
  isPinned: boolean;
}

export interface GitHubRepositories {
  repositories: GitHubRepository[];
  /** Total public, non-fork repositories owned by the account. */
  totalCount: number;
  totals: { stars: number; forks: number };
}
