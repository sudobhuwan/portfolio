/*
 * GraphQL documents, kept narrow on purpose.
 *
 * Each query asks for exactly the fields the UI renders — no connections we
 * don't read, no nested owner/viewer objects. That keeps the response small and
 * the GraphQL point cost at the 1-point floor for each call.
 */

export const PROFILE_QUERY = /* GraphQL */ `
  query Profile($login: String!) {
    user(login: $login) {
      login
      name
      bio
      avatarUrl(size: 160)
      url
      company
      location
      createdAt
      followers {
        totalCount
      }
      following {
        totalCount
      }
      repositories(privacy: PUBLIC, ownerAffiliations: OWNER, isFork: false) {
        totalCount
      }
    }
  }
`;

/**
 * `contributionsCollection` accepts a window of at most one year, so a calendar
 * year fits exactly. `contributionYears` tells us which years are worth
 * offering in the year switcher.
 */
export const CONTRIBUTIONS_QUERY = /* GraphQL */ `
  query Contributions($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionYears
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalRepositoryContributions
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          weeks {
            firstDay
            contributionDays {
              date
              contributionCount
              contributionLevel
              weekday
            }
          }
        }
      }
    }
  }
`;

/**
 * 100 repositories is GitHub's per-page maximum and comfortably covers a
 * personal account; we deliberately do not paginate further, because the UI
 * ranks and truncates anyway.
 */
export const REPOSITORIES_QUERY = /* GraphQL */ `
  query Repositories($login: String!) {
    user(login: $login) {
      pinnedItems(first: 6, types: REPOSITORY) {
        nodes {
          ... on Repository {
            name
          }
        }
      }
      repositories(
        first: 100
        privacy: PUBLIC
        ownerAffiliations: OWNER
        isFork: false
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        totalCount
        nodes {
          name
          description
          url
          homepageUrl
          stargazerCount
          forkCount
          pushedAt
          isArchived
          isPrivate
          isFork
          primaryLanguage {
            name
            color
          }
          repositoryTopics(first: 6) {
            nodes {
              topic {
                name
              }
            }
          }
          languages(first: 5, orderBy: { field: SIZE, direction: DESC }) {
            totalSize
            edges {
              size
              node {
                name
                color
              }
            }
          }
        }
      }
    }
  }
`;
