/*
 * Runtime validation of GitHub's responses with zod (already a dependency).
 *
 * GitHub is a well-behaved API, but it is still an external system: schema
 * drift or a partially-null response should surface as a clean
 * `malformed_response` rather than a TypeError deep inside a React render.
 */

import { z } from "zod";

const nullableString = z.string().nullable();

export const profileSchema = z.object({
  user: z
    .object({
      login: z.string(),
      name: nullableString,
      bio: nullableString,
      avatarUrl: z.string().url(),
      url: z.string().url(),
      company: nullableString,
      location: nullableString,
      createdAt: z.string(),
      followers: z.object({ totalCount: z.number() }),
      following: z.object({ totalCount: z.number() }),
      repositories: z.object({ totalCount: z.number() }),
    })
    .nullable(),
});

export const contributionLevelSchema = z.enum([
  "NONE",
  "FIRST_QUARTILE",
  "SECOND_QUARTILE",
  "THIRD_QUARTILE",
  "FOURTH_QUARTILE",
]);

export const contributionsSchema = z.object({
  user: z
    .object({
      contributionsCollection: z.object({
        contributionYears: z.array(z.number()),
        totalCommitContributions: z.number(),
        totalIssueContributions: z.number(),
        totalPullRequestContributions: z.number(),
        totalPullRequestReviewContributions: z.number(),
        totalRepositoryContributions: z.number(),
        restrictedContributionsCount: z.number(),
        contributionCalendar: z.object({
          totalContributions: z.number(),
          weeks: z.array(
            z.object({
              firstDay: z.string(),
              contributionDays: z.array(
                z.object({
                  date: z.string(),
                  contributionCount: z.number(),
                  contributionLevel: contributionLevelSchema,
                  weekday: z.number(),
                }),
              ),
            }),
          ),
        }),
      }),
    })
    .nullable(),
});

export const repositoriesSchema = z.object({
  user: z
    .object({
      pinnedItems: z.object({
        // A pinned item can be a gist, which arrives as an empty object.
        nodes: z.array(z.object({ name: z.string().optional() }).nullable()),
      }),
      repositories: z.object({
        totalCount: z.number(),
        nodes: z.array(
          z
            .object({
              name: z.string(),
              description: nullableString,
              url: z.string().url(),
              homepageUrl: nullableString,
              stargazerCount: z.number(),
              forkCount: z.number(),
              pushedAt: z.string().nullable(),
              isArchived: z.boolean(),
              isPrivate: z.boolean(),
              isFork: z.boolean(),
              primaryLanguage: z.object({ name: z.string(), color: nullableString }).nullable(),
              repositoryTopics: z.object({
                nodes: z.array(z.object({ topic: z.object({ name: z.string() }) })),
              }),
              languages: z
                .object({
                  totalSize: z.number(),
                  edges: z.array(
                    z.object({
                      size: z.number(),
                      node: z.object({ name: z.string(), color: nullableString }),
                    }),
                  ),
                })
                .nullable(),
            })
            .nullable(),
        ),
      }),
    })
    .nullable(),
});

export type ProfileResponse = z.infer<typeof profileSchema>;
export type ContributionsResponse = z.infer<typeof contributionsSchema>;
export type RepositoriesResponse = z.infer<typeof repositoriesSchema>;
