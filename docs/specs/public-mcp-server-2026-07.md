# Public MCP Server (Model Context Protocol)

Status: proposed (July 2026)

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
- `price_alert.price` is **INTEGER cents** (`parseInt(price, 10)` in
  `createAlert`), alongside `vat_rate` and `includes_ipv4_cost`. Same concept,
  different unit, different table.
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

| Tool                 | Auth | Source           |
| -------------------- | ---- | ---------------- |
| `search_auctions`    | no   | KV snapshot      |
| `get_auction`        | no   | KV snapshot      |
| `cloud_availability` | no   | `RADAR_WORKER`   |
| `list_alerts`        | yes  | D1 `price_alert` |
| `create_alert`       | yes  | D1 `price_alert` |
| `delete_alert`       | yes  | D1 `price_alert` |

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
a generic failure. Price inputs are EUR in the tool schema, converted to cents at
the D1 boundary.

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

**Phase 1 — snapshot pipeline**

- [ ] Add KV namespace; bind to worker (write) and main app (read)
- [ ] Resolve pricing per auction at import (`ip_price`, `setup_price`,
      `fixed_price`, `hourly_price`, `next_reduce_timestamp`)
- [ ] Write gzipped snapshot to `snapshot:current` after `db.batch()` succeeds
- [ ] Module-scope read cache with 5 min TTL

**Phase 2 — public read tools**

- [ ] `POST /mcp` — `initialize`, `tools/list`, `tools/call`
- [ ] `search_auctions` (flat schema, optional `vat_rate`), `get_auction`
- [ ] `cloud_availability` via `RADAR_WORKER`
- [ ] Result caps, `Cache-Control`, revisit `RATE_LIMIT` for MCP traffic
- [ ] Verify against a real MCP client

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
- [ ] Apply migration 0016 to **remote** D1 (`--remote`) — not yet done
- [ ] Exercise the login flow against a real deployment (so far: typecheck,
      lint, unit tests, production build, and a local D1 migration)
- [ ] Communicate forced logout

**Phase 4 — alert tools**

- [ ] Flat-schema → normalized `ServerFilter` builder with stable key order
- [ ] `list_alerts`, `create_alert`, `delete_alert`
- [ ] `MAX_ALERTS` surfaced as an actionable error
- [ ] EUR → cents conversion at the D1 boundary
- [ ] Conditional tool listing on `Authorization`

**Deferred**

- [ ] `price_history` via pre-aggregated KV blob
- [ ] Per-auction historical price context in `search_auctions` results
