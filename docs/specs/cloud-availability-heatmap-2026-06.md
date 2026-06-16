# Cloud Availability Heatmap — Library-backed rewrite (June 2026)

## Intent

The `/cloud-status` availability history chart is a hand-rolled CSS-grid heatmap
(`CloudAvailabilityChart.svelte`, ~500 lines). Two problems:

1. **Binary green/red, useless on long ranges.** Each cell is "available if up at
   any instant in the bucket". For the 30-day view (daily buckets), a type up for
   one minute shows fully green — the binary collapse hides everything.
2. **Buggy/fragile.** State is reconstructed from transition events by inverting
   the first event and forward-filling. Correct in principle, but the edge-case
   handling (initial state before the first event, rows with no events) is brittle.

Replace the hand-rolled grid with a **chart.js matrix** (the app already uses
chart.js via `GenericChart`/`ServerPriceChart`), and shade each cell by a
**time-weighted uptime fraction** instead of binary state.

## Key constraint: the data is event-based, not sampled

Analytics Engine (`cloud_availability_v2`) is written **only on availability
changes** (`worker/src/notification-service.ts:49`): `double1 = 1` on a
transition-to-available, `0` on transition-to-unavailable. There is **no
per-minute heartbeat**. Consequences:

- `AVG(double1)` is NOT a real uptime rate (it averages sparse transition
  markers). A true per-bucket uptime fraction must be computed by **integrating
  the step function** defined by the transitions over each bucket — client-side,
  from the same event stream we already fetch.
- The existing worker query (`MAX(double1)` grouped by bucket) and summary
  (`SUM/COUNT` "availabilityPercentage") stay as-is for now; this change is
  frontend-only and derives shading from the raw change events already returned.

## Architecture

- **No worker/API changes.** `/api/cloud-status/history` keeps returning change
  events (`{timestamp, serverTypeId, locationId, available, ...}`). The frontend
  already receives one row per change.
- **New dependency:** `chartjs-chart-matrix` (matrix chart type for chart.js v4).
  Registered locally in the chart component, not globally.
- **Rewrite `CloudAvailabilityChart.svelte`:**
  - Keep: data fetch, `generateBuckets()`, `expectedEntities()`, event ingestion,
    range banner, granularity handling.
  - Replace: the binary per-bucket cell value and the CSS-grid DOM with a matrix
    dataset `{x: bucketIndex|time, y: entityLabel, v: uptimeFraction}` rendered on
    a canvas.
  - **Uptime fraction per bucket:** build a per-entity step function from sorted
    transitions (seed pre-window state from the inverse of the first event, or the
    current snapshot for event-less rows — same seeding rule as today). For each
    bucket `[t0, t1)`, integrate the fraction of time `available`. Event-less
    buckets inherit the carried state (fraction 0 or 1), preserving today's
    behavior at the extremes.
  - **Color scale:** continuous from "mostly out" → "high uptime". Reuse the
    existing green/red hues so the legend stays familiar (e.g. red `v=0` →
    amber `v≈0.5` → green `v=1`), with dark-mode variants. Keep a discrete legend.
  - **Tooltip:** entity label, bucket time range, uptime %.

## Decisions & trade-offs

- **Matrix plugin over an aggregate % line.** The user wants to keep per-entity
  (type × time / location × time) detail; an aggregate trend line would lose it.
  Cost: one small new dependency (`chartjs-chart-matrix`).
- **Frontend-only shading, no heartbeat write.** Computing uptime from events is
  exact and avoids a high-volume Analytics Engine heartbeat (server_types ×
  locations × every minute). If event density ever proves insufficient, revisit a
  sampled write in a separate change.
- **Keep current granularity mapping** (24h/7d → hourly buckets, 30d → daily).
  Shading is what makes daily buckets useful; bucket sizes don't need to change.

## Implementation steps

- [x] Add `chartjs-chart-matrix` dependency (3.0.4; peer chart.js >=3, ours 4.5.1).
- [x] Extract uptime-fraction-per-bucket from the step function (replace the
      binary forward-fill in `buildHeatmap` → `buildMatrix`).
- [x] Rewrite the render layer as a chart.js matrix on a canvas (register
      `MatrixController`/`MatrixElement` locally); wire color scale + tooltip.
- [x] **Always fetch hourly**, integrate to the display bucket size. The API
      pre-buckets with `MAX` at the requested granularity, so requesting 'day'
      would collapse sub-day detail. Hourly fetch + client integration yields a
      real daily uptime fraction (verified: 35% of 30d daily cells are partial on
      live fsn1 data, vs. 100% binary before).
- [x] Preserve empty/loading/error states, range banner, legend, dark mode
      (axis colors matched to `GenericChart`), responsiveness (legend wraps).
- [x] `npm run check` clean; `npm run build` clean; uptime math unit-checked;
      real API shape + shading verified via CDP against production data.
- [x] Live visual verification: rendered the real chart.js matrix with live
      production data (fsn1, 30d) at desktop (1280px) and mobile (375px) in both
      themes. Confirmed shading, row labels, and date axis. Fixed a layout bug
      found here — see below.
- [x] Changelog entry (noteworthy feature).

## Layout fix (found during visual verification)

The first matrix config used a `time` x-axis and computed cell width via
`scales.x.getPixelForValue(x + stepMs) - getPixelForValue(x)`. That pixel math
fed back into the chart's layout fit and collapsed the y-axis label gutter at
wide viewports, so the server-type row labels disappeared on desktop (but showed
on mobile). Fixed by switching to a **linear bucket-index x-axis** with
date-formatted ticks (via a tick `callback`) and deriving cell width/height from
`chartArea` + column/row counts — the canonical, layout-stable matrix recipe.

## Notes / follow-ups

- The worker's `MAX(double1)` bucketing still loses multiple transitions inside a
  single hour. Hourly is fine for these views; if finer fidelity is ever needed,
  consider a sampled heartbeat write (cost trade-off noted above).
- The summary query's `SUM/COUNT` "availabilityPercentage" averages transition
  events and is likely inaccurate — separate cleanup, not in scope here.

```

```
