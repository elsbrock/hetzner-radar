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

- [ ] Add `chartjs-chart-matrix` dependency; confirm chart.js v4 compatibility.
- [ ] Extract uptime-fraction-per-bucket from the step function (replace the
      binary forward-fill in `buildHeatmap`).
- [ ] Rewrite the render layer as a chart.js matrix on a canvas (register
      `MatrixController`/`MatrixElement` locally); wire color scale + tooltip.
- [ ] Preserve empty/loading/error states, range banner, legend, dark mode,
      responsiveness, and horizontal fit for 168 hourly buckets (7d).
- [ ] `npm run check` clean; manual verify 24h/7d/30d in both view modes and
      both themes via the live app.
- [ ] Changelog entry (noteworthy feature).
```
