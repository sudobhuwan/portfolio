/*
 * The contribution calendar.
 *
 * Structure is a real <table>: seven rows for the days of the week, one column
 * per week, month names spanning their weeks in the header. That gives screen
 * readers a grid they can navigate and keeps the month labels perfectly aligned
 * with their columns for free.
 *
 * Only one cell is in the tab order at a time (roving tabindex); arrow keys move
 * between days. A single shared tooltip element follows the hovered or focused
 * cell rather than rendering ~365 of them.
 *
 * Note on the data: GitHub reports contribution *types* per year, not per day,
 * so a day's tooltip shows the date and the count — the only per-day facts the
 * API actually provides.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { ACCENT, BG, CONTRIBUTION_COLORS, DIM, INK, MONO, SANS, metaStyle } from "@/lib/theme";
import { CELL_SETTLE_MS, CELL_STAGGER_MS, type GenerationView } from "./generation";
import type { ContributionDay, GitHubContributions } from "@/types/github";
import { Skeleton } from "./primitives";

const CELL = 11;
const GAP = 3;
const PITCH = CELL + GAP;
const WEEKDAY_GUTTER = 26;
/* Rendered height of the table inside .gh-scroll, measured against the loaded
   calendar; the skeleton uses it so the two states are the same height. */
const GRID_BOX_HEIGHT = 129;
/* Height of the month-label row above the grid. */
const MONTH_ROW_HEIGHT = 16;
/* Line box of the 12.5px mono caption under the figure, and of the legend row. */
const CAPTION_LINE = 18;
const LEGEND_LINE = 17;
const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const WEEKDAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/*
 * Each cell starts at a wrong intensity and resolves to its real one, the way
 * the portrait's particles start as noise and learn the face. Deterministic, so
 * a re-render never reshuffles a cell mid-flight.
 */
function noiseLevel(week: number, weekday: number, salt: number): number {
  const h = Math.sin(week * 127.1 + weekday * 311.7 + salt * 74.7) * 43758.5453;
  return Math.floor((h - Math.floor(h)) * CONTRIBUTION_COLORS.length);
}

/* Dates arrive as plain `YYYY-MM-DD`; parsing them as UTC avoids the
   off-by-one-day that local-time parsing causes west of Greenwich. */
function formatFullDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function monthIndex(iso: string): number {
  return Number(iso.slice(5, 7)) - 1;
}

interface MonthSpan {
  label: string;
  span: number;
}

/** One header cell per month, spanning the weeks that belong to it. */
function buildMonthSpans(weeks: GitHubContributions["weeks"]): MonthSpan[] {
  const spans: MonthSpan[] = [];
  let previousMonth = -1;

  weeks.forEach((week) => {
    const month = monthIndex(week.days[0]?.date ?? week.firstDay);
    if (month !== previousMonth) {
      spans.push({ label: MONTH_NAMES[month], span: 1 });
      previousMonth = month;
    } else {
      spans[spans.length - 1].span += 1;
    }
  });

  // A month that only caught the tail of a week has no room for its name. Blank
  // the label rather than dropping the entry — the colSpans have to keep adding
  // up to the number of week columns or the header stops lining up with the grid.
  return spans.map((span, index) => ({
    ...span,
    label: span.span > 1 || index === spans.length - 1 ? span.label : "",
  }));
}

interface TooltipState {
  day: ContributionDay;
  x: number;
  y: number;
}

export function ContributionCalendar({
  data,
  isFetching,
  selectedYear,
  onSelectYear,
  gen,
}: {
  data: GitHubContributions;
  isFetching: boolean;
  /** The year the visitor asked for, which leads `data.year` while loading. */
  selectedYear: number;
  onSelectYear: (year: number) => void;
  /** What of this block has been generated so far. */
  gen: GenerationView;
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [focused, setFocused] = useState<{ week: number; weekday: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLTableSectionElement | null>(null);
  const animatedTotal = Math.round(data.total * gen.figureProgress);

  const months = useMemo(() => buildMonthSpans(data.weeks), [data.weeks]);

  /* Index the days by [week][weekday] so partial first/last weeks — GitHub
     does not pad them when a date range is given — render in the right rows. */
  const grid = useMemo(() => {
    return data.weeks.map((week) => {
      const column: Array<ContributionDay | null> = Array(7).fill(null);
      week.days.forEach((day) => {
        column[day.weekday] = day;
      });
      return column;
    });
  }, [data.weeks]);

  /* On narrow screens the grid scrolls; start at the most recent week. The
     extra frame lets the table reach its final width before we measure it. */
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const toEnd = () => {
      node.scrollLeft = node.scrollWidth - node.clientWidth;
    };
    toEnd();
    const frame = requestAnimationFrame(toEnd);
    return () => cancelAnimationFrame(frame);
  }, [data.year, data.weeks.length]);

  /* A different year is a different grid; drop the old focus coordinates. */
  useEffect(() => {
    setFocused(null);
  }, [data.year]);

  const showTooltip = useCallback((day: ContributionDay, cell: HTMLElement) => {
    const container = scrollRef.current;
    if (!container) return;
    const cellBox = cell.getBoundingClientRect();
    const containerBox = container.getBoundingClientRect();
    setTooltip({
      day,
      x: cellBox.left - containerBox.left + container.scrollLeft + cellBox.width / 2,
      y: cellBox.top - containerBox.top,
    });
  }, []);

  const moveFocus = useCallback((week: number, weekday: number) => {
    const target = gridRef.current?.querySelector<HTMLElement>(
      `[data-week="${week}"][data-weekday="${weekday}"]`,
    );
    if (!target) return;
    setFocused({ week, weekday });
    target.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableCellElement>, week: number, weekday: number) => {
      const deltas: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const delta = deltas[event.key];
      if (!delta) return;

      event.preventDefault();
      const [weekStep, weekdayStep] = delta;
      let nextWeek = week + weekStep;
      let nextWeekday = weekday + weekdayStep;

      // Wrap vertically into the neighbouring week, like a continuous timeline.
      if (nextWeekday > 6) {
        nextWeekday = 0;
        nextWeek += 1;
      } else if (nextWeekday < 0) {
        nextWeekday = 6;
        nextWeek -= 1;
      }

      // Skip over the blank cells of a partial first or last week.
      while (nextWeek >= 0 && nextWeek < grid.length && !grid[nextWeek][nextWeekday]) {
        nextWeek += weekStep || 0;
        if (weekStep === 0) break;
      }

      if (nextWeek < 0 || nextWeek >= grid.length || !grid[nextWeek][nextWeekday]) return;
      moveFocus(nextWeek, nextWeekday);
    },
    [grid, moveFocus],
  );

  /* The roving tab stop: the focused day, else the first real day. The focused
     coordinates are re-checked against the current grid — switching to a year
     with fewer weeks would otherwise leave no cell in the tab order at all. */
  const tabStop = useMemo(() => {
    if (focused && grid[focused.week]?.[focused.weekday]) return focused;
    for (let week = 0; week < grid.length; week += 1) {
      for (let weekday = 0; weekday < 7; weekday += 1) {
        if (grid[week][weekday]) return { week, weekday };
      }
    }
    return { week: 0, weekday: 0 };
  }, [focused, grid]);

  const gridWidth = WEEKDAY_GUTTER + data.weeks.length * PITCH;
  const hintId = `gh-calendar-hint-${data.year}`;
  const caption = `contributions in ${data.year}${data.isPartialYear ? " · year in progress" : ""}`;

  /*
   * The grid is memoised on purpose. The generation clock ticks every 16ms and
   * reconciling ~365 cells on each tick cost more than the tick itself, which
   * made the whole sequence crawl. None of these cells change while the figure
   * counts up, so they are rebuilt only when the grid really changes.
   */
  const tableNode = useMemo(
    () => (
      <table
        role="grid"
        aria-label={`Contribution calendar for ${data.year}`}
        aria-describedby={hintId}
        style={{
          borderCollapse: "separate",
          borderSpacing: `${GAP}px`,
          width: gridWidth,
          tableLayout: "fixed",
          margin: `-${GAP}px`,
        }}
      >
        <thead>
          <tr role="row" style={{ height: 16 }}>
            <td
              style={{
                width: WEEKDAY_GUTTER,
                position: "sticky",
                left: 0,
                zIndex: 1,
                background: BG,
              }}
            />
            {months.map((month, index) => (
              <th
                key={`${month.label}-${index}`}
                colSpan={month.span}
                role="columnheader"
                scope="colgroup"
                style={{
                  ...metaStyle,
                  fontSize: 11,
                  fontWeight: 400,
                  textAlign: "left",
                  padding: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {month.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody key={data.year} ref={gridRef}>
          {WEEKDAY_LABELS.map((label, weekday) => (
            <tr key={weekday} role="row" style={{ height: CELL }}>
              <th
                role="rowheader"
                scope="row"
                style={{
                  ...metaStyle,
                  fontSize: 10.5,
                  fontWeight: 400,
                  width: WEEKDAY_GUTTER,
                  textAlign: "left",
                  padding: 0,
                  verticalAlign: "middle",
                  // Stays put when the grid scrolls sideways on narrow screens.
                  position: "sticky",
                  left: 0,
                  zIndex: 1,
                  background: BG,
                }}
              >
                <span aria-hidden="true">{label}</span>
                <span className="sr-only">{WEEKDAY_FULL[weekday]}</span>
              </th>
              {grid.map((column, week) => {
                const day = column[weekday];
                if (!day) {
                  return <td key={week} style={{ width: CELL, height: CELL, padding: 0 }} />;
                }

                const isTabStop = tabStop.week === week && tabStop.weekday === weekday;
                const label = `${formatFullDate(day.date)}: ${
                  day.count === 1 ? "1 contribution" : `${day.count} contributions`
                }`;

                return (
                  <td
                    key={week}
                    role="gridcell"
                    className="gh-day gh-day-in"
                    data-week={week}
                    data-weekday={weekday}
                    tabIndex={isTabStop ? 0 : -1}
                    aria-label={label}
                    style={{
                      width: CELL,
                      height: CELL,
                      padding: 0,
                      borderRadius: 2,
                      background: CONTRIBUTION_COLORS[day.level],
                      // The keyframes read these: the cell fades up from a
                      // wrong intensity, passes through another, and lands on
                      // its real one. Delay sweeps the grid left to right.
                      ["--gh-from" as string]: CONTRIBUTION_COLORS[noiseLevel(week, weekday, 1)],
                      ["--gh-mid" as string]: CONTRIBUTION_COLORS[noiseLevel(week, weekday, 2)],
                      animationDelay: `${week * CELL_STAGGER_MS}ms`,
                      animationDuration: `${CELL_SETTLE_MS}ms`,
                    }}
                    onMouseEnter={(event) => showTooltip(day, event.currentTarget)}
                    onFocus={(event) => {
                      setFocused({ week, weekday });
                      showTooltip(day, event.currentTarget);
                    }}
                    onBlur={() => setTooltip(null)}
                    onKeyDown={(event) => handleKeyDown(event, week, weekday)}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    ),
    [grid, months, tabStop, gridWidth, hintId, data.year, handleKeyDown, showTooltip],
  );

  return (
    <div>
      <p id={hintId} className="sr-only">
        {`${data.total.toLocaleString()} contributions in ${data.year}. Each cell is one day; use the arrow keys to move between days.`}
      </p>
      <header
        className="flex flex-wrap items-end justify-between"
        style={{ gap: "12px 24px", marginBottom: 18 }}
      >
        <div>
          <div
            style={{
              fontFamily: "'Space Grotesk', 'Inter', sans-serif",
              fontSize: "clamp(1.65rem, 3.4vw, 2.1rem)",
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              color: INK,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {animatedTotal.toLocaleString()}
          </div>
          <div style={{ ...metaStyle, marginTop: 6, minHeight: 18 }}>
            {caption.slice(0, gen.captionChars)}
          </div>
        </div>

        {data.availableYears.length > 1 && (
          <div
            role="group"
            aria-label="Select contribution year"
            className="flex flex-wrap"
            style={{ gap: "6px 14px" }}
          >
            {data.availableYears.slice(0, gen.yearsShown).map((year) => {
              const active = year === selectedYear;
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => onSelectYear(year)}
                  aria-pressed={active}
                  className="gh-year"
                  style={{
                    fontFamily: MONO,
                    fontSize: 13,
                    background: "none",
                    border: "none",
                    padding: "2px 0",
                    cursor: "pointer",
                    color: active ? ACCENT : DIM,
                    borderBottom: `1.5px solid ${active ? ACCENT : "transparent"}`,
                  }}
                >
                  {year}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div
        ref={scrollRef}
        className="gh-scroll"
        style={{
          position: "relative",
          overflowX: "auto",
          overflowY: "hidden",
          paddingTop: 4,
          paddingBottom: 6,
          // Reserve the grid's height before it exists, so the cells converge
          // into a fixed space instead of shoving the rest of the answer down.
          minHeight: MONTH_ROW_HEIGHT + 7 * PITCH,
          // Dims the grid while a different year loads, without unmounting it.
          opacity: isFetching ? 0.55 : 1,
          transition: "opacity .2s ease",
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        {gen.gridStarted && tableNode}

        {tooltip && (
          <div
            role="presentation"
            className="gh-tooltip"
            style={{
              position: "absolute",
              left: tooltip.x,
              top: tooltip.y,
              transform: "translate(-50%, calc(-100% - 8px))",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              background: INK,
              color: "#FBFAF7",
              borderRadius: 4,
              padding: "7px 10px",
              zIndex: 5,
              boxShadow: "0 6px 18px rgba(20,21,25,0.18)",
            }}
          >
            <div style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 500 }}>
              {tooltip.day.count === 1 ? "1 contribution" : `${tooltip.day.count} contributions`}
            </div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 11,
                opacity: 0.6,
                marginTop: 2,
              }}
            >
              {new Date(`${tooltip.day.date}T00:00:00Z`).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              })}
            </div>
          </div>
        )}
      </div>

      <div
        className="flex items-center justify-end"
        style={{
          marginTop: 12,
          gap: 16,
          minHeight: 17,
          opacity: gen.legendShown ? 1 : 0,
          transition: "opacity .3s ease",
        }}
      >
        <div className="flex items-center" style={{ gap: 5 }}>
          <span style={{ ...metaStyle, fontSize: 11.5, marginRight: 3 }}>less</span>
          {CONTRIBUTION_COLORS.map((color, index) => (
            <span
              key={index}
              aria-hidden="true"
              style={{
                width: CELL,
                height: CELL,
                borderRadius: 2,
                background: color,
                display: "inline-block",
              }}
            />
          ))}
          <span style={{ ...metaStyle, fontSize: 11.5, marginLeft: 3 }}>more</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Mirrors the loaded calendar's JSX shape rather than guessing at its height:
 * the same header, the same year-switcher row and the same grid box, so it
 * wraps identically at every width and nothing below the band moves when the
 * real data arrives.
 */
export function ContributionCalendarSkeleton() {
  return (
    <div aria-hidden="true">
      <header
        className="flex flex-wrap items-end justify-between"
        style={{ gap: "12px 24px", marginBottom: 18 }}
      >
        <div>
          <Skeleton width={104} height={34} />
          <Skeleton width={196} height={CAPTION_LINE} style={{ marginTop: 6 }} />
        </div>
        <div className="flex flex-wrap" style={{ gap: "6px 14px" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width={32} height={14} />
          ))}
        </div>
      </header>

      <div style={{ paddingTop: 4, paddingBottom: 6 }}>
        <Skeleton height={GRID_BOX_HEIGHT} radius={4} />
      </div>

      <div className="flex items-center justify-end" style={{ marginTop: 12 }}>
        <Skeleton width={128} height={LEGEND_LINE} />
      </div>
    </div>
  );
}
