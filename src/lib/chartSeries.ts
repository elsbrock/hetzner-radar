/*
 * Helpers for turning the sparse daily aggregates coming out of DuckDB into
 * series a chart can draw honestly.
 *
 * The stats queries group by observed day, so a day with no matching rows is
 * simply absent from the result. Drawn as-is on a time axis, the neighbouring
 * points get joined and the hole looks like data. These helpers put every
 * series on a shared daily grid so a hole stays a hole.
 */

import type { TemporalStat } from "$lib/api/frontend/stats";

export const DAY_SECONDS = 86400;

/** A point whose value may be genuinely unknown. */
export type TemporalPoint = { x: number; y: number | null };

/**
 * Every calendar day covered by the dataset, plus the subset we actually have
 * observations for. A day missing from `observed` is a collection outage: no
 * series can say anything about it.
 */
export type DayGrid = {
  days: number[];
  observed: Set<number>;
};

/**
 * Build a contiguous daily grid from the days the crawler was seen running.
 * Input timestamps are epoch seconds at UTC midnight (`date_trunc('d', seen)`).
 */
export function buildDayGrid(observedDays: number[]): DayGrid {
  if (observedDays.length === 0) {
    return { days: [], observed: new Set() };
  }

  const observed = new Set(observedDays);
  const first = Math.min(...observedDays);
  const last = Math.max(...observedDays);

  const days: number[] = [];
  for (let day = first; day <= last; day += DAY_SECONDS) {
    days.push(day);
  }

  return { days, observed };
}

/**
 * How to read a day that the crawler observed but where this series has no row.
 *
 * - `zero`: counts. Nobody listed a server in this datacenter that day, which
 *   is a real zero and stacks correctly.
 * - `gap`: prices. No server of this shape existed, so there is no price to
 *   plot and the line has to break.
 *
 * A day nobody observed is a gap either way.
 */
export type MissingDay = "zero" | "gap";

/** Align a sparse series onto the shared grid. */
export function alignSeries(
  stats: TemporalStat[],
  grid: DayGrid,
  missing: MissingDay,
): TemporalPoint[] {
  if (grid.days.length === 0) return [];

  const byDay = new Map<number, number>();
  for (const { x, y } of stats) {
    if (y !== null && y !== undefined && Number.isFinite(y)) {
      byDay.set(x, y);
    }
  }

  return grid.days.map((day) => {
    const value = byDay.get(day);
    if (value !== undefined) return { x: day, y: value };
    if (!grid.observed.has(day)) return { x: day, y: null };
    return { x: day, y: missing === "zero" ? 0 : null };
  });
}

/**
 * Centered moving average over `window` points.
 *
 * Null-preserving on purpose: a gap in the input stays a gap in the output
 * (otherwise the average would quietly bridge exactly the holes we just made
 * visible), and a window that is more than half empty yields null rather than
 * an average of two stray points.
 */
export function movingAverage(
  points: TemporalPoint[],
  window = 7,
): TemporalPoint[] {
  const half = Math.floor(window / 2);
  const minSamples = Math.max(2, Math.ceil(window / 2));

  return points.map((point, i) => {
    if (point.y === null) return { x: point.x, y: null };

    let sum = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j++) {
      const neighbour = points[j];
      if (neighbour?.y !== null && neighbour?.y !== undefined) {
        sum += neighbour.y;
        count++;
      }
    }

    return { x: point.x, y: count >= minSamples ? sum / count : null };
  });
}

/**
 * Categorical palette, light and dark steps of the same eight hues. Validated
 * for colour-vision deficiency on adjacent pairs; the order is the safety
 * mechanism, so do not shuffle it.
 */
const CATEGORICAL_LIGHT = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
];

const CATEGORICAL_DARK = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
];

/**
 * A stable colour for the series at `index`.
 *
 * Past the eight validated slots we fall back to golden-angle hue rotation.
 * That is below the bar for a standalone categorical chart, but the series
 * that land there are the long tail of a stacked area with an index tooltip,
 * where being *stable* across renders matters more than being individually
 * nameable by colour.
 */
export function seriesColor(index: number, isDark = false): string {
  const palette = isDark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
  if (index < palette.length) return palette[index];

  const hue = ((index - palette.length) * 137.508) % 360;
  return isDark
    ? `hsl(${hue.toFixed(1)}, 55%, 62%)`
    : `hsl(${hue.toFixed(1)}, 62%, 45%)`;
}

/** Fade a hex or hsl colour for the de-emphasised raw line under an average. */
export function fadeColor(color: string, alpha: number): string {
  if (color.startsWith("hsl(")) {
    return `hsla(${color.slice(4, -1)}, ${alpha})`;
  }

  if (color.startsWith("#") && (color.length === 7 || color.length === 4)) {
    const step = color.length === 4 ? 1 : 2;
    const at = (i: number) => {
      const part = color.slice(1 + i * step, 1 + (i + 1) * step);
      return parseInt(part.length === 1 ? part + part : part, 16);
    };
    return `rgba(${at(0)}, ${at(1)}, ${at(2)}, ${alpha})`;
  }

  return color;
}
