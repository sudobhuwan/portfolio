/*
 * Which numbers the band reports under the calendar.
 *
 * Data logic, kept out of the component so the section can count the facts
 * ahead of rendering them — the generation timeline needs to know how long the
 * facts stage runs before any of them exist on screen.
 *
 * Everything here is year-scoped except the profile counts, and anything with
 * nothing to report is dropped rather than shown as a zero.
 */

import type { GitHubContributions, GitHubProfile } from "@/types/github";

export interface ActivityFact {
  value: string;
  label: string;
}

export function buildFacts(
  contributions: GitHubContributions,
  profile: GitHubProfile | undefined,
): ActivityFact[] {
  const { breakdown } = contributions;
  const facts: ActivityFact[] = [];

  if (breakdown.commits > 0) {
    facts.push({ value: breakdown.commits.toLocaleString(), label: "commits" });
  }
  if (breakdown.pullRequests > 0) {
    facts.push({
      value: breakdown.pullRequests.toLocaleString(),
      label: breakdown.pullRequests === 1 ? "pull request" : "pull requests",
    });
  }
  if (breakdown.restricted > 0) {
    facts.push({ value: breakdown.restricted.toLocaleString(), label: "in private repos" });
  }
  if (contributions.longestStreak > 0) {
    const days = contributions.longestStreak;
    facts.push({ value: `${days} ${days === 1 ? "day" : "days"}`, label: "longest streak" });
  }
  if (profile) {
    facts.push({ value: profile.publicRepos.toLocaleString(), label: "public repos" });
    facts.push({ value: profile.followers.toLocaleString(), label: "followers" });
  }

  return facts;
}

export const countFacts = (contributions: GitHubContributions, profile?: GitHubProfile): number =>
  buildFacts(contributions, profile).length;
