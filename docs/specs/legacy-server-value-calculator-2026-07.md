# Legacy Server Value Calculator (Phase 0 demand probe)

Status: not yet implemented — validation probe for the
[grandfathered server marketplace](./grandfathered-server-marketplace-2026-07.md).

## Intent

Before committing to the full marketplace (D1 listing schema, moderation, a Terms
rewrite, and forever-cost scam-report handling), ship the one piece that is both
Radar's real differentiator and nearly free to build: a public calculator that
tells a Hetzner customer what their legacy/grandfathered server is worth today —
i.e. how much they'd save versus buying equivalent hardware new after the
15 June 2026 price increases. Pair it with a soft "notify me when a marketplace
launches" capture so we measure real demand before building the board.

Two goals:

1. **Validate demand.** Do sellers with legacy contracts actually exist and want
   to act? The seller-side interest sign-ups vs. calculator-usage ratio is the
   go/no-go signal for marketplace Phase 1. Sellers are the scarce side — the
   board is worthless without them, and the incumbent forum Marktplatz already
   aggregates the ones who know to look.
2. **Ship the differentiator standalone.** The savings math is the thing the
   forum Marktplatz has zero of. It has standalone value (a customer deciding
   whether to hold, sell, or rescale a legacy server) even if the marketplace
   never ships — so this is a cheap outcome either way.

Non-goals: no listings, no user-to-user contact, no transfers, no payments, no
moderation, no Terms rewrite. Those are marketplace Phase 1.

## Architecture

Client-side compute + one small persistence table, mirroring the app's existing
split (DuckDB WASM in the browser for price math; D1 for user data).

- **Page:** `/legacy-value` — public, no auth required
  (`src/routes/legacy-value/+page.svelte`).
- **Inputs:** reuse the `ServerFilter` spec inputs (CPU family/cores, RAM, disks,
  location, extras) and `VatSelector` (net/gross + currency). Add one field: the
  user's current monthly price (what they pay today).
- **Compute (browser / DuckDB):** reuse the current-equivalent logic from
  `src/lib/api/frontend/filter.ts` and `src/lib/api/shared/configurations.ts` —
  the same formula the marketplace spec defines:

  ```
  min(
    cheapest current `standard` (fixed_price) server matching the spec,
    current auction floor for the equivalent config
  ) + HETZNER_IPV4_COST_CENTS
  ```

  Show the current-equivalent price and savings € / % (`equivalent − user's
  price`). When no confident match exists, show "no current equivalent found"
  instead of a misleading number — the same heuristic and honesty rule as the
  marketplace.
- **Interest capture (D1):** a soft CTA — "Notify me when a legacy-server
  marketplace launches" — collecting email + role (buyer/seller/both) and,
  optionally, the computed spec + savings snapshot for demand analytics.

### D1 schema (new migration `0016_add_marketplace_interest.sql`)

```sql
CREATE TABLE marketplace_interest (
    id            TEXT PRIMARY KEY,            -- UUID
    email         TEXT NOT NULL,
    role          TEXT CHECK(role IN ('buyer','seller','both')),
    kind          TEXT CHECK(kind IN ('dedicated','cloud')),
    -- optional snapshot for demand analytics: spec, their price, computed equivalent
    context       TEXT,                         -- JSON, nullable
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_marketplace_interest_email ON marketplace_interest(email);
```

This probe ships first, so it takes migration `0016`; the marketplace's
`marketplace_listing` table is renumbered to `0017` in its spec.

### Endpoint

`POST /api/marketplace-interest` (`+server.ts`) — validate email, dedupe on
email, rate-limit per IP (reuse the existing rate-limit pattern). Capture only —
no email is *sent* here; the eventual "we launched" notification is a manual
one-off send. This deliberately avoids wiring up the notification/email plumbing.

### Discoverability / entry points

Placement matters here because it *is* the demand signal — bury the page and low
traffic reads as "no demand" when it may just be "not seen." Drive it, but
reversibly:

- **Primary: announcement banner** (`Banner.svelte`, already wired into
  `+layout.svelte` — dismissible and version-keyed). A short "What's your legacy
  Hetzner server worth? →" banner is a natural follow-on to the `standard-servers`
  price-change banner already running, and reaches exactly the affected audience
  site-wide. Removable after the probe without touching nav.
- **Persistent: Footer "Resources" link** (`Footer.svelte`), alongside Analyze /
  Configurations, as a stable home for the page beyond the banner window.
- **Optional contextual CTA on `/analyze`** (the auction/price explorer — the
  view the marketplace spec loosely called the "auction/pricing view"; there is
  no `/pricing` route). Targets deal-hunters directly if a second surface helps.
- **Not** a primary nav pill. That's a permanent slot; reserve it for the real
  marketplace *after* the probe validates. Spending nav real estate on an
  experiment both over-invests and muddies the "was it wanted" read.

## Decisions & trade-offs

- **Capture only, no send.** The probe measures intent; it doesn't need the email
  channels wired. Keeps the build to a page + one table + one endpoint.
- **Reuse the marketplace math verbatim.** The calculator *is* the marketplace's
  savings engine with the listing layer removed — building it now de-risks and
  pre-writes the hardest part of Phase 1.
- **Optional context snapshot.** Storing `(spec, price, equivalent)` with each
  sign-up turns the probe into real demand data (which configs, how much saving)
  for the go/no-go call — worth the extra nullable JSON column.
- **Dedicated only.** Same reason as the marketplace: cloud pricing isn't
  ingested, so cloud savings can't be computed yet. A cloud calculator waits for
  the same pricing feed.
- **Migration `0016` here, `0017` for the marketplace listing.** The probe ships
  first; flagged in both specs so the numbers don't clash.

## Success criteria / go-no-go

Run for a few weeks, then decide marketplace Phase 1 on:

- Absolute count of **seller-role** interest sign-ups (the scarce side).
- Sign-up conversion among calculator users who see a meaningful saving.
- Qualitative inbound ("where do I list?").

If sellers don't materialise, the marketplace stays unbuilt and the calculator
remains a useful standalone tool.

## Implementation steps

- [x] Spec (this document)
- [ ] Route `/legacy-value` reusing `ServerFilter` / `VatSelector`, plus a
      current-price field
- [ ] Current-equivalent + savings compute (reuse `filter.ts` /
      `configurations.ts`); "no equivalent found" honesty flag
- [ ] Migration `0016_add_marketplace_interest.sql` +
      `POST /api/marketplace-interest` (validate, dedupe, rate-limit)
- [ ] Soft CTA + interest form (email + role + optional context snapshot)
- [ ] Entry points: announcement banner (`Banner.svelte`) as the primary,
      reversible driver + a Footer "Resources" link; no primary nav pill until the
      marketplace itself ships (see "Discoverability / entry points")
- [ ] `npm run check` / lint / tests green
- [ ] Run the probe; review sign-up data; go/no-go on marketplace Phase 1
