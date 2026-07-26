# Tech debt & code professionalization — July 2026

**Status:** complete; three follow-ups and three deferred items recorded below
**Date:** 2026-07-26

## Intent

A survey of the codebase turned up one live vulnerability, a CI gate that checks
everything except the worker's core, and a recurring pattern: the project keeps
re-deriving values and predicates it already has abstractions for.

This spec fixes the vulnerability, closes the gate, and — more importantly —
removes the _stated reasons_ the duplication kept getting added, because those
turned out to be stale comments that each new surface reads and follows.

Explicit non-goals: unifying the query runtimes (see "Rejected" below), and
building the symbolic filter IR (already deliberately deferred in
`filter-semantics-harmonization-2026-07.md`; that reasoning still holds).

## Finding 0: SQL injection in `/api/auctions`

`src/routes/api/auctions/+server.ts` builds its datacenter clause by string
concatenation:

```ts
const body: MatchRequest = await request.json();   // bare cast, no validation
...
dcConditions.push(`datacenter = '${dc}'`);         // dc is attacker-controlled
query += ` AND (${dcConditions.join(" OR ")})`;
await db.prepare(query).bind(...params).all()
```

Every other filter in the same function binds with `?`. Only this branch
concatenates. The route is a public `POST` with no auth, and `hooks.server.ts`
only origin-checks the three form content types, so `application/json` is not
covered.

The `DB` binding also holds `user`, `session`, `account`, `oauthAccessToken` and
`email_verification_code`, so a `UNION SELECT` through this reads session tokens.

Reconstructing the built string for a crafted body yields:

```sql
AND (datacenter = 'x' UNION SELECT rowid, token, 0, ipAddress, userId FROM session --')
```

**Resolution: validate the body and bind the datacenter values.** The endpoint
itself is legitimate and stays — see the inventory note below.

## Finding 1: the reason for duplication was removed, but not the reasoning

Three files carry variants of this comment:

> These types are a **deliberate duplicate** — this repo does not share code
> across the worker/app workspace boundary.

- `worker/src/auction-snapshot.ts:9`
- `src/lib/server/mcp/snapshot.ts:4`
- `src/lib/api/backend/webhook.ts` (cited by both as precedent)

That was true until `packages/filter-spec` landed, which the worker now imports
and which was verified against both a SvelteKit build and a wrangler dry-run. The
boundary is gone; the comments are not. `SNAPSHOT_VERSION` exists purely to detect
drift between two copies that no longer need to be copies.

These comments are load-bearing misinformation: they are the mechanism by which
each new surface learns to duplicate.

**Resolution: delete them, move the snapshot types into `filter-spec`.**

## Finding 2: `filter-spec` is bypassed at the sites it was created for

Its own docstring names `ServerFilter.svelte` and the SQL literals as the
motivation, and ends "Import from here instead." Six sites do not:

| Site                               | Redeclares                                                       |
| ---------------------------------- | ---------------------------------------------------------------- |
| `ServerFilter.svelte:61-68`        | all six disk constants; `500` ×6; `diskSizeCeiling()` inlined ×3 |
| `api/shared/filter-query.ts`       | `* 500` ×6; own `cityPrefixes` (L61)                             |
| `worker/src/alert-matching-sql.ts` | `IN ('FSN','NBG','HEL')` (L199)                                  |
| `api/frontend/stats.ts:34,39`      | the prefixes, as SQL literals                                    |
| `api/auctions/+server.ts:109`      | the prefixes                                                     |
| `lib/filter.ts:238`                | `Math.floor(x / 500) * 500`                                      |

The conformance harness proves the two matchers agree with each other, so nothing
is broken today. But it pins _behaviour_, not _sourcing_ — the constant is still
spelled out in six places, which is the condition that produced the historical
250-vs-500 GB split.

## Finding 3: CI type-checks everything except the worker's core

`worker/tsconfig.check.json` gates 18 of 45 files. The 7 ungated production files
are the load-bearing ones, and all 7 have errors:

| File                         | Errors |
| ---------------------------- | ------ |
| `http-router.ts`             | 9      |
| `analytics-query-service.ts` | 5      |
| `index.ts`                   | 3      |
| `cloud-availability-do.ts`   | 3      |
| `auction-import-do.ts`       | 3      |
| `auction-service.ts`         | 2      |
| `alert-service.ts`           | 1      |

26 in production source, 235 more in test mocks (261 total). The frontend
`npm run check` is clean at 0/0.

## Finding 4: the reactivity model is fought rather than used

53 `$effect` against 140 `$derived`, and the effects are largely doing derivation:

- `analyze/+page.svelte:436-626` — a 190-line effect that hand-copies seven
  reactive values into locals, flips `processingList`, then runs the whole
  price-filter → sort → group pipeline inside `setTimeout(…, 10)` and writes
  `groupedDisplayList`. Pure derivation as a deferred side effect, so the rendered
  list is always at least a frame behind its inputs.
- `analyze/+page.svelte:247` — an effect whose entire body is four unused
  assignments (`const _group = groupByField; …`) to register dependencies by hand.
- `ServerFilter.svelte:91/108/124` — the same clamp routine copy-pasted three
  times, once per disk type.
- `ServerFilter.svelte:224/247/267` — manual change-latches
  (`previousFilterState = JSON.stringify(filter)`, `lastUrlFilterString`) holding
  three copies of filter state in sync by string comparison.
- `ServerFilter.svelte:295` — eight lines of pure formatting, annotated
  "using `$state` to satisfy linter/reactivity tracking".

That last comment is the diagnosis: the code is written to appease the linter
rather than to express the dependency.

Related: 13 underscore-prefixed declarations and 4 underscore-aliased imports are
dead code preserved to pass lint.

## The auction query inventory

Nothing in the repo records that these exist, which is why MCP and the detail
drawer each grew a fresh hand-rolled query. The harmonization spec's table lists
four; there are eight across three substrates, and the conformance harness covers
two.

| #   | Site                               | Substrate         | Purpose                             |
| --- | ---------------------------------- | ----------------- | ----------------------------------- |
| 1   | `api/shared/filter-query.ts`       | DuckDB WASM       | analyze page filter ✅ harness      |
| 2   | `api/frontend/configs.ts`          | DuckDB WASM       | configurations (shared builder)     |
| 3   | `worker/src/alert-matching-sql.ts` | D1                | alert matching ✅ harness           |
| 4   | `api/auctions/+server.ts`          | D1                | live listings for the detail drawer |
| 5   | `configurations/+page.server.ts`   | D1                | SSR of #2 (shared builder)          |
| 6   | `api/shared/cpu-pages.ts`          | D1                | per-CPU landing pages               |
| 7   | `routes/+page.server.ts`           | D1                | landing hero, cheapest 50           |
| 8   | `lib/server/mcp/search.ts`         | KV + in-memory TS | MCP `search_auctions`               |

`(authed)/alerts/[alertId]/auctions/+server.ts` is a ninth but is a clean
bound-param join on `alert_auction_matches` — a lookup, not a filter.

#4 is also a lookup at heart: it matches on exact hardware identity
(`cpu = ? AND nvme_drives = ?` as JSON string equality) to surface currently-listed
auction IDs and live prices for a configuration the client-side DuckDB only knows
historically. That is genuinely distinct from the range predicates in #1/#3, which
is why the harness never covered it. Only the three filter clauses grafted onto it
(location, extras, datacenters) duplicate anything — and the datacenter one is
Finding 0.

**#2 and #5 are the proof that a shared emitter works**: `buildCategoryQuery` in
`api/shared/configurations.ts` is one SQL generator parameterized by table name,
serving D1 server-side and DuckDB client-side. 145 lines, no IR, no indirection.

## Rejected

**DuckDB WASM in the Worker.** `duckdb-eh.wasm` is 8.0 MB raw / 7.4 MB gzipped
against a ~10 MB gzipped paid-tier bundle ceiling, re-instantiated on every cold
start against a ~400 ms startup CPU budget. And the server-side dataset is a few
hundred rows / 8–20 KB gzipped (`auction-snapshot.ts:5`). Shipping a vectorized
analytical engine with a query planner to filter a few hundred rows is the wrong
shape by two orders of magnitude. DuckDB earns its place on the client — 3 months
of history at zero marginal server cost — and that value does not transfer.

**Collapsing all eight sites to one.** Realistic floor is ~4: the client history
filter, the `GROUP BY` aggregates, and `ORDER BY price LIMIT 50` are different
questions, not duplicate answers.

**Building the symbolic IR.** Unchanged from
`filter-semantics-harmonization-2026-07.md`: two emitters do not amortise a
compiler, and the harness already turned drift from silent into CI-failing.

**Deleting `/api/auctions`.** It is live — `ServerDetailDrawer.svelte:72`, reached
from the analyze page via `ServerList` → `ServerCard`/`ServerListRow` — and its
core is legitimate.

## Implementation steps

- [x] Write this spec
- [x] **Finding 0**: validate body + bind datacenter values in `/api/auctions`.
      Both forms bind (`LIKE ?` with `'FSN%'`, `= ?` for exact). 25 tests, incl. a
      regression test asserting the payload cannot reach the SQL string. The
      helpers moved to `$lib/api/backend/auction-match.ts` — SvelteKit restricts
      `+server.ts` to HTTP-verb exports, which only `npm run build` catches.
- [x] **Finding 1**: snapshot types moved to `@server-radar/filter-spec/snapshot`,
      taken verbatim from the producer with field parity verified against both
      former copies; the stale boundary comments are gone.
- [x] **Finding 3**: all 26 worker production type errors fixed. Root causes, not
      symptoms: `lib: es2021` did not declare `ErrorOptions` (4 errors from one
      config line), both DOs shadowed `DurableObject`'s `ctx`/`env` instead of
      parameterizing `Env` (6), and `http-router` took the import result as
      `unknown` (9). Two real bugs surfaced — `auction-service`'s no-valid-data
      path returned 4 of 9 declared fields, and its success path omitted
      `timestamp` entirely. `tsconfig.check.json` now globs `src/**/*.ts` and
      excludes only `src/__tests__`, so new production files are gated by default.
- [x] **Finding 2**: all six bypass sites import from `filter-spec`.
      `auction-data-transformer`'s NBG/FSN check is deliberately excluded — it maps
      datacenter to _country_, so binding it to `CITY_PREFIXES` would break when a
      city is added in a new country.
- [x] **Finding 4a**: dead underscore code removed; `dedupeByСpu` renamed. Swept
      `src/`, `worker/src/`, `packages/` and `scripts/` for Cyrillic/Greek
      lookalikes in identifier positions — it was the only one.
- [x] **Finding 4b**: `ServerFilter`'s three clamp effects collapsed to one
      table-driven effect (it writes back to `filter`, so it stays an effect —
      duplication was the problem, not the `$effect`); the eight formatting
      assignments became `$derived`. 7 effects → 4.
- [x] **Finding 4c**: pipeline extracted to `analyze/insights.ts` with 28 tests.
      Proven behaviour-preserving by a differential test — 36,000 seeded cases
      against the original comparator, zero divergence — which also showed four of
      the original's special-case branches were no-ops, and corrected my wrong
      assumption that a missing price sorts last descending (it sorts first).
      1208 → 962 lines, 5 → 3 effects, 30 → 22 `$state`, 5 → 19 `$derived`.
- [x] Final validation: app `check` 0/0 over 2806 files, `lint` 0 errors, 207
      tests, `build` clean; worker gate clean, 252 tests, wrangler dry-run bundles.

## Follow-ups this work surfaced

- **`ServerConfiguration.cpu` is declared `string` but is nullable in practice.**
  The grouping code has always defended against null (`server.cpu ?? …`) and the
  rows come from DuckDB. `insights.test.ts` documents the mismatch at its fixture.
  Fixing the type is a wider change than this spec's scope.
- **`generateFilterQuery` interpolates datacenter names into its SQL** rather than
  binding them (`filter-query.ts`, city-prefix and exact-match branches). Unlike
  Finding 0 this is not a vulnerability — it runs in the browser against the
  user's own DuckDB instance — but the golden snapshot pins the emitted SQL, so
  converting it to bound parameters wants its own change with the snapshot updated
  deliberately.
- **`worker/src/__tests__` still reports ~236 type errors**, almost all in
  hand-rolled mocks. `npm run check:all` shows them; the CI gate excludes them.

## Deferred, with the number that decides it

**Can alert matching move onto `matchesQuery`?** #3 is the one genuine
line-for-line reimplementation left. It resists collapsing because it matches N
alerts × M auctions set-based in a single statement, reading filter values out of
JSON via `json_extract`. But it runs in the `AuctionImportDO` alarm on a 5-minute
cadence, not in a request path, so it has a DO's CPU budget rather than a
request's.

A few hundred auctions crossed with a few thousand alerts is a loop. Crossed with
a few hundred thousand, it is not. **The active alert count decides this**, and it
is a one-line D1 query against production — so it is recorded here rather than
guessed at.

**`notifications/` vs `cloud-notifications/`** — 1,265 lines, two parallel channel
families. Normalizing the `Cloud` prefix away, the discord, webhook and interface
pairs still differ by ~130 diff lines each. Same drift shape as the filter
matchers, no harness. Deferred: it is a real refactor of live notification paths
and wants its own spec.

**Playwright** — `workflow_dispatch`-only since 2026-06-16 (flakiness), with 79
commits since the specs were last touched, so expect red. Proposal: make
`critical-ci.spec.ts` a blocking PR job and leave the other 12 manual until
triaged. Deferred: needs a CI run to size, which cannot be done locally.
