import { describe, expect, it } from "vitest";
import {
  DAY_SECONDS,
  alignSeries,
  buildDayGrid,
  fadeColor,
  movingAverage,
  seriesColor,
  type TemporalPoint,
} from "./chartSeries";

const DAY0 = 1_760_832_000; // 2025-10-19T00:00:00Z
const day = (n: number) => DAY0 + n * DAY_SECONDS;

describe("buildDayGrid", () => {
  it("fills the calendar between the first and last observed day", () => {
    const grid = buildDayGrid([day(0), day(3)]);
    expect(grid.days).toEqual([day(0), day(1), day(2), day(3)]);
  });

  it("remembers which days were actually observed", () => {
    const grid = buildDayGrid([day(0), day(3)]);
    expect(grid.observed.has(day(0))).toBe(true);
    expect(grid.observed.has(day(1))).toBe(false);
  });

  it("tolerates unsorted input", () => {
    const grid = buildDayGrid([day(2), day(0), day(1)]);
    expect(grid.days).toEqual([day(0), day(1), day(2)]);
  });

  it("returns an empty grid for no data", () => {
    expect(buildDayGrid([])).toEqual({ days: [], observed: new Set() });
  });
});

describe("alignSeries", () => {
  const grid = buildDayGrid([day(0), day(1), day(3)]); // day 2 is an outage

  it("zero-fills observed days a count series is absent from", () => {
    const aligned = alignSeries([{ x: day(0), y: 5 }], grid, "zero");
    expect(aligned).toEqual([
      { x: day(0), y: 5 },
      { x: day(1), y: 0 },
      { x: day(2), y: null },
      { x: day(3), y: 0 },
    ]);
  });

  it("breaks a price series on observed days it is absent from", () => {
    const aligned = alignSeries([{ x: day(0), y: 1.5 }], grid, "gap");
    expect(aligned).toEqual([
      { x: day(0), y: 1.5 },
      { x: day(1), y: null },
      { x: day(2), y: null },
      { x: day(3), y: null },
    ]);
  });

  it("never invents a value for an unobserved day, even for counts", () => {
    const aligned = alignSeries(
      [
        { x: day(0), y: 5 },
        { x: day(3), y: 7 },
      ],
      grid,
      "zero",
    );
    expect(aligned[2]).toEqual({ x: day(2), y: null });
  });

  it("drops non-finite values coming back from SQL divisions", () => {
    const aligned = alignSeries(
      [
        { x: day(0), y: Number.NaN },
        { x: day(1), y: 2 },
      ],
      grid,
      "gap",
    );
    expect(aligned[0].y).toBeNull();
    expect(aligned[1].y).toBe(2);
  });

  it("returns nothing when there is no grid", () => {
    expect(alignSeries([{ x: day(0), y: 1 }], buildDayGrid([]), "gap")).toEqual(
      [],
    );
  });
});

describe("movingAverage", () => {
  const flat = (n: number, value: number): TemporalPoint[] =>
    Array.from({ length: n }, (_, i) => ({ x: day(i), y: value }));

  it("leaves a constant series unchanged", () => {
    const smoothed = movingAverage(flat(14, 10), 7);
    for (const point of smoothed) expect(point.y).toBeCloseTo(10);
  });

  it("damps a single spike", () => {
    const points = flat(14, 10);
    points[7] = { x: day(7), y: 80 };
    const smoothed = movingAverage(points, 7);
    expect(smoothed[7].y).toBeCloseTo(20); // (6*10 + 80) / 7
    expect(smoothed[0].y).toBeCloseTo(10); // spike out of range
  });

  it("keeps gaps as gaps instead of bridging them", () => {
    const points = flat(14, 10);
    points[7] = { x: day(7), y: null };
    expect(movingAverage(points, 7)[7].y).toBeNull();
  });

  it("skips nulls inside the window rather than counting them as zero", () => {
    const points = flat(14, 10);
    points[6] = { x: day(6), y: null };
    expect(movingAverage(points, 7)[7].y).toBeCloseTo(10);
  });

  it("yields null when the window is more than half empty", () => {
    const points = flat(14, 10);
    for (let i = 0; i < 14; i++)
      if (i !== 7) points[i] = { x: day(i), y: null };
    expect(movingAverage(points, 7)[7].y).toBeNull();
  });

  it("preserves the x axis", () => {
    const points = flat(5, 3);
    expect(movingAverage(points, 7).map((p) => p.x)).toEqual(
      points.map((p) => p.x),
    );
  });
});

describe("seriesColor", () => {
  it("is stable across calls", () => {
    expect(seriesColor(3)).toBe(seriesColor(3));
  });

  it("gives the first eight slots distinct palette hues", () => {
    const colors = Array.from({ length: 8 }, (_, i) => seriesColor(i));
    expect(new Set(colors).size).toBe(8);
  });

  it("keeps generating distinct colours past the palette", () => {
    const colors = Array.from({ length: 30 }, (_, i) => seriesColor(i));
    expect(new Set(colors).size).toBe(30);
  });

  it("uses different steps for dark mode", () => {
    expect(seriesColor(0, true)).not.toBe(seriesColor(0, false));
  });
});

describe("fadeColor", () => {
  it("converts hex to rgba", () => {
    expect(fadeColor("#2a78d6", 0.35)).toBe("rgba(42, 120, 214, 0.35)");
  });

  it("expands shorthand hex", () => {
    expect(fadeColor("#abc", 0.5)).toBe("rgba(170, 187, 204, 0.5)");
  });

  it("converts hsl to hsla", () => {
    expect(fadeColor("hsl(137.5, 62%, 45%)", 0.35)).toBe(
      "hsla(137.5, 62%, 45%, 0.35)",
    );
  });

  it("passes anything else through", () => {
    expect(fadeColor("rgba(1, 2, 3, 1)", 0.35)).toBe("rgba(1, 2, 3, 1)");
  });
});
