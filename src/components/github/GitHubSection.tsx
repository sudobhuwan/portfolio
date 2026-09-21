/*
 * The GitHub activity band.
 *
 * It sits directly under the masthead, between the name and the introduction,
 * and is deliberately *not* a second profile: the hero already carries the
 * name, the role and the portrait, so repeating an avatar, a name and a bio
 * here just made the page look like it introduced the same person twice.
 * What's left is only what the hero doesn't already say — the shape of the work
 * over time, and a handful of counts.
 *
 * Because this is above the fold it renders eagerly, and the loading skeleton
 * mirrors the final layout so the introduction below never gets shoved down.
 */

import { useEffect, useMemo, useState } from "react";

import { useGitHubContributions, useGitHubProfile } from "@/hooks/use-github";
import { GitHubRequestError } from "@/lib/github-client";
import { ACCENT, FAINT, INK, MONO, metaStyle } from "@/lib/theme";
import { ActivityMeta, ActivityMetaSkeleton } from "./ActivityMeta";
import { countFacts } from "./facts";
import { ContributionCalendar, ContributionCalendarSkeleton } from "./ContributionCalendar";
import { StateNotice } from "./primitives";
import {
  buildSchedule,
  projectGeneration,
  settledView,
  TICK_MS,
  type GenerationInput,
} from "./generation";

/** Used for the outbound link before the profile has loaded, or if it fails. */
const FALLBACK_PROFILE_URL = "https://github.com/sudobhuwan";

/** A second line of context for the failures a visitor can reason about. */
const HINTS: Partial<Record<string, string>> = {
  rate_limited: "GitHub limits how often this can be refreshed. It'll be back shortly.",
  missing_config: "The GitHub credentials aren't set on this deployment.",
  user_not_found: "The configured GitHub account no longer resolves.",
};

function describe(error: unknown): { message: string; hint?: string } {
  if (error instanceof GitHubRequestError) {
    return { message: error.message, hint: HINTS[error.code] };
  }
  return { message: "GitHub activity is temporarily unavailable." };
}

const LABEL = "github";
const OUTRO = "browse the repositories on GitHub";
const FOOTNOTE =
  "Public and private contributions · intensity follows GitHub's own quartiles · types are reported per year, not per day";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function GitHubSection() {
  const [year, setYear] = useState<number | null>(null);

  const profile = useGitHubProfile(true);
  const contributions = useGitHubContributions(year, true);

  const profileUrl = profile.data?.url ?? FALLBACK_PROFILE_URL;

  /* One counter drives the whole block, the way one counter drives the typed
     answers. Every stage is derived from it, so the sequence cannot desync. */
  const [tick, setTick] = useState(0);

  const input: GenerationInput = useMemo(
    () => ({
      label: LABEL,
      outro: OUTRO,
      caption: contributions.data
        ? `contributions in ${contributions.data.year}${
            contributions.data.isPartialYear ? " · year in progress" : ""
          }`
        : "",
      years: contributions.data?.availableYears.length ?? 0,
      weeks: contributions.data?.weeks.length ?? 0,
      facts: contributions.data ? countFacts(contributions.data, profile.data) : 0,
    }),
    [contributions.data, profile.data],
  );

  const schedule = useMemo(() => buildSchedule(input), [input]);
  const gen = useMemo(
    () => (prefersReducedMotion() ? settledView(input) : projectGeneration(schedule, input, tick)),
    [schedule, input, tick],
  );

  /* Restart whenever a new set of data arrives — first load, or a new year. */
  const generatedYear = contributions.data?.year ?? null;
  useEffect(() => {
    setTick(0);
  }, [generatedYear]);

  useEffect(() => {
    if (gen.done) return;
    const id = setInterval(() => setTick((value) => value + 1), TICK_MS);
    return () => clearInterval(id);
  }, [gen.done, schedule]);

  return (
    <section aria-labelledby="github-heading" className="gh-root" style={{ marginTop: 4 }}>
      <style>{SECTION_STYLES}</style>

      <div className="flex flex-wrap items-baseline justify-between" style={{ gap: "6px 16px" }}>
        {/* Styled as one of the answer's row labels ("who", "what I do") so the
            band reads as part of the generated answer, not a section of its own. */}
        <h2
          id="github-heading"
          style={{
            fontFamily: MONO,
            fontSize: 13.5,
            fontWeight: 400,
            color: ACCENT,
            margin: 0,
          }}
        >
          {LABEL.slice(0, gen.labelChars)}
        </h2>

        <a
          href={`${profileUrl}?tab=repositories`}
          target="_blank"
          rel="noreferrer noopener"
          className="gh-outro"
          // Hidden from the tab order until it has actually been generated.
          tabIndex={gen.outroChars > 0 ? undefined : -1}
          aria-hidden={gen.outroChars > 0 ? undefined : true}
          style={{
            fontFamily: MONO,
            fontSize: 12.5,
            color: INK,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "baseline",
            gap: 6,
            minHeight: 18,
          }}
        >
          {OUTRO.slice(0, gen.outroChars)}
          {gen.outroChars >= OUTRO.length && (
            <span className="gh-outro-arrow" aria-hidden="true" style={{ color: ACCENT }}>
              ↗
            </span>
          )}
        </a>
      </div>

      <div style={{ marginTop: 20 }}>
        {contributions.isError ? (
          <StateNotice
            {...describe(contributions.error)}
            minHeight={150}
            onRetry={() => void contributions.refetch()}
          />
        ) : (
          <>
            {contributions.data ? (
              <ContributionCalendar
                data={contributions.data}
                isFetching={contributions.isFetching}
                selectedYear={year ?? contributions.data.year}
                onSelectYear={setYear}
                gen={gen}
              />
            ) : (
              <ContributionCalendarSkeleton />
            )}

            <div style={{ marginTop: 14 }}>
              {contributions.data ? (
                <ActivityMeta
                  contributions={contributions.data}
                  profile={profile.data}
                  visible={gen.factsShown}
                />
              ) : (
                <ActivityMetaSkeleton />
              )}

              {/* Always rendered: it is true whether or not the data has landed,
                  so it reserves its own space instead of needing a placeholder. */}
              <p
                style={{
                  ...metaStyle,
                  fontSize: 11,
                  margin: "8px 0 0",
                  opacity: gen.done ? 1 : 0,
                  transition: "opacity .35s ease",
                }}
              >
                {FOOTNOTE}
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* Scoped to this section. Class names are prefixed so nothing here can reach
   the rest of the page, and every transition is disabled under
   prefers-reduced-motion. */
const SECTION_STYLES = `
  /* A cell fades up from a wrong intensity, passes through another, and lands
     on its real one — the graph resolves out of noise rather than appearing.
     The --gh-from / --gh-mid values are set per cell; the column stagger comes
     from animation-delay. */
  @keyframes gh-cell-settle {
    0%   { opacity: 0; background: var(--gh-from); transform: scale(.55); }
    45%  { opacity: 1; background: var(--gh-mid); transform: scale(1.06); }
    100% { opacity: 1; transform: scale(1); }
  }
  .gh-day-in { animation-name: gh-cell-settle; animation-timing-function: cubic-bezier(.22,1,.36,1); animation-fill-mode: both; }

  @keyframes gh-fact-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  .gh-fact-in { animation: gh-fact-in .3s ease-out both; }

  @keyframes gh-chip-in { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }
  .gh-year { animation: gh-chip-in .28s ease-out both; }

  .gh-day { cursor: default; transition: filter .14s ease; }
  .gh-day:hover { filter: brightness(.9); }
  .gh-day:focus-visible { outline: 1.5px solid ${INK}; outline-offset: 1.5px; }

  .gh-year:hover { color: ${INK} !important; }

  .gh-outro:hover { color: ${ACCENT} !important; }
  .gh-outro-arrow { display: inline-block; transition: transform .24s cubic-bezier(.22,1,.36,1); }
  .gh-outro:hover .gh-outro-arrow { transform: translate(2px, -2px); }
  .gh-outro:focus-visible { outline: 1.5px solid ${ACCENT}; outline-offset: 4px; border-radius: 2px; }

  .gh-scroll { scrollbar-width: thin; scrollbar-color: ${FAINT} transparent; }
  .gh-scroll::-webkit-scrollbar { height: 6px; }
  .gh-scroll::-webkit-scrollbar-thumb { background: ${FAINT}; border-radius: 3px; }
  .gh-scroll::-webkit-scrollbar-track { background: transparent; }

  .gh-shimmer {
    background: linear-gradient(90deg, #EFEEEA 25%, #F7F6F3 50%, #EFEEEA 75%);
    background-size: 200% 100%;
    animation: gh-shimmer 1.4s linear infinite;
  }
  @keyframes gh-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

  /* Everything above is decoration on top of content that is already correct,
     so reduced motion simply switches it all off; settledView() has already
     collapsed the timeline to its finished state. */
  @media (prefers-reduced-motion: reduce) {
    .gh-day-in, .gh-fact-in, .gh-year, .gh-shimmer { animation: none; }
    .gh-day, .gh-scroll, .gh-outro-arrow { transition: none; }
    .gh-outro:hover .gh-outro-arrow { transform: none; }
  }
`;
