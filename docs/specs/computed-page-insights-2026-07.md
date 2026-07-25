# Computed page insights (July 2026)

**Status:** implemented (not yet deployed)
**Date:** 2026-07-25

## Intent

Add a short block of prose to data-heavy pages that states things the page's own
data proves, e.g. "CAX (ARM) types are offered only in Falkenstein, Nuremberg and
Helsinki." The goal is twofold: give a visitor the takeaway they'd otherwise have
to derive by reading a 16×6 grid, and give search engines and AI answer engines
something quotable that only this site can produce.

This is explicitly **not** an SEO copy block. The failure mode we are avoiding is
the familiar one: a paragraph of generic prose bolted under a tool ("Hetzner
offers a range of dedicated servers to suit every workload…"). That text restates
nothing, ages badly, and is discounted as thin content. Every sentence here must
be **computed from data the page already loaded**, or it does not ship.

## Key constraint: it has to be server-rendered

Text that only appears after client-side JS has run is worth little for search
and nothing for the AI crawlers that don't execute scripts. That decides which
pages are in scope:

| Page              | Data source                                   | In scope           |
| ----------------- | --------------------------------------------- | ------------------ |
| `/cloud-status`   | `+page.server.ts` → worker RPC (`getStatus`)  | **yes**            |
| `/configurations` | `+page.server.ts` → D1 `current_auctions`     | **yes**            |
| `/statistics`     | client-side DuckDB WASM (`withDbConnections`) | **no** — see below |

`/statistics` has no `+page.server.ts`; every number on it is computed in the
browser from the DuckDB file. Adding insight text there would either be invisible
to crawlers or require a new server-side aggregate (another D1 query path, or a
precomputed summary written by the worker). That is a separate piece of work and
is deliberately deferred rather than done badly.

## Architecture

- One small component, `PageInsights.svelte`: renders a heading-less block of 2–4
  short sentences plus an optional definition line. No props beyond
  `insights: string[]` and an optional `note`. It renders **nothing** when the
  list is empty.
- Per-page pure functions that turn already-loaded data into sentences, colocated
  with the page (`insights.ts` next to `+page.server.ts`) so they are unit
  testable without a browser.
- Called from the existing `load` (no new queries on `/cloud-status`; on
  `/configurations` reuse the rows already fetched for the six categories).
- Rendered **below** the interactive content, above the footer CTA, so it never
  pushes the tool down the page.

### `/cloud-status` insights (from `statusData`)

Computed from `serverTypes`, `locations`, `supported`, `availability`,
`lastSeenAvailable` — all already in the load:

- Architecture/geography rule: which locations offer ARM at all.
- Current scarcity: the type available in the fewest locations right now.
- Best and worst location by share of supported types in stock.
- Anything currently out everywhere (strong signal, only if it occurs).
- Definition line: supported vs. available — the one genuinely non-obvious thing
  about the page.

Each sentence is emitted only when its precondition holds; a quiet day yields
fewer sentences rather than filler.

### `/configurations` insights (from the six category result sets)

- Entry price: cheapest configuration currently listed, with its spec.
- Value spread: best €/core and best €/TB figures from the existing rows.
- ECC share and GPU count (`gpuServerCount` is already loaded).
- Freshness: `lastUpdatedAt` restated in words.

## Decisions & trade-offs

- **Computed only.** No hand-written sentence survives a data change; every
  sentence carries a number or a name derived at request time. If the data needed
  for a sentence is missing, the sentence is dropped.
- **No FAQPage schema.** FAQ rich results were withdrawn for almost all sites in
  2023; marking this block up as an FAQ would add maintenance for no gain.
  `/cloud-status` already ships `Dataset` JSON-LD, which is the correct fit and
  stays as is.
- **Cap at four sentences.** Long enough to be substantive, short enough that it
  cannot become a keyword dump. Enforced by the generator, not by convention.
- **Below the tool, not above.** The interactive grid is why people come; the
  prose is a bonus.
- **`/statistics` deferred**, with the reason recorded above, rather than shipping
  client-rendered text and calling it an SEO win.

## Implementation steps

- [x] `PageInsights.svelte` (renders nothing when empty; responsive; dark mode).
- [x] `src/routes/cloud-status/insights.ts` — pure functions over `CloudStatusData`.
- [x] Wire into `/cloud-status` load + template, below the grid.
- [x] `src/routes/configurations/insights.ts` — pure functions over the loaded rows.
- [x] Wire into `/configurations` load + template.
- [x] Unit tests for both generators (14 cases), including the empty/degraded-data cases.
- [x] `npm run check` clean; `npm run lint` clean for all touched files (two
      unrelated spec files were already failing `prettier --check` on `main`).
- [ ] Decide separately whether `/statistics` gets a server-side aggregate.

## Verification notes

- `/cloud-status`: verified server-rendered against a local fixture — the
  sentences appear in the initial HTML, not just the hydration payload.
- `/configurations`: only the **empty** path was verified in a browser, because
  the local D1 has no `current_auctions` rows (the worker's advertised
  `POST /auction/import` HTTP route is not actually wired — the DO replies "This
  DO is accessed via RPC only", so local inventory can't be populated that way).
  The populated path is covered by unit tests instead. Worth an eyeball once it
  is on a environment with real auction data.
