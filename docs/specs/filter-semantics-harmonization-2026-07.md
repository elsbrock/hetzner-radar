# Filter semantics harmonization

**Status:** in progress
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

| Operand  | DuckDB emitter   | TS emitter        | SQLite emitter                      |
| -------- | ---------------- | ----------------- | ----------------------------------- |
| `filter` | inlined literal  | closed-over value | `json_extract(pa.filter, '$.path')` |
| `row`    | column reference | property access   | column reference                    |

A `switch` node covers filter-value-dependent branching (`sizeMode`, `diskMode`,
OR-mode activity tests). DuckDB and TS emitters **evaluate the discriminant at
build time** and emit only the taken branch, reproducing today's compact output;
the SQLite emitter renders a `CASE WHEN`. Identical semantics, all three cost
profiles preserved.

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

- [ ] Write spec (this file)
- [ ] Conformance harness: shared fixtures across DuckDB / SQLite / TS, pinning
      current behavior and asserting agreement; divergences A/B quarantined as
      documented-expected until the IR lands
- [ ] `packages/filter-spec` workspace package: constants + `ServerFilter` moved,
      re-exported from `$lib/filter`
- [ ] Symbolic IR (`buildFilterIR`) covering every matched dimension
- [ ] Three emitters; migrate `generateFilterQuery`, `MATCH_ALERTS_SQL`,
      `matchesQuery` onto them, harness green at each step
- [ ] Resolve divergences A and B in the IR; un-quarantine those harness cases
- [ ] Re-enable worker type checking (`worker/package.json` `check` is currently
      `echo 'Type checking temporarily disabled for CI'`, so `worker-tests.yml`
      type-checks nothing)
- [ ] Final validation: root + worker `check`, `lint`, `test`, `build`
