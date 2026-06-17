# SQL Console — Power-user query mode (June 2026)

## Intent

Power users want to run their own SQL against the auction dataset instead of being
limited to the curated filter/analyze UI. Because the entire dataset already lives
in the browser (DuckDB WASM, `sb.duckdb` fetched whole into memory), every existing
feature is just SQL over a client-side database. A SQL console exposes that
capability directly — minimal new infrastructure, no backend.

**Entry point:** a persistent floating button (bottom-right) that opens a slide-out
drawer containing a REPL-style console with SQL syntax highlighting. Open to
everyone, no auth. Fully responsive (full-width drawer on mobile).

## Key facts (current architecture)

- DuckDB WASM instance lives in the `db` store (`src/stores/db.ts`), loaded via
  `initializeDB()` which downloads `sb.duckdb` (~6 MB) and tracks progress in
  `dbInitProgress`.
- Queries run through `withDbConnections()` / `getData()` in
  `src/lib/api/frontend/dbapi.ts`. `getData` uses parameterized prepared
  statements; the console needs **raw** user SQL, so it gets its own helper.
- A FAB convention already exists: `FloatingActionButton.svelte` +
  `src/lib/stores/fabStore.ts`. Today it's **single-slot** (only the highest
  priority visible FAB renders; scroll-to-top uses priority 100, anchored
  `right-6 bottom-12`). The console launcher must coexist with it (stacked).
- Drawers use Flowbite `Drawer` (see `ServerDetailDrawer.svelte`,
  `AlertAuctionsDrawer.svelte`): `placement="right"`, `transitionType="fly"`,
  dark-aware border/bg classes.
- The `server` table schema (from `scripts/update_incremental.py`): ~37 columns
  including `id`, `cpu`, `cpu_vendor`, `ram_size`, `is_ecc`, `nvme_size`,
  `sata_size`, `hdd_size`, `datacenter`, `location`, `price` (**whole EUR**, not
  cents — verified against live data; filter.ts adds `price + 1.70` directly),
  `setup_price` (whole EUR), `server_type` ('auction'|'standard'), `seen`
  (TIMESTAMP), `cpu_score`, `cpu_multicore_score`, plus array columns
  (`hdd_arr`, `nvme_drives`, `information`, …).
- **Pricing pipeline** (mirrors the rest of the app): `price` (EUR) `+ IPv4`
  (€1.70 = `HETZNER_IPV4_COST_CENTS / 100`) `× (1 + vatRate)` `× exchangeRate`.
  VAT comes from `vatOptions[countryCode].rate` (exported from
  `VatSelector.svelte`); currency + rate from the `settings`/`currency` stores
  (fixed 1 EUR = 1.10 USD).
- **The WASM DB is opened read-only** (buffer-backed file), so regular
  `CREATE VIEW` fails. Temporary views work (always-writable temp schema) but are
  connection-scoped.

## Architecture

### Data layer — `src/lib/api/frontend/console.ts` (new)

- `runConsoleQuery(db, sql, { rowLimit }): Promise<ConsoleResult>`
  - Opens its own connection (`db.connect()`), runs `conn.query(safeSql)` (raw, no
    prepared params), closes in `finally`.
  - Returns `{ columns, rows, rowCount, timingMs, truncated }`.
  - **Read-only guard:** allowlist on the leading keyword —
    `select | with | describe | explain | show | summarize | pivot | from | values | table`.
    Anything else (INSERT/UPDATE/DELETE/CREATE/DROP/ATTACH/COPY/INSTALL/LOAD/PRAGMA/CALL)
    is rejected with a friendly message. Rationale: even though it's the user's own
    in-memory copy (mutations are harmless and reset on reload), blocking writes
    avoids confusion and blocks `ATTACH`/`COPY`/`INSTALL` side-effects.
  - **Auto-LIMIT:** if the statement is a read with no `limit` keyword present,
    append ` LIMIT 1000` and flag `truncated` when the cap is hit. (Heuristic:
    skips append if `\blimit\b` appears anywhere — documented limitation.)
  - **Single statement:** strip one trailing `;`; reject if another `;` remains
    (multi-statement not supported in MVP).
  - **BigInt-safe:** DuckDB returns `BigInt` for `UBIGINT`/`BIGINT` (e.g. `id`).
    A `serializeCell()` helper converts `BigInt`→string and arrays/structs→JSON so
    rendering, CSV, and JSON export never throw.
- `getSchema(db, viewSettings?): Promise<TableSchema[]>` — creates the views on a
  connection, then `SHOW TABLES` + `DESCRIBE` (always probing `CONSOLE_VIEWS`,
  since `SHOW TABLES` may omit temp views) for the schema browser + autocomplete.
  Pins `available`, `server_history`, `server` first.

### Denormalized views — `buildViewStatements` + `setupConsoleViews`

Raw `server` is awkward for power users (prices net-of-VAT, no IP cost, one row
per observation). Two friendly views are exposed instead:

- **`available`** — one row per server in the **latest snapshot** (the
  `seen > max(seen) - 70 min` window the app already uses for "currently
  available"; deduped per `id` with `QUALIFY ROW_NUMBER()`). Friendly column
  names (`ram_gb`, `disk_gb`, `cores`, `ecc`, `gpu`, …), settings-aware pricing
  (`price_base`, `price_excl_vat`, `price` incl. IPv4 + VAT, `setup_fee`,
  `currency`, `vat_rate`), and a clickable Hetzner **`link`** (auction → `sb`
  `#search=<id>`; standard → `dedicated-rootserver` `#search=<product>`).
- **`server_history`** — the same enrichment over the full retained history (no
  `link`), for exploring prices over time.

Implementation notes:

- `buildViewStatements(settings)` is **pure** (returns SQL strings) so the price
  math, link templates, dedup and view names are unit-tested without a DB.
- Views are **`CREATE OR REPLACE TEMPORARY VIEW`** (read-only DB — see Key facts)
  and therefore connection-scoped: `runConsoleQuery` and `getSchema` each
  (re)create them on their own connection before use, via `setupConsoleViews`.
  Individual view failures are logged, not fatal (raw `server` still queryable).
- The drawer recomputes `viewSettings` from the VAT country + currency stores and
  passes them through; changing either rebuilds the views with new figures.
- The results table renders any `https?://` cell (e.g. `link`) as a clickable
  anchor (`target="_blank"`).

### UI — components (new, under `src/lib/components/console/`)

- `SqlConsoleLauncher.svelte` — persistent floating button, bottom-right. Opens the
  drawer. Stacks with the existing scroll-to-top FAB (see FAB stacking below).
- `SqlConsoleDrawer.svelte` — Flowbite `Drawer`, `placement="right"`,
  width `w-full sm:w-[40rem] lg:w-[52rem]`, dark-aware. Contains:
  - **Header:** title + `CloseButton`.
  - **Schema browser** (collapsible): tables → columns + types. Click a
    table/column to insert into the editor. Example-query chips.
  - **Scrollback (REPL):** ordered list of entries `{ sql, result|error, timingMs }`.
    Each shows the executed SQL (syntax-highlighted, read-only CodeMirror or
    highlighted `<pre>`), then a result table (sticky header, horizontal scroll,
    truncation note) or an error box, plus `N rows · X ms` and per-entry
    **Copy / CSV / JSON** export.
  - **Editor (input):** CodeMirror with SQL highlighting + autocomplete seeded from
    the schema. `Ctrl/Cmd+Enter` runs; `↑/↓` recalls history when the editor is
    empty/at-edges. **Run** button.
  - **DB loading:** if `db` isn't ready, call `initializeDB()` on open and show the
    `dbInitProgress` bar before enabling the editor.
- `CodeEditor.svelte` — thin CodeMirror 6 wrapper (mount via action, value binding,
  `onRun` callback, dark-mode theme compartment switched off the `dark` class on
  `documentElement`).

### Editor / highlighting — CodeMirror 6 (new dependency)

- Add `codemirror` (bundles `@codemirror/{state,view,commands,language,autocomplete,search}`
  - `basicSetup`) and `@codemirror/lang-sql`.
- Configure `sql({ dialect: PostgreSQL, schema })` — PostgreSQL dialect is the
  closest stock match to DuckDB; `schema` drives table/column autocomplete.
- Dark theme via `@codemirror/theme-one-dark` (or a small custom theme) swapped
  through a `Compartment` when the `dark` class toggles.

### FAB stacking — `fabStore.ts` + `FloatingActionButton.svelte` (extend)

The console launcher is **persistent** (always visible once mounted), unlike the
contextual scroll-to-top. To make them stack instead of overlap:

- Generalize the FAB store to expose, for each _visible_ FAB, a vertical **slot
  index** ordered by priority, instead of only the single highest-priority id.
- `FloatingActionButton` positions itself at `bottom = base + slot * step`
  (e.g. base `bottom-12`, step ~`4.5rem`) so multiple visible FABs stack upward,
  highest priority at the bottom.
- Console launcher registers at a fixed priority so it owns the bottom slot;
  scroll-to-top stacks above it when scrolled.
- _(Alternative kept in mind: leave the store single-slot and hard-position the
  console launcher above scroll-to-top. Rejected — generalizing the store is
  cleaner and reuses the existing transition/registration logic.)_

### Mounting

- Mount `SqlConsoleLauncher` (which owns the drawer) once in the root layout
  (`src/routes/+layout.svelte`), next to the existing scroll-to-top FAB.
- The launcher FAB is **shown only on the DuckDB-backed data pages**
  (`/configurations`, `/statistics`, `/analyze`) — `visible` is derived from
  `$page.url.pathname`. Navigating off an allowed route also closes the drawer.

### Result type coercion

DuckDB/Arrow surfaces some types awkwardly: `DECIMAL`/`HUGEINT` come back as
Decimal128 limb-arrays (e.g. `[5438,0,0,0]`) and `TIMESTAMP` as raw epoch
numbers. `buildCoercedQuery` wraps SELECT/WITH queries in an outer projection
that casts `DECIMAL`/`HUGEINT` → `DOUBLE` and `TIMESTAMP`/`DATE`/`TIME` →
ISO-8601 strings (via `DESCRIBE` to learn column types). The user's query runs as
the inner subquery, so date math etc. still operate on real types; only the
output is simplified. It's skipped/falls back safely (no columns, duplicate names,
DESCRIBE/exec failure) so it can never break a valid query. The views
additionally cast their price columns to `DOUBLE` directly.

## Decisions & trade-offs

- **Client-only, no backend.** Queries run in the user's own DuckDB over public
  data — no D1, no secrets, no other users' data reachable. Worst case is a slow
  query freezing the user's own tab. No server-side risk.
- **Read-only allowlist over a full SQL parser.** Cheap, predictable, blocks the
  side-effecting statements that matter. Mutations would be harmless anyway (reset
  on reload) but blocking them avoids "why did my data change?" confusion.
- **CodeMirror over a textarea+highlighter.** User asked for REPL-style with SQL
  highlighting "plus" — CM6 gives highlighting _and_ schema-aware autocomplete in
  one well-maintained, tree-shakeable dep. Trade-off: one new dependency.
- **Persistent launcher, lazy DB.** Button is always visible (discoverable), but
  the 6 MB DB only loads when the console is first opened (if not already loaded by
  another page), with a progress bar.
- **Generalize FAB stacking** rather than special-case positioning — small, reusable
  change; keeps scroll-to-top behavior intact.

## Implementation steps

- [ ] Add deps: `codemirror`, `@codemirror/lang-sql`, `@codemirror/theme-one-dark`.
- [ ] `src/lib/api/frontend/console.ts`: `runConsoleQuery` (read-only guard,
      auto-LIMIT, single-statement, BigInt-safe serialize) + `getSchema`.
- [ ] Unit tests (vitest) for the guard, auto-LIMIT, single-statement, and
      BigInt/array serialization helpers.
- [ ] `CodeEditor.svelte` CodeMirror wrapper (value bind, onRun, dark theme).
- [ ] `SqlConsoleDrawer.svelte`: schema browser, REPL scrollback, editor, export,
      history (localStorage), lazy DB load + progress.
- [ ] `SqlConsoleLauncher.svelte`: persistent FAB + drawer host.
- [ ] Generalize `fabStore.ts` + `FloatingActionButton.svelte` for vertical
      stacking; verify scroll-to-top still works.
- [ ] Mount launcher in `src/routes/+layout.svelte`.
- [ ] Responsive/mobile pass (full-width drawer, scrollable result tables,
      tap targets).
- [ ] `npm run check`, `npm run lint`, `npm run test` green.
- [ ] Changelog entry (this is a noteworthy feature).

## Out of scope (MVP)

- Saved/named queries, sharing query URLs, multi-statement scripts.
- Charting console results, query plans visualization.
- Server-side / D1 querying (intentionally client-only).

```

```
