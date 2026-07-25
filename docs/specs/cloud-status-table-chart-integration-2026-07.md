# Cloud Status: drive the availability heatmap from the table (July 2026)

**Status:** implemented (not yet deployed)
**Date:** 2026-07-25

## Intent

`/cloud-status` renders the same two axes twice, disconnected:

1. The **table** — a location × server-type grid of current status (available /
   supported-but-out / unsupported) plus a "last seen available" timestamp.
2. The **Availability Patterns** section further down — a chart.js matrix heatmap
   (`CloudAvailabilityChart.svelte`) whose scope is chosen with its _own_ "View by
   Location / Server Type" toggle and a dropdown, duplicating axes the user is
   already pointing at in the table.

The user has to re-select in a dropdown what they were just looking at in the
grid, then scroll away from the grid to see it. Make the **table the selector**:
click a row, a column, or a cell to turn on the historic view for that scope.

Explicit non-goal: **the chart itself does not change.** It stays the chart.js
matrix heatmap (GitHub-contributions style) with the same time-weighted uptime
shading, tooltip and legend from
[`cloud-availability-heatmap-2026-06.md`](./cloud-availability-heatmap-2026-06.md).
Only _how its scope is chosen_ and _where it renders_ change. In particular this
spec rejects the alternative of pushing per-cell sparklines into the grid — it
would replace the heatmap rather than integrate it, and it triples cell height.

## Architecture

### Three click targets → three scopes

| Click target                         | Scope        | Heatmap rows      | Question answered                  |
| ------------------------------------ | ------------ | ----------------- | ---------------------------------- |
| Server-type row label (`CPX11`)      | `serverType` | every location    | Where can I get this type?         |
| Location column header (`Nuremberg`) | `location`   | every server type | What's available at this location? |
| Body cell (`Nuremberg` × `CPX11`)    | `pair`       | one row           | When was _this_ combination up?    |

`serverType` and `location` are the chart's existing `viewMode`s. `pair` is new:
it fetches with **both** `serverTypeId` and `locationId` and renders a single
matrix row — same 84 buckets, same shading, just one row tall.

### Placement

The chart moves out of its standalone section into a panel rendered **directly
below the table**, inside the same bordered container so the two read as one
unit. The panel only exists once a scope is selected; before that, a hint line
under the table says the row/column/cell are clickable.

Panel header carries the scope label ("Nuremberg, DE · availability history"),
the existing 24h/7d/30d `ButtonGroup`, and a close (×) control. The old
"View by" toggle and the two `Select`s are deleted — the table replaces them.
`serverTypeOptions` / `locationOptions` stay, because `CloudAlertModal` uses them.

### Selection feedback

The clicked row/column/cell is outlined rather than tinted: body cells already
use background colour to encode status (green/red/gray), so a background-based
selection would fight it. Use a ring/outline in the accent colour plus a subtle
bold on the corresponding header.

### Interaction details

- Clicking the active target again clears the scope (toggle), as does ×.
- Unsupported cells are **not** clickable — there is no availability history for
  a pair that was never offered. Row labels and column headers are always
  clickable.
- Targets are real `<button>`s so keyboard and screen-reader users get the same
  affordance; the existing per-cell `Tooltip` components keep their ids.
- On selection the panel is scrolled into view with `block: 'nearest'`, which is
  a no-op when it's already visible (the common case, since it sits right under
  the table).

### Deep linking

The page already syncs filters to the query string. Add:

- `hist=loc:2` → location scope
- `hist=st:45` → server-type scope
- `hist=st:45,loc:2` → pair scope
- `range=24h|7d|30d` (only when not the `7d` default)

Parsed on load the same way the existing filter params are, so a historic view
is shareable.

## Decisions & trade-offs

- **Why not per-cell sparklines?** Considered and rejected: it deletes the
  heatmap instead of integrating it, needs an unfiltered bulk history query, and
  makes an already-wide table taller and denser on mobile.
- **Why not an inline expanding row?** A table can expand a row but not a
  column, so "what's available at this location" would need a second, different
  affordance. A single panel below the table serves all three scopes uniformly.
- **Why keep the standalone chart component?** No changes to its rendering,
  fetch, bucketing or uptime maths — only a new `viewMode`. The 2026-06 rewrite's
  layout fix (linear bucket-index x-axis, `chartArea`-derived cell size) must not
  be disturbed.
- **Pair scope is one row, not a line chart.** Consistency: same visual grammar
  as the other two scopes, and the uptime shading carries information a binary
  up/down line would drop.

## Implementation steps

- [x] Spec.
- [x] `CloudAvailabilityChart.svelte`: add `viewMode: 'pair'` — fetch with both
      ids, single expected entity, label from server type + location, range
      banner unchanged.
- [x] `+page.svelte`: replace the pattern selectors with derived state driven by
      a single `histScope` (`{kind, serverTypeId?, locationId?}`).
- [x] Make row labels, column headers and supported cells `<button>` click
      targets that set/toggle `histScope`.
- [x] Selection highlighting for the active row / column / cell.
- [x] Render the chart panel directly under the table with scope label, time
      range toggle and close control; hint line when nothing is selected.
- [x] `hist`, `range` and `off` URL params wired into the existing sync effect.
- [x] `npm run check` and `npm run lint` clean.
- [x] Visual verification of the reworked layout (reviewed by the author in a
      browser). Per-scope screenshots at each breakpoint were not captured.
- [ ] Changelog entry (noteworthy feature).

## Follow-on changes (same pass)

Requested while implementing, and part of this work:

- **Frameless layout.** The map/filters/table card lost its border, shadow and
  rounded frame; the sections now sit on the page separated by hairlines, and the
  block runs to `max-w-[110rem]` instead of being trapped in the page's prose
  column. The `inline-block` table wrapper is gone, so the grid fills the width
  and only scrolls horizontally when the columns genuinely don't fit.
- **Single-line filter bar** at `xl` and up (`flex-nowrap`, `w-auto` selects,
  shorter toggle labels), still wrapping below that.
- **Prev/next interval** on the heatmap: `onNavigate` + `canGoBack`/`canGoForward`
  props, with the page owning the offset. Back is bounded by the ~30 days of
  retained transitions (29 steps at 24h, 3 at 7d, 0 at 30d); the banner drops its
  "Last " prefix once the window is no longer live.
- **Tooltip states the bucket's full span** rather than only its start, since
  buckets are sub-day at every range.
