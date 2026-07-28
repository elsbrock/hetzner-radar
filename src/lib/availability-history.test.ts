import { describe, it, expect } from "vitest";
import { availableFraction, bucketAvailability } from "./availability-history";

const HOUR = 3_600_000;

/** `count` bucket starts of `stepMs` each, beginning at `start`. */
function buckets(start: number, stepMs: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => start + i * stepMs);
}

describe("availableFraction", () => {
  const windowEnd = 10 * HOUR;

  it("should return 0 for an empty interval", () => {
    expect(availableFraction([{ t: 0, up: true }], HOUR, HOUR, windowEnd)).toBe(
      0,
    );
  });

  it("should hold the seed state across the whole interval", () => {
    expect(availableFraction([{ t: 0, up: true }], 0, HOUR, windowEnd)).toBe(1);
    expect(availableFraction([{ t: 0, up: false }], 0, HOUR, windowEnd)).toBe(
      0,
    );
  });

  it("should extend the final segment to the window end", () => {
    const points = [
      { t: 0, up: false },
      { t: 5 * HOUR, up: true },
    ];
    expect(availableFraction(points, 9 * HOUR, 10 * HOUR, windowEnd)).toBe(1);
  });

  it("should report the covered fraction of a partly available interval", () => {
    const points = [
      { t: 0, up: false },
      { t: 0.25 * HOUR, up: true },
      { t: 0.75 * HOUR, up: false },
    ];
    expect(availableFraction(points, 0, HOUR, windowEnd)).toBeCloseTo(0.5, 10);
  });

  it("should sum multiple available segments within one interval", () => {
    const points = [
      { t: 0, up: false },
      { t: 0.1 * HOUR, up: true },
      { t: 0.2 * HOUR, up: false },
      { t: 0.5 * HOUR, up: true },
      { t: 0.7 * HOUR, up: false },
    ];
    expect(availableFraction(points, 0, HOUR, windowEnd)).toBeCloseTo(0.3, 10);
  });
});

describe("bucketAvailability", () => {
  const stepMs = HOUR;
  const seedStart = 0;
  const windowEnd = 4 * HOUR;
  const starts = buckets(seedStart, stepMs, 4);

  it("should carry the seed state through a window with no transitions", () => {
    expect(
      bucketAvailability({
        buckets: starts,
        stepMs,
        seedStart,
        windowEnd,
        seed: true,
        events: [],
      }),
    ).toEqual([1, 1, 1, 1]);

    expect(
      bucketAvailability({
        buckets: starts,
        stepMs,
        seedStart,
        windowEnd,
        seed: false,
        events: [],
      }),
    ).toEqual([0, 0, 0, 0]);
  });

  it("should not infer the seed by inverting the first transition", () => {
    // A window that opens available and stays available until the third hour.
    // Inverting the first edge — the old heuristic — would have painted the
    // opening hours red.
    const values = bucketAvailability({
      buckets: starts,
      stepMs,
      seedStart,
      windowEnd,
      seed: true,
      events: [{ t: 2 * HOUR, up: false }],
    });

    expect(values).toEqual([1, 1, 0, 0]);
  });

  it("should tolerate a transition repeating the current state", () => {
    // Redundant edges are not toggles; state is absolute per event.
    const values = bucketAvailability({
      buckets: starts,
      stepMs,
      seedStart,
      windowEnd,
      seed: true,
      events: [
        { t: 1 * HOUR, up: true },
        { t: 3 * HOUR, up: false },
      ],
    });

    expect(values).toEqual([1, 1, 1, 0]);
  });

  it("should sort transitions that arrive out of order", () => {
    const values = bucketAvailability({
      buckets: starts,
      stepMs,
      seedStart,
      windowEnd,
      seed: false,
      events: [
        { t: 3 * HOUR, up: false },
        { t: 1 * HOUR, up: true },
      ],
    });

    expect(values).toEqual([0, 1, 1, 0]);
  });

  it("should render a short blip as a partly available bucket, not lasting uptime", () => {
    // Issue #286: stock appeared and vanished inside a single hour. The hourly
    // MAX() aggregation kept only the "became available" edge, so the chart
    // showed the pair available from that hour onward while the table — reading
    // the live snapshot — correctly showed it unavailable.
    const values = bucketAvailability({
      buckets: starts,
      stepMs,
      seedStart,
      windowEnd,
      seed: false,
      events: [
        { t: 1 * HOUR + 5 * 60_000, up: true },
        { t: 1 * HOUR + 20 * 60_000, up: false },
      ],
    });

    expect(values[0]).toBe(0);
    expect(values[1]).toBeCloseTo(0.25, 10); // 15 minutes of a 60 minute bucket
    expect(values[2]).toBe(0);
    expect(values[3]).toBe(0);
  });

  it("should clip the trailing bucket to the window end", () => {
    // Window ends halfway through the last bucket; a fully available tail must
    // still read as fully available rather than being diluted by the overhang.
    const shortEnd = 3.5 * HOUR;
    const values = bucketAvailability({
      buckets: starts,
      stepMs,
      seedStart,
      windowEnd: shortEnd,
      seed: true,
      events: [],
    });

    expect(values).toEqual([1, 1, 1, 1]);
  });

  describe("reconciliation with the live snapshot", () => {
    const events = [{ t: 1 * HOUR, up: true }];

    it("should correct a trailing bucket that contradicts the snapshot", () => {
      const values = bucketAvailability({
        buckets: starts,
        stepMs,
        seedStart,
        windowEnd,
        seed: false,
        events,
        reconcileTo: false,
      });

      // Reconstruction says available to the end; the snapshot says otherwise,
      // so a transition never reached the dataset.
      expect(values[values.length - 1]).toBe(0);
      // Earlier history is measured, not inferred, and stays untouched.
      expect(values.slice(0, -1)).toEqual([0, 1, 1]);
    });

    it("should leave a trailing bucket that agrees with the snapshot", () => {
      const values = bucketAvailability({
        buckets: starts,
        stepMs,
        seedStart,
        windowEnd,
        seed: false,
        events,
        reconcileTo: true,
      });

      expect(values).toEqual([0, 1, 1, 1]);
    });

    it("should leave a partly available trailing bucket alone", () => {
      // Consistent with either snapshot state, so there is nothing to correct.
      const values = bucketAvailability({
        buckets: starts,
        stepMs,
        seedStart,
        windowEnd,
        seed: false,
        events: [{ t: 3.5 * HOUR, up: true }],
        reconcileTo: false,
      });

      expect(values[values.length - 1]).toBeCloseTo(0.5, 10);
    });

    it("should not reconcile when no snapshot covers the row", () => {
      const values = bucketAvailability({
        buckets: starts,
        stepMs,
        seedStart,
        windowEnd,
        seed: false,
        events,
        reconcileTo: null,
      });

      expect(values[values.length - 1]).toBe(1);
    });
  });
});
