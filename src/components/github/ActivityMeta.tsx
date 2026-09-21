/*
 * A single line of mono metadata under the calendar.
 *
 * This replaces the old stats grid and profile card: the hero at the top of the
 * page already establishes who this is, so everything that survives here is a
 * number the hero doesn't already say. Facts arrive one at a time, driven by
 * the section's generation timeline.
 */

import { INK, metaStyle } from "@/lib/theme";
import type { GitHubContributions, GitHubProfile } from "@/types/github";
import { buildFacts } from "./facts";

export function ActivityMeta({
  contributions,
  profile,
  visible,
}: {
  contributions: GitHubContributions;
  profile?: GitHubProfile;
  /** How many facts have been generated so far. */
  visible: number;
}) {
  const facts = buildFacts(contributions, profile);
  if (facts.length === 0) return null;

  return (
    <ul
      className="flex flex-wrap"
      style={{
        ...metaStyle,
        gap: "6px 18px",
        margin: 0,
        padding: 0,
        listStyle: "none",
        minHeight: 19,
      }}
    >
      {facts.slice(0, visible).map((fact) => (
        <li key={fact.label} className="gh-fact-in">
          <span style={{ color: INK, fontVariantNumeric: "tabular-nums" }}>{fact.value}</span>{" "}
          {fact.label}
        </li>
      ))}
    </ul>
  );
}

/** Chips at roughly the real items' widths, in the same wrapping container. */
export function ActivityMetaSkeleton() {
  return (
    <ul
      className="flex flex-wrap"
      aria-hidden="true"
      style={{ ...metaStyle, gap: "6px 18px", margin: 0, padding: 0, listStyle: "none" }}
    >
      {[78, 142, 150, 112, 92].map((width) => (
        <li key={width} style={{ height: 19, display: "flex", alignItems: "center" }}>
          <span
            className="gh-shimmer"
            style={{ display: "block", width, height: 13, borderRadius: 3 }}
          />
        </li>
      ))}
    </ul>
  );
}
