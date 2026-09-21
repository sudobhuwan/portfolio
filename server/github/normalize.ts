/*
 * Raw GitHub payloads -> the shapes in `src/types/github.ts`.
 *
 * Anything derived rather than reported by GitHub (streaks, language shares,
 * whether a day falls inside the requested year) is computed here, once, on the
 * server — so the browser renders numbers instead of calculating them.
 */

import type {
  ContributionBreakdown,
  ContributionDay,
  ContributionLevel,
  ContributionWeek,
  GitHubContributions,
  GitHubProfile,
  GitHubRepositories,
  GitHubRepository,
} from "../../src/types/github";
import type { ContributionsResponse, ProfileResponse, RepositoriesResponse } from "./schemas";

const LEVEL_BY_NAME = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
} as const satisfies Record<string, ContributionLevel>;

/** GitHub stores bios verbatim, newlines and all; the card renders one line. */
function collapseWhitespace(value: string | null): string | null {
  const collapsed = value?.replace(/\s+/g, " ").trim();
  return collapsed ? collapsed : null;
}

export function normalizeProfile(raw: NonNullable<ProfileResponse["user"]>): GitHubProfile {
  return {
    login: raw.login,
    name: raw.name,
    bio: collapseWhitespace(raw.bio),
    avatarUrl: raw.avatarUrl,
    url: raw.url,
    company: raw.company,
    location: raw.location,
    followers: raw.followers.totalCount,
    following: raw.following.totalCount,
    publicRepos: raw.repositories.totalCount,
    createdAt: raw.createdAt,
  };
}

/** Longest run of consecutive days with at least one contribution. */
function longestStreak(days: ContributionDay[]): number {
  let longest = 0;
  let run = 0;
  for (const day of days) {
    run = day.count > 0 ? run + 1 : 0;
    if (run > longest) longest = run;
  }
  return longest;
}

export function normalizeContributions(
  raw: NonNullable<ContributionsResponse["user"]>,
  year: number,
): GitHubContributions {
  const collection = raw.contributionsCollection;
  const calendar = collection.contributionCalendar;
  const yearPrefix = `${year}-`;

  const weeks: ContributionWeek[] = calendar.weeks.map((week) => ({
    firstDay: week.firstDay,
    days: week.contributionDays.map((day) => ({
      date: day.date,
      count: day.contributionCount,
      level: LEVEL_BY_NAME[day.contributionLevel],
      weekday: day.weekday,
      // GitHub squares off the first and last columns with days from the
      // neighbouring years. They are real dates, just outside the selection.
      inSelectedYear: day.date.startsWith(yearPrefix),
    })),
  }));

  const daysInYear = weeks.flatMap((week) => week.days).filter((day) => day.inSelectedYear);
  const longest = longestStreak(daysInYear);

  const busiest = daysInYear.reduce<ContributionDay | null>(
    (best, day) => (day.count > 0 && (!best || day.count > best.count) ? day : best),
    null,
  );

  const breakdown: ContributionBreakdown = {
    commits: collection.totalCommitContributions,
    issues: collection.totalIssueContributions,
    pullRequests: collection.totalPullRequestContributions,
    reviews: collection.totalPullRequestReviewContributions,
    repositories: collection.totalRepositoryContributions,
    restricted: collection.restrictedContributionsCount,
  };

  return {
    year,
    availableYears: [...collection.contributionYears].sort((a, b) => b - a),
    total: calendar.totalContributions,
    weeks,
    breakdown,
    longestStreak: longest,
    busiestDay: busiest ? { date: busiest.date, count: busiest.count } : null,
    isPartialYear: year === new Date().getUTCFullYear(),
  };
}

type RawRepository = NonNullable<
  NonNullable<RepositoriesResponse["user"]>["repositories"]["nodes"][number]
>;

function normalizeRepository(raw: RawRepository, pinned: Set<string>): GitHubRepository {
  const totalSize = raw.languages?.totalSize ?? 0;

  return {
    name: raw.name,
    description: raw.description,
    url: raw.url,
    // GitHub stores homepages exactly as typed, including bare domains.
    homepageUrl: normalizeHomepage(raw.homepageUrl),
    stars: raw.stargazerCount,
    forks: raw.forkCount,
    topics: raw.repositoryTopics.nodes.map((node) => node.topic.name),
    primaryLanguage: raw.primaryLanguage,
    languages:
      totalSize > 0
        ? (raw.languages?.edges ?? []).map((edge) => ({
            name: edge.node.name,
            color: edge.node.color,
            share: edge.size / totalSize,
          }))
        : [],
    pushedAt: raw.pushedAt ?? "",
    isArchived: raw.isArchived,
    isPrivate: raw.isPrivate,
    isFork: raw.isFork,
    isPinned: pinned.has(raw.name),
  };
}

function normalizeHomepage(url: string | null): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  const absolute = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(absolute);
    // Only ever hand the browser a link it is safe to follow.
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Ordering signal for the default "curated" view.
 *
 * This is not a claim that one repository is better than another — it is a
 * transparent preference for repositories that are *presentable*: the ones the
 * account has pinned, then ones with a live demo, then ones that are documented,
 * then ones people have engaged with, and recency to break ties.
 */
function curationScore(repo: GitHubRepository): number {
  let score = 0;
  if (repo.isPinned) score += 1000;
  if (repo.homepageUrl) score += 120;
  if (repo.description) score += 60;
  if (repo.topics.length > 0) score += 20;
  score += Math.min(repo.stars, 50) * 6;
  score += Math.min(repo.forks, 25) * 3;
  if (repo.isArchived) score -= 150;
  return score;
}

export function normalizeRepositories(
  raw: NonNullable<RepositoriesResponse["user"]>,
): GitHubRepositories {
  const pinned = new Set(raw.pinnedItems.nodes.flatMap((node) => (node?.name ? [node.name] : [])));

  const repositories = raw.repositories.nodes
    .flatMap((node) => (node ? [normalizeRepository(node, pinned)] : []))
    // GitHub already returns these newest-pushed first; the curation score
    // re-ranks, and `pushedAt` remains the tie-breaker.
    .sort((a, b) => {
      const delta = curationScore(b) - curationScore(a);
      return delta !== 0 ? delta : b.pushedAt.localeCompare(a.pushedAt);
    });

  return {
    repositories,
    totalCount: raw.repositories.totalCount,
    totals: {
      stars: repositories.reduce((sum, repo) => sum + repo.stars, 0),
      forks: repositories.reduce((sum, repo) => sum + repo.forks, 0),
    },
  };
}
