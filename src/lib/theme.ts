/*
 * The portfolio's design tokens, lifted out of Index.tsx so the GitHub section
 * renders from the same palette and type scale rather than a parallel one.
 * These values are unchanged from the original page.
 */

import type { CSSProperties } from "react";

export const BG = "#FBFAF7";
export const INK = "#141519";
export const BODY = "#3E4148";
export const DIM = "#8B8F98";
export const FAINT = "#D8DADE";
export const ACCENT = "#2E4FE0";

export const MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace";
export const DISPLAY = "'Space Grotesk', 'Inter', -apple-system, sans-serif";
export const SANS = "'Inter', -apple-system, 'Segoe UI', sans-serif";

/** The accent as raw channels, so it can be used at partial opacity. */
export const ACCENT_RGB = "46, 79, 224";

export const accentAlpha = (alpha: number): string => `rgba(${ACCENT_RGB}, ${alpha})`;

/**
 * The contribution intensity ramp.
 *
 * GitHub's own graph is green; this one is built from the portfolio's accent so
 * the calendar reads as part of the page. Index 0 is an empty day — kept just
 * dark enough to be visible against the paper background, so the grid still
 * reads as a grid on a quiet week.
 */
export const CONTRIBUTION_COLORS = [
  "#E5E5E0",
  accentAlpha(0.3),
  accentAlpha(0.52),
  accentAlpha(0.76),
  ACCENT,
] as const;

/** A hairline rule, the page's main structural device. */
export const HAIRLINE = `1px solid ${FAINT}`;

/** Secondary mono text: captions, counts, timestamps. */
export const metaStyle: CSSProperties = {
  fontFamily: MONO,
  fontSize: 12.5,
  color: DIM,
};
