/*
 * The generation timeline for the GitHub answer.
 *
 * Same philosophy as the page's typed answers: one tick counter drives every
 * stage, and each stage is a pure function of that counter, so the sequence can
 * never desync or get stuck halfway. Nothing here animates anything — it only
 * says what should be visible at tick `n`; the components read that and render.
 *
 * Order: the label types, the figure counts up out of nothing, the caption
 * types, the year chips land one by one, the grid converges column by column,
 * then the legend, then the facts, then the outbound link.
 */

export const TICK_MS = 16;
const CHARS_PER_TICK = 2;
const OUTRO_CHARS_PER_TICK = 3;

/* Grid convergence is handed to CSS (365 cells re-rendering each tick would
   stutter), so the schedule only needs to know how long that sweep lasts. */
export const CELL_STAGGER_MS = 7;
export const CELL_SETTLE_MS = 460;

const ticksForText = (text: string, perTick = CHARS_PER_TICK) => Math.ceil(text.length / perTick);

export interface GenerationInput {
  label: string;
  caption: string;
  outro: string;
  years: number;
  weeks: number;
  facts: number;
}

export interface GenerationSchedule {
  labelEnd: number;
  figureStart: number;
  figureEnd: number;
  captionStart: number;
  captionEnd: number;
  yearsStart: number;
  yearsEnd: number;
  gridStart: number;
  gridEnd: number;
  legendAt: number;
  factsStart: number;
  factsEnd: number;
  outroStart: number;
  outroEnd: number;
  total: number;
}

const FIGURE_TICKS = 26;
const TICKS_PER_YEAR_CHIP = 2;
const TICKS_PER_FACT = 3;

export function buildSchedule(input: GenerationInput): GenerationSchedule {
  const labelEnd = ticksForText(input.label);

  const figureStart = 2;
  const figureEnd = figureStart + FIGURE_TICKS;

  const captionStart = 6;
  const captionEnd = captionStart + ticksForText(input.caption);

  const yearsStart = 10;
  const yearsEnd = yearsStart + input.years * TICKS_PER_YEAR_CHIP;

  const gridStart = 14;
  const sweepMs = input.weeks * CELL_STAGGER_MS + CELL_SETTLE_MS;
  const gridEnd = gridStart + Math.ceil(sweepMs / TICK_MS);

  const legendAt = gridEnd;
  const factsStart = gridEnd + 2;
  const factsEnd = factsStart + input.facts * TICKS_PER_FACT;

  const outroStart = factsEnd + 1;
  const outroEnd = outroStart + ticksForText(input.outro, OUTRO_CHARS_PER_TICK);

  return {
    labelEnd,
    figureStart,
    figureEnd,
    captionStart,
    captionEnd,
    yearsStart,
    yearsEnd,
    gridStart,
    gridEnd,
    legendAt,
    factsStart,
    factsEnd,
    outroStart,
    outroEnd,
    total: Math.max(figureEnd, captionEnd, outroEnd),
  };
}

export interface GenerationView {
  labelChars: number;
  /** 0-1; the figure counts from nothing up to its real total. */
  figureProgress: number;
  captionChars: number;
  yearsShown: number;
  gridStarted: boolean;
  legendShown: boolean;
  factsShown: number;
  outroChars: number;
  done: boolean;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** easeOutExpo — quick settle, no bounce, matching the page's other motion. */
const ease = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

export function projectGeneration(
  schedule: GenerationSchedule,
  input: GenerationInput,
  n: number,
): GenerationView {
  const span = (start: number, end: number) =>
    clamp01(end === start ? 1 : (n - start) / (end - start));

  return {
    labelChars: Math.min(input.label.length, Math.max(0, n) * CHARS_PER_TICK),
    figureProgress: ease(span(schedule.figureStart, schedule.figureEnd)),
    captionChars: Math.min(
      input.caption.length,
      Math.max(0, n - schedule.captionStart) * CHARS_PER_TICK,
    ),
    yearsShown: Math.max(0, Math.floor((n - schedule.yearsStart) / TICKS_PER_YEAR_CHIP)),
    gridStarted: n >= schedule.gridStart,
    legendShown: n >= schedule.legendAt,
    factsShown: Math.max(0, Math.floor((n - schedule.factsStart) / TICKS_PER_FACT)),
    outroChars: Math.min(
      input.outro.length,
      Math.max(0, n - schedule.outroStart) * OUTRO_CHARS_PER_TICK,
    ),
    done: n >= schedule.total,
  };
}

/** The whole sequence collapses to its finished state when motion is reduced. */
export function settledView(input: GenerationInput): GenerationView {
  return {
    labelChars: input.label.length,
    figureProgress: 1,
    captionChars: input.caption.length,
    yearsShown: input.years,
    gridStarted: true,
    legendShown: true,
    factsShown: input.facts,
    outroChars: input.outro.length,
    done: true,
  };
}
