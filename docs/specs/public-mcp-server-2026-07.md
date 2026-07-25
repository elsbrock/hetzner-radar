# Public MCP Server (Model Context Protocol)

Status: implemented (July 2026); OAuth connect flow not yet exercised end to end

## Intent

Expose Server Radar to AI agents over the Model Context Protocol, so an assistant
can answer "is there a cheap 64 GB EPYC in Falkenstein right now?" and — for
signed-in users — "watch for that config under €40" without a human driving the
UI.

Two audiences, deliberately split:

- **Anyone, unauthenticated** — read tools over live auction data and cloud
  availability. No account, no token, works in every MCP client immediately.
- **Signed-in users** — alert management (list/create/delete), gated behind
  OAuth.

The read half is the reach; the write half is the depth. They ship in that order
and the read half must never depend on the auth work landing.

## Key facts (current architecture)

Verified against the live feed and the repo, July 2026:

- **The entire live dataset is tiny.** `live_data_sb_EUR.json` currently returns
  **150 servers, 154 KB minified, ~8 KB gzipped**, not paginated
  (`serverCount === server.length`). Even a 10× swing stays trivially small.
- `AuctionImportDO` polls that feed every 5 minutes
  (`AUCTION_IMPORT_INTERVAL_MS: 300000`), enriches with `cpu-specs.json`, then
  **truncates and fully repopulates** `current_auctions`
  (`worker/src/auction-db-service.ts:52`, then `db.batch()`). At that moment the
  complete enriched dataset is already in worker memory.
- The source feed carries pricing fields Radar does not currently persist:
  `ip_price`, `setup_price`, `fixed_price`, `hourly_price`,
  `next_reduce_timestamp`.
- `current_auctions.price` is **EUR as REAL**, net of IPv4;
  `src/routes/api/auctions/+server.ts` adds `HETZNER_IPV4_COST_CENTS / 100` at
  read time and VAT is applied client-side.
- `price_alert.price` is **GROSS whole euros**, and `vat_rate` is a
  **percentage**, not a decimal. (An earlier draft of this spec claimed cents;
  that was wrong. `MATCH_ALERTS_SQL` compares
  `pa.price >= (c.price + ipv4) * (1 + pa.vat_rate / 100.0)`, and the alerts UI
  stores `Math.round(priceInEur)`. Verified against production: `price` ranges
  20-250 and `vat_rate` 0-25 — cents would be 2000-25000.) So an alert target is
  on a different basis to `current_auctions.price`, which is net EUR excluding
  IPv4.
- `price_alert.filter` is a serialized `ServerFilter` (`src/lib/filter.ts:5-50`)
  — 30 fields including tuple ranges, tri-state booleans (`extrasECC`) and mode
  enums (`diskMode`, `ssdNvmeSizeMode`). `idx_price_alert_user_id_filter` is
  UNIQUE on the raw **string**.
- `MAX_ALERTS = 5`, `MAX_NAME_LENGTH = 100` (`src/lib/api/backend/alerts.ts`).
- Main app `wrangler.jsonc` already binds `DB` (D1), `RADAR_WORKER` (service),
  `ASSETS`, and a `RATE_LIMIT` unsafe binding (currently 3 req/60s).
- The worker sets `workers_dev: false` and has no public route — it is reachable
  only via the service binding. Anything public must live in the SvelteKit app.
- Auth today: session cookie `sr_session`, `session.id = SHA-256(token)`, oslo
  primitives, email verification codes. Routes are `login` and `logout` only.
- Five FKs reference `user(id)` `ON DELETE CASCADE`: `session`, `price_alert`,
  `price_alert_history`, `cloud_availability_alert`, `cloud_alert_history`.
- **Latent schema quirk:** `user.id` is `TEXT PRIMARY KEY` but every FK declares
  `user_id INTEGER`. SQLite's loose typing makes this work today; a migration
  tool that trusts declared types may not be as forgiving.
- `static/sb.duckdb.wasm` (6.3 MB, 3 months of history) is already served
  publicly through the `ASSETS` binding. Cloudflare static assets are unmetered.

## Architecture

### Data layer — snapshot, not queries

D1 is metered and the dataset is 8 KB gzipped. There is no reason for the read
path to touch a database at all.

```
Hetzner JSON ──► AuctionImportDO ──┬──► D1 current_auctions  (alert matching, unchanged)
   every 5 min     (+ cpu-specs)   └──► KV "snapshot:current" (~8-20 KB gzipped)

MCP POST /mcp ──► module-scope cache (5 min TTL) ──► KV ──► filter in memory
```

`AuctionImportDO` writes the snapshot immediately after the existing `db.batch()`
succeeds — same data, already in memory, one extra `KV.put()`. `search_auctions`
becomes a linear scan over a few hundred objects: microseconds, no query planner,
and **zero D1 rows read**.

This also makes the filtering code _simpler_ than the D1 path, which currently
hand-builds SQL and compares drive arrays as `JSON.stringify`'d strings.

Cost: 288 writes/day (~8.6k/month against 1M included). Reads mostly never leave
the isolate; when they do, KV is edge-cached.

**KV over R2** because it edge-caches natively and the blob is small. R2 would
work but needs Cache API plumbing to reach the same place.

Both the worker (write) and the SvelteKit app (read) need the KV binding.

### Resolved pricing per auction

Pricing arithmetic is where an LLM will confidently produce a wrong number.
Resolve it once, at import time, into an explicit object rather than shipping a
bare `price` field:

```json
"pricing": {
  "currency": "EUR",
  "monthly_net": 38.0,
  "ipv4_monthly": 1.7,
  "setup_net": 0.0,
  "total_monthly_net": 39.7,
  "vat_included": false,
  "fixed_price": false,
  "next_reduce_at": "2026-07-25T20:00:00Z"
}
```

VAT stays out of the snapshot — it depends on the caller's country, so tools take
an optional `vat_rate` and apply it on the way out, mirroring `VatSelector`.
Field names say `_net` out loud so a model has to work to misread them.

`next_reduce_at` is high-value for a "wait or buy now?" agent and is free — it is
already in the source feed.

### Transport — `POST /mcp`

Streamable HTTP, stateless, as a SvelteKit `+server.ts`. Only three JSON-RPC
methods matter: `initialize`, `tools/list`, `tools/call`. Statelessness suits
Workers and needs no Durable Object.

Tool listing is **conditional on the `Authorization` header**: unauthenticated
callers see read tools; authenticated ones additionally see alert tools. One URL
for users, and the read tools stay reachable regardless of auth state.

### Tools

| Tool                  | Auth | Source           |
| --------------------- | ---- | ---------------- |
| `search_auctions`     | no   | KV snapshot      |
| `list_filter_options` | no   | KV snapshot      |
| `get_auction`         | no   | KV snapshot      |
| `cloud_availability`  | no   | `RADAR_WORKER`   |
| `list_alerts`         | yes  | D1 `price_alert` |
| `create_alert`        | yes  | D1 `price_alert` |
| `delete_alert`        | yes  | D1 `price_alert` |

**Discovery.** `cpu_models` and `datacenters` match _exactly_, so a model
guessing a name that is not listed gets silence rather than an error.
`list_filter_options` reports the live vocabulary (27 CPU models, 27
datacenters at time of writing) with counts, plus observed price/RAM/core
ranges. `tools/list` additionally attaches that vocabulary as JSON Schema
`examples`, so clients surface it to the model without a round trip.
Deliberately `examples` and not `enum`: inventory turns over every few minutes,
and a hard enum in a client-cached schema would start rejecting valid values.

Explicitly **not** exposing raw SQL. The browser SQL console is free because the
database sits on the user's machine; server-side it would be a metered,
unauthenticated query endpoint.

### Alert tools and filter normalization

The risk here is not auth, it is the filter shape. Handing a 30-field
`ServerFilter` to a model produces malformed filters routinely, and because the
UNIQUE index is on the raw string, two semantically identical filters with
different key ordering create a duplicate row instead of a conflict.

So: **alert tools accept the same flat schema as `search_auctions`** (cpu model,
min RAM, max price, location, …) and build the `ServerFilter` server-side from
`createDefaultFilter()` with stable key ordering. This gives normalization for
free, hides `version` / `diskMode` / `ssdNvmeSizeMode` entirely, and produces the
flow worth having: search, then create an alert from the identical parameters.

`MAX_ALERTS = 5` must surface via `isBelowMaxAlerts()` as an actionable error, not
a generic failure.

**Price basis.** `create_alert` takes `max_price_eur` on the _same_ basis as
`search_auctions` — net, server + IPv4, before VAT — and converts to the gross
whole-euro figure the column stores using `vat_rate_percent`. Without this the
two tools would silently disagree: an agent searching "under €40" and then
alerting at 40 would be setting two different thresholds. The filter encodings
come from `MATCH_ALERTS_SQL`, not the UI:

| Filter field           | Encoding                                    |
| ---------------------- | ------------------------------------------- |
| `ramInternalSize`      | log2 of GB (`log2(64) = 6`)                 |
| `*InternalSize` (disk) | units of 500 GB (`1000 GB -> 2`)            |
| `*SizeMode`            | `total` for MCP-built filters               |
| `price`                | gross whole EUR; `vat_rate` is a percentage |

`min_largest_drive_gb` and `min_cpu_multicore_score` exist on `search_auctions`
but are deliberately absent from `create_alert`: `ServerFilter` has no
equivalent, and accepting-then-dropping them would produce an alert that does
not match what was asked for.

### Auth — Better Auth migration (implemented, July 2026)

Chosen over hand-rolled bearer tokens: Better Auth's MCP/OIDC provider plugin
covers discovery metadata, dynamic client registration, PKCE and the token
endpoints — the expensive half of OAuth 2.1, and the half that makes one-click
"Connect" work in Claude and ChatGPT. Building bearer tokens first would mean
writing token management twice. The plugin was confirmed against Better Auth
1.6.25: it exists, serves the discovery routes, and ships `withMcpAuth` /
`auth.api.getMcpSession()`. It is **not enabled yet** — it belongs to the MCP
phases and carries its own three tables (`oauthApplication`, `oauthAccessToken`,
`oauthConsent`), so it gets its own migration.

Findings that shaped the implementation:

- **D1 is natively supported.** Better Auth 1.6.25 accepts a `D1Database`
  directly in its `database` union and auto-selects a built-in `D1SqliteDialect`
  (detected via `batch`/`exec`/`prepare`). No `kysely-d1`, no
  `better-auth-cloudflare`.
- **`database.casing` is dead.** Declared `"snake" | "camel"` in the types but
  never read at runtime in 1.6.25 — verified by grep across the shipped
  bundles. Column names are therefore mapped **explicitly per model** via
  `fields` to keep the schema snake_case.
- **The instance cannot live at module scope**, since the D1 binding only exists
  per-request. `getAuth(env)` memoises against the binding object in a WeakMap,
  so it constructs once per isolate rather than once per request.
- The generated schema was taken from Better Auth's own `getMigrations()`
  diffed against a SQLite copy of the production schema, rather than
  hand-written from docs. The CLI (1.4.21) was too far behind the library
  (1.6.25) to trust.

Migration `0016_better_auth_schema.sql`:

- **`user` is ALTERed additively and never rebuilt.** Four tables reference
  `user(id)` `ON DELETE CASCADE`; dropping and recreating it under enforced
  foreign keys would cascade-delete every user's alerts. Existing `user.id`
  values are untouched.
- Two SQLite rules the generator does not account for: `ADD COLUMN NOT NULL`
  needs a non-NULL **constant** default, and `CURRENT_TIMESTAMP` is not a legal
  `ADD COLUMN` default. Hence add-with-placeholder, then backfill.
- `session` is rebuilt — Better Auth requires a `NOT NULL UNIQUE` token that
  existing rows cannot supply. Nothing references `session`, so the DROP cannot
  cascade into user data.
- New `account` and `verification` tables.
- Email OTP replicates the previous flow exactly (6 digits, 15 minutes, same
  mail copy), so the login UI is unchanged — the form actions now call
  `auth.api.sendVerificationOTP` / `auth.api.signInEmailOTP` internally.

**Deviation from the original plan:** only `session`'s `user_id` declared type
was corrected to `TEXT`. `price_alert` and `price_alert_history` still declare
`user_id INTEGER` against a `TEXT` primary key. Straightening those would mean
rebuilding tables that hold real user data, for a cosmetic fix that SQLite's
loose typing already tolerates — not worth the risk. Better Auth surfaces the
same mismatch as a startup warning for `user.created_at` (`DATETIME` vs its
expected `date`), which is likewise harmless and unavoidable without rebuilding
`user`.

**Cutover logs everyone out** — session semantics differ and there is no
dual-read path worth building at this scale. A known, communicated decision, not
a surprise.

**Deploy requirement:** `BETTER_AUTH_SECRET` must be set (`wrangler secret put`)
before this ships. `BETTER_AUTH_URL` is optional and defaults to the production
origin.

D1 load is roughly neutral: `sessionHandle` in `hooks.server.ts` already reads D1
on every request, and Better Auth's cookie caching may reduce that.

Superseded code has been removed: `src/lib/cookie.ts` and
`src/lib/api/backend/auth.ts` are deleted, `api/backend/session.ts` is reduced to
`SESSION_COOKIE_NAME` (still needed to clear stale pre-cutover cookies), and
`createUser`/`getUserId` are gone from `user.ts`. The `email_verification_code`
**table** is intentionally kept even though nothing writes to it — Better Auth
stores OTPs in `verification`.

### Abuse

`RATE_LIMIT` already exists at 3 req/60s — too tight for MCP, but the mechanism
is there. Add hard result caps and short `Cache-Control` on read tools. Since
reads are served from an in-isolate snapshot, the blast radius of abuse is CPU,
not database spend.

## Decisions & trade-offs

- **Snapshot instead of querying D1.** Chosen because the dataset is 8 KB
  gzipped and the import already holds it in memory. Costs 5 minutes of staleness
  — irrelevant when the upstream feed is itself only polled every 5 minutes.
- **Read tools ship before any auth work.** Phases 1–2 touch auth zero. Putting a
  live-user-account migration in front of them would block the majority of the
  value behind an unrelated risky change.
- **Better Auth over bearer tokens.** Bearer tokens are ~a day and work in
  clients that support custom headers, but they are throwaway if OAuth ever
  lands, and they do not enable connector UIs. Confirm the MCP plugin's current
  shape against Better Auth docs before building — that area moves.
- **Hand-rolled JSON-RPC over `@modelcontextprotocol/sdk`.** Three methods do not
  justify the bundle, and the SDK's HTTP transport is Node-oriented. Verify
  current Workers compatibility before committing either way.
- **Curated tools, no raw SQL.** See above.
- **History deferred.** `price_history` wants more than a snapshot. Preferred
  future shape: a pre-aggregated daily min/median per config bucket over 90 days
  as a second KV blob — that answers "is this cheap right now, historically?",
  which is the question agents actually ask. The full history already ships as a
  free public static asset for anyone wanting more.

## ToS & redistribution

Covered by the review in `grandfathered-server-marketplace-2026-07.md`: no
anti-circumvention or anti-resale language in Hetzner's AGB or FAQs. The source
feed is public and unauthenticated, and Radar already redistributes three months
of it as a downloadable static asset. An MCP server is a smaller step than the
marketplace, which cleared the same bar. Keep the existing "not affiliated with
Hetzner" positioning in the server's `initialize` response.

## Implementation steps

**Phase 1 — snapshot pipeline** (implemented on `feat/public-mcp`)

- [x] KV namespace `SNAPSHOT` (`aa8acd63…`), bound to worker (write) and app (read)
- [x] Resolve pricing per auction at import. `ip_price` turned out to be an
      **object** (`{Monthly, Hourly, Amount}`), not a scalar — read `.Monthly`.
- [x] Write snapshot to `snapshot:current` after the D1 batch succeeds.
      Deliberately non-fatal: a KV failure must not fail an import that alerting
      depends on.
- [x] Module-scope read cache with 5 min TTL, falling back to the stale copy
      rather than erroring
- [x] Measured on live data: **152 auctions, 127.5 KB JSON, 6.2 KB gzipped**,
      all 152 CPU-enriched — comfortably under the 8-20 KB estimate

**Phase 2 — public read tools** (implemented on `feat/public-mcp`)

- [x] `POST /mcp` — `initialize`, `tools/list`, `tools/call`, `ping`,
      notifications, batches, CORS; `GET` declines (stateless, 405)
- [x] `search_auctions` (flat schema, optional `vat_rate`), `get_auction`
- [x] `cloud_availability` via `RADAR_WORKER`
- [x] Result caps (default 20, max 50), `total_matched` reported separately from
      the page so a model can tell "only 3 exist" from "cheapest 20 of 300"
- [x] Verified end-to-end against a dev server, then in production: worker
      deployed 19:18:22Z, published its first snapshot 19:22:43Z, refreshing on
      the 5-minute cadence. `search_auctions` returns 140/152 matches with
      correct net and gross pricing; `list_filter_options` reports 27 CPU models
      and 27 datacenters.
- [ ] Revisit `RATE_LIMIT` (currently 3 req/60s) for MCP traffic

**Phase 3 — Better Auth** (implemented on `feat/better-auth`)

- [x] Confirm MCP/OIDC plugin shape against current docs
- [x] `0016_better_auth_schema.sql`, preserving `user.id`; `session.user_id`
      corrected to `TEXT` (see deviation above re: `price_alert`)
- [x] Email OTP to replace the existing code flow; port `login` / `logout`
- [x] Rewrite `hooks.server.ts` `sessionHandle`
- [x] Verify all five FK relationships survive on a seeded copy of the schema
      (row counts preserved, `user.id` unchanged, `foreign_key_check` clean,
      zero residual diff from `getMigrations()`)
- [x] Remove superseded auth code (table kept)
- [x] Set `BETTER_AUTH_SECRET` on the `server-radar` Worker (top-level env —
      there is no `server-radar-production` Worker; that is where
      `FORWARDEMAIL_API_KEY` lives too)
- [x] Apply migration 0016 to **local** D1 via `wrangler d1 migrations apply`,
      confirming wrangler's own SQL splitter handles the file
- [x] Apply migration 0016 to **remote** D1 — 14 commands, 2026-07-25. All data
      preserved (2702 users, 182 price alerts, 989 alert history, 1346 cloud
      alerts, 35296 cloud history); 1019 sessions cleared as designed; backfill
      complete (0 empty names, 0 unbackfilled `updated_at`);
      `PRAGMA foreign_key_check` clean.
- [x] Verify live: `/api/auth/get-session` returns `200 null`, which only
      resolves with Better Auth mounted and its tables present.
- [ ] Exercise a full sign-in end to end (sending a real OTP email was left to
      a human rather than triggered from here)
- [ ] Communicate forced logout — 1019 sessions were dropped

**Deploy mechanism (learned the hard way):** pushing to `main` **auto-deploys**
via Cloudflare's git integration. `wrangler deployments list` reports
`Source: Unknown (deployment)` and attributes the deploy to a human, which reads
like a manual `wrangler deploy` — it is not. CI (`frontend.yml`) runs only
check/lint/test and has no deploy job, which reinforces the wrong conclusion.

Consequence on 2026-07-25: the push deployed the new auth at 17:42:51 while the
migration was still ~7 minutes out, so new code briefly ran against the old
schema. The correct order is **migrate first, then push** — the reverse of what
the manual-deploy assumption implies.

**Phase 4 — alert tools** (implemented on `feat/public-mcp`)

- [x] Flat-schema → normalized `ServerFilter` builder in `defaultFilter` key
      order, with the log2 / 500-GB encodings taken from `MATCH_ALERTS_SQL`
- [x] `list_alerts`, `create_alert`, `delete_alert`
- [x] `MAX_ALERTS` surfaced as an actionable error naming `delete_alert`
- [x] Net EUR → **gross whole EUR** at the D1 boundary (not cents — see the
      corrected note above)
- [x] `mcp()` plugin enabled; migration 0017 adds the OAuth tables
- [x] Conditional tool listing on `Authorization`; an invalid token degrades to
      the public surface rather than erroring
- [x] Apply migration 0017 to remote D1 **before** pushing — 9 commands,
      2026-07-25. Three empty OAuth tables; 2704 users and 182 alerts untouched;
      `PRAGMA foreign_key_check` clean.
- [ ] Walk the OAuth connect flow with a real MCP client end to end

**Deferred**

- [ ] `price_history` via pre-aggregated KV blob
- [ ] Per-auction historical price context in `search_auctions` results
- [ ] Snapshot currently stores plain JSON; KV compresses in transit, so gzipping
      the value only matters if the dataset grows substantially
