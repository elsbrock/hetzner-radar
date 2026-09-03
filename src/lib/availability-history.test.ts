import { describe, it, expect } from "vitest";
import {
  availableFraction,
  bucketAvailability,
  resolveSeed,
} from "./availability-history";

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

describe("resolveSeed", () => {
  it("should prefer the transition resolved from before the window", () => {
    expect(
      resolveSeed({
        fromHistory: false,
        firstEvent: { t: 0, up: false },
        fromSnapshot: true,
      }),
    ).toBe(false);
  });

  it("should invert the first in-window transition when no seed was found", () => {
    // cax21/fsn1: unavailable since May, so the seed query found nothing within
    // its lookback, and the only event in the 30d window is "became available".
    // Trusting the snapshot here painted the whole month green (#287).
    expect(
      resolveSeed({
        firstEvent: { t: 1_000, up: true },
        fromSnapshot: true,
      }),
    ).toBe(false);
  });

  it("should fall back to the snapshot only for a window with no transitions", () => {
    expect(resolveSeed({ fromSnapshot: true })).toBe(true);
    expect(resolveSeed({ fromSnapshot: false })).toBe(false);
  });

  it("should assume unavailable when nothing is known", () => {
    expect(resolveSeed({})).toBe(false);
    expect(resolveSeed({ fromSnapshot: null })).toBe(false);
  });

  it("should treat a null resolved transition as absent, not as unavailable", () => {
    // `fromHistory` follows the module's `boolean | null` idiom, so null means
    // "the query found nothing" and must fall through rather than seed false.
    expect(
      resolveSeed({
        fromHistory: null,
        firstEvent: { t: 1_000, up: false },
      }),
    ).toBe(true);
  });
});

describe("a window whose seed predates Analytics Engine retention", () => {
  it("should stay unavailable until the transition that made it available", () => {
    // The #287 shape: a 30-day window over a pair that went unavailable months
    // earlier (so the seed query returns nothing) and became available a third
    // of the way in. Everything before that transition must read unavailable.
    const stepMs = HOUR;
    const seedStart = 0;
    const windowEnd = 30 * HOUR;
    const becameAvailable = 10 * HOUR;

    const values = bucketAvailability({
      buckets: buckets(seedStart, stepMs, 30),
      stepMs,
      seedStart,
      windowEnd,
      seed: resolveSeed({
        fromHistory: undefined,
        firstEvent: { t: becameAvailable, up: true },
        fromSnapshot: true, // the live snapshot: available *now*
      }),
      events: [{ t: becameAvailable, up: true }],
      reconcileTo: true,
    });

    expect(values.slice(0, 10)).toEqual(Array(10).fill(0));
    expect(values.slice(10)).toEqual(Array(20).fill(1));
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
