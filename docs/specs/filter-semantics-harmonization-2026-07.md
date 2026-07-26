# Filter semantics harmonization

**Status:** harness, package and fixes landed; IR staged (see Implementation steps)
**Date:** 2026-07-26

## Intent

One question — _"does this server match this filter?"_ — is currently answered by
three independent implementations, plus a fourth module that encodes into the
shared filter format. They are kept in agreement by hand, via comments. They have
drifted before, silently, and shipped user-visible bugs.

This spec makes the agreement mechanical: **one predicate specification, three
emitters**, with a conformance harness that fails CI when any two disagree.

Explicit non-goal: unifying the _runtimes_. See "Why not one matcher" below.

## Current state

| Implementation                                         | Substrate       | Surface                     |
| ------------------------------------------------------ | --------------- | --------------------------- |
| `src/lib/api/frontend/filter.ts` `generateFilterQuery` | DuckDB WASM SQL | Analyze page, alert preview |
| `worker/src/alert-service.ts` `MATCH_ALERTS_SQL`       | D1 / SQLite SQL | what actually fires alerts  |
| `src/lib/server/mcp/search.ts` `matchesQuery`          | in-memory TS    | MCP `search_auctions`       |
| `src/lib/server/mcp/filter.ts` `buildServerFilter`     | encoder         | MCP alert creation          |

Shared semantics re-derived independently in each: 500 GB per disk-slider unit,
RAM as log2(GB), `FSN`/`NBG`/`HEL` as prefix matches, per-disk vs. total sizing,
AND/OR disk combination, tri-state extras, default count ranges
(`[0,8]`/`[0,4]`/`[0,15]`).

### History

`docs/specs/alert-disk-matching-fix-2026-06.md` documents four simultaneous
divergences found only after two user bug reports: a 250-vs-500 GB multiplier
split for six months, size filters skipped when a count slider sat at its `0`
default, `total` mode entirely unimplemented in the worker, and datacenter city
prefixes matched exactly so every city-level alert **silently never fired**. That
spec deferred the conformance harness and named it "the real insurance against
future drift". Since then the MCP server added two more implementations.

## Why not one matcher

The three substrates are not accidental duplication — each is a deliberate and
correct cost decision:

- **Browser DuckDB** — free client compute, instant filtering over 3 months of
  history, zero marginal server cost per user.
- **D1 SQL** — matches all alerts against all auctions set-based in a single
  query. A per-alert loop over a shared matcher would be dramatically worse.
- **KV snapshot + in-memory** (`search.ts`: "no query planner, no D1 rows read")
  — same instinct applied to MCP.

Collapsing these into one runtime would spend money on every surface to fix a
correctness problem. What is duplicated is not the execution — it is the
predicate tree. So we unify the specification and keep all three runtimes.

## Architecture

### Symbolic IR

The critical constraint: the worker does **not** have a concrete `ServerFilter`
at query-build time. It matches every alert in one statement, reading filter
values out of JSON inside SQL (`json_extract(pa.filter, '$.field')`). An IR built
from a concrete filter would force one query per alert — precisely the cost
regression we are avoiding.

So the IR is built **once, symbolically**, over operands that each emitter
resolves in its own way:

```ts
type Operand =
  | { src: "const"; value: number | string | boolean | null }
  | { src: "filter"; path: string } // a ServerFilter field
  | { src: "row"; column: string }; // an auction column
```

| Operand  | DuckDB emitter   | SQLite emitter                      |
| -------- | ---------------- | ----------------------------------- |
| `filter` | inlined literal  | `json_extract(pa.filter, '$.path')` |
| `row`    | column reference | column reference                    |

A `switch` node covers filter-value-dependent branching (`sizeMode`, `diskMode`,
OR-mode activity tests). The DuckDB emitter **evaluates the discriminant at build
time** and emits only the taken branch, reproducing today's compact output; the
SQLite emitter renders a `CASE WHEN`. Identical semantics, both cost profiles
preserved.

### Correction: two emitters, not three

The original sketch had a third emitter for MCP's `matchesQuery`. That is wrong.
`matchesQuery` consumes `AuctionQuery`, which is a strictly **larger** schema than
`ServerFilter` — it supports substring CPU match, total drive count across types,
Geekbench multi-core score, and price, none of which `ServerFilter` can express
(they are listed in `SEARCH_ONLY_KEYS` and deliberately stripped from the
`create_alert` schema for exactly that reason). Routing MCP search through the IR
would silently narrow search to what an alert can represent.

So the IR covers the two implementations that genuinely are line-for-line
reimplementations of one another — `generateFilterQuery` (DuckDB) and
`MATCH_ALERTS_SQL` (SQLite). MCP search keeps its own matcher and is instead
pinned by the second conformance pass, which compares `matchesQuery(auction, q)`
against the filter `buildServerFilter(q)` produces for the same query. That
catches encoder drift without constraining the search surface.

### Representation differences are declared once

The per-disk clause is the canonical example — three spellings of one fact:

- DuckDB: `array_length(array_filter(d, x -> x >= lo AND x <= hi)) = array_length(d)`
- SQLite (no array type): `count = 0 OR (min_drive >= lo AND max_drive <= hi)`
- TS: `drives.every(d => d >= lo && d <= hi)`

Equivalent by `∀d ∈ D: lo ≤ d ≤ hi  ⟺  min(D) ≥ lo ∧ max(D) ≤ hi`, with empty `D`
trivially true. Today that equivalence — including the empty-drive edge case — was
reasoned out independently three times. In the IR it is one node,
`allDrivesWithin`, reasoned once, rendered three ways.

### Package layout

`worker/` cannot currently import from `src/` (zero cross-boundary imports
today), which is _why_ the worker holds a copy. Root `package.json` already
declares `workspaces`, so:

```
packages/filter-spec/
  src/constants.ts   DISK_UNIT_GB, CITY_PREFIXES, default count ranges
  src/filter.ts      ServerFilter + defaultFilter (moved here)
  src/ir.ts          node types + buildFilterIR()
  src/emit-duckdb.ts src/emit-sqlite.ts src/emit-predicate.ts
```

`src/lib/filter.ts` re-exports `ServerFilter`/`defaultFilter` from the package so
every existing `$lib/filter` import keeps working unchanged.

## Divergences found while writing this spec

Confirmed by reading; the harness must pin each. These are **behavior changes**,
so each is decided deliberately rather than silently normalized:

- **A. `cpu_cores` / `cpu_threads` NULL policy.** Worker: `c.cpu_cores IS NULL OR
(...)` — servers with unenriched CPUs **pass** a stated core range. Frontend:
  SQL `NULL` comparison excludes them. MCP: `if (auction.cpu_cores === null)
return false` — excludes, with an explicit comment defending it. Worker is the
  odd one out, 2–1. **Resolution: exclude** (adopt frontend/MCP). An alert
  demanding ≥32 cores should not fire on a server whose core count is unknown.
- **B. Default-range gating for cores/threads.** Frontend omits the clause
  entirely when the range is full (`[0,128]`/`[0,256]`); the worker always applies
  it. A server reporting 130 cores passes the frontend and fails the worker.
  **Resolution: adopt the frontend's gating** — a full-range slider means "no
  opinion", not "≤128".
- **C. `server_type` is unmodeled server-side.** `showAuction`/`showStandard`
  filter the frontend, but `current_auctions` has no `server_type` column
  (`migrations/0010`), so alerts cannot honour it. **Resolution: document as a
  known asymmetry; do not fix here.** Adding the column is a data-pipeline change,
  out of scope. The IR marks the node `frontendOnly` so the omission is explicit
  rather than forgotten.
- **D. `recentlySeen`** is inherently frontend-only — `current_auctions` is by
  construction current. Also marked `frontendOnly`.

## Decisions & trade-offs

- **Conformance harness lands before the IR.** It is the acceptance criterion for
  the refactor: rewriting three matchers with no oracle is how generation #5 of
  this bug ships. It is also independently valuable if the IR is never finished.
- **DuckDB in the harness via `@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs`**
  — already a dependency, no new package. Verified to run the `array_filter` /
  `array_length` lambda forms and to return `true` for empty arrays.
- **SQLite in the harness via `node:sqlite`** — matching the precedent set by
  `alert-matching-sql.test.ts`; D1 is SQLite-compatible, no native dep.
- **The IR is a real abstraction with real cost** (~40 predicates × 3 backends).
  On a stable schema, the harness alone would be the right call. But
  `frontend/filter.ts` took 15 commits in 12 months, and hand-mirrored invariants
  under churn are what manufacture drift. That is what tips it.
- **`buildServerFilter` stays a separate encoder.** It translates the MCP query
  schema into a `ServerFilter` and then delegates; that is already the right
  shape. It gains the shared constants but no emitter.

## Implementation steps

- [x] Write spec (this file)
- [x] Extract both matchers into dependency-free modules so a harness can import
      them side by side (`$lib/api/shared/filter-query`,
      `worker/src/alert-matching-sql`)
- [x] Conformance harness: 20 servers × 28 filters through DuckDB and SQLite,
      plus MCP search vs. its alert encoding. Verified to catch the historical
      250-vs-500 GB bug. Runs in CI via `frontend.yml`.
- [x] Fix the MCP ceiling bug the harness surfaced (see finding E below)
- [x] Resolve divergences A and B; `KNOWN_DIVERGENCES` is now empty
- [x] `packages/filter-spec` workspace package: `ServerFilter`, `defaultFilter`
      and the disk geometry constants, resolvable from both toolchains (verified
      with a SvelteKit build and a wrangler dry-run bundle)
- [x] Golden snapshot pinning current per-filter behaviour, so a rewrite that
      changes both emitters together cannot regress unnoticed
- [x] Restore worker type checking behind a ratchet (`tsconfig.check.json`)
- [ ] **Remaining:** symbolic IR (`buildFilterIR`) + `emitDuckDb` / `emitSqlite`;
      migrate `generateFilterQuery` and `MATCH_ALERTS_SQL` onto them

### Why the IR is staged separately

It is a rewrite of the SQL that fires production alerts, and it replaces both
emitters simultaneously. That is safe only with the harness _and_ the golden
snapshot in place — which is why they landed first. Both are now green, so the
rewrite has a real acceptance criterion: `KNOWN_DIVERGENCES` stays empty and the
snapshot does not move.

Note that the harness has already converted the failure mode from silent to loud.
Drift between the two engines now fails CI on the commit that introduces it,
which was the actual danger. The IR removes the duplicated maintenance, which is
a cost problem rather than a correctness one.

## Finding E: unconstrained MCP alerts were silently capped

Surfaced by the harness, fixed in `fix(mcp)`. `buildServerFilter` encoded "no
maximum stated" as the UI slider ceiling. That ceiling is a display affordance,
but the same number is the stored predicate the alert matcher evaluates — so an
MCP-created alert with **no disk criteria at all** still meant "at most 9 TB
NVMe / 7 TB SATA / 22 TB HDD / 128 cores", and never fired for larger servers.
34 server × query combinations disagreed between search and alert.

Unstated maxima now use explicit `UNBOUNDED` sentinels. Drive _counts_ keep the
UI ceilings: bay counts are a real hardware limit, not a display artefact.

## Remaining test debt

- `worker`'s full type check reports 261 errors (35 in production source, 226 in
  test mocks), gated behind `tsconfig.check.json` until fixed. `npm run check:all`
  shows the full picture. The root cause was a stale `tsconfig` reference to a
  workers-types subpath that v5 removed — not the code — but the placeholder
  `echo` hid real breakage for however long it sat there.
- The Playwright suite is still `workflow_dispatch`-only in `playwright.yml`, so
  it does not gate PRs. Out of scope here; the conformance harness now covers the
  filter semantics that suite was implicitly relied on for.
