/**
 * Reconstruction of cloud availability over time from a sparse transition
 * stream.
 *
 * `cloud_availability_v2` records *state changes only*, so rendering a window
 * means replaying those edges as a step function rather than reading samples.
 * The subtleties that make this worth isolating (and testing):
 *
 * - the state entering the window comes from outside it, so it has to be
 *   resolved deliberately (see `resolveSeed`) rather than assumed;
 * - a bucket is usually only partly available, so cells carry an occupancy
 *   fraction rather than a boolean.
 */

/** A single availability transition: the state became `up` at time `t` (ms). */
export interface AvailabilityChangePoint {
  t: number;
  up: boolean;
}

export interface BucketAvailabilityOptions {
  /** Bucket start times in ms, ascending, each `stepMs` apart. */
  buckets: number[];
  stepMs: number;
  /** Window bounds in ms. The final bucket is clipped to `windowEnd`. */
  seedStart: number;
  windowEnd: number;
  /** State in effect at `seedStart`. */
  seed: boolean;
  /** Transitions inside the window; need not be sorted. */
  events: AvailabilityChangePoint[];
  /**
   * Live snapshot state to reconcile the trailing bucket against, or `null`
   * when no snapshot covers this row (or the window is not the live one).
   *
   * Only a *saturated* contradiction is corrected: a trailing bucket that reads
   * fully available while the snapshot says unavailable (or vice versa) can only
   * mean a transition never reached the dataset. A partially available bucket is
   * consistent with a snapshot in either state and is left as measured.
   */
  reconcileTo?: boolean | null;
}

export interface SeedResolutionOptions {
  /**
   * State established by the last transition *before* the window, when the
   * history query found one. Authoritative whenever it is present.
   */
  fromHistory?: boolean;
  /**
   * Earliest transition inside the window, if the window holds any.
   */
  firstEvent?: AvailabilityChangePoint;
  /**
   * State from the live snapshot, or `null` when no snapshot covers this row
   * (or the window being rendered is not the live one).
   */
  fromSnapshot?: boolean | null;
}

/**
 * The state a window opens in, in descending order of authority.
 *
 * 1. The transition resolved from before the window — it says so directly.
 * 2. Otherwise the inverse of the window's first transition. The dataset holds
 *    only genuine state *changes*, so "the first thing that happened here was
 *    becoming available" can only mean the window opened unavailable.
 * 3. Otherwise the live snapshot. With no transition either side of the window
 *    boundary, nothing has changed and the snapshot is exactly that unchanged
 *    state. This is the *last* resort: reaching for it while the window does
 *    hold transitions paints the state *after* them across everything before,
 *    which is how a pair unavailable since May rendered as available all month.
 * 4. Otherwise unavailable, rather than inventing uptime.
 */
export function resolveSeed(options: SeedResolutionOptions): boolean {
  const { fromHistory, firstEvent, fromSnapshot = null } = options;

  if (fromHistory !== undefined) return fromHistory;
  if (firstEvent) return !firstEvent.up;
  return fromSnapshot ?? false;
}

/**
 * Fraction of [a, b) during which `changePoints` is in the available state.
 * `changePoints` must be sorted ascending and start at or before `a`.
 */
export function availableFraction(
  changePoints: AvailabilityChangePoint[],
  a: number,
  b: number,
  windowEnd: number,
): number {
  if (b <= a) return 0;
  let up = 0;
  for (let i = 0; i < changePoints.length; i++) {
    if (!changePoints[i].up) continue;
    const segStart = changePoints[i].t;
    const segEnd =
      i + 1 < changePoints.length ? changePoints[i + 1].t : windowEnd;
    up += Math.max(0, Math.min(segEnd, b) - Math.max(segStart, a));
  }
  return up / (b - a);
}

/**
 * Uptime fraction per bucket for one entity, in bucket order.
 */
export function bucketAvailability(
  options: BucketAvailabilityOptions,
): number[] {
  const {
    buckets,
    stepMs,
    seedStart,
    windowEnd,
    seed,
    events,
    reconcileTo = null,
  } = options;

  const changePoints: AvailabilityChangePoint[] = [
    { t: seedStart, up: seed },
    ...events.slice().sort((p, q) => p.t - q.t),
  ];

  const values = buckets.map((bStart) =>
    availableFraction(
      changePoints,
      bStart,
      Math.min(bStart + stepMs, windowEnd),
      windowEnd,
    ),
  );

  if (reconcileTo !== null && values.length > 0) {
    const target = reconcileTo ? 1 : 0;
    if (values[values.length - 1] === 1 - target)
      values[values.length - 1] = target;
  }

  return values;
}
