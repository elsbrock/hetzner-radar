# Grandfathered Server Marketplace (Legacy-Price Listings)

Status: not yet implemented — ToS gate cleared (see "ToS & Hetzner-relationship
review", 2026-07). Recommend a validation probe (Phase 0) before Phase 1.

## Intent

Hetzner lets customers transfer servers between accounts, and — critically —
the server's **legacy (grandfathered) price survives the transfer**:

- **Dedicated (Robot):** token-based transfer between customers; existing
  contracts "keep their terms and conditions" per the 15 June 2026
  standardization notice. Price increases apply only to new orders and
  rescales.
- **Cloud:** project-invite transfer (buyer creates a project, invites the
  seller, seller moves the server in). Per Hetzner's billing FAQ, transferring
  a server to another project **preserves legacy pricing as long as the target
  project uses the same currency**; a different currency, a rescale, or
  restoring a deleted server triggers repricing.

Because Hetzner's June 2026 increases only touch new orders, an old contract is
now worth measurably more than a fresh one, and people already trade these
informally in the Hetzner forums. Radar is uniquely positioned to surface the
value: it already tracks current retail (`standard` / `fixed_price`) prices and
the live auction floor, so it can compute the **current-equivalent price** for
any configuration and therefore the **savings** a legacy server represents.

This feature adds a **classifieds / matching board**, not a brokerage. Radar
never touches money and never executes the transfer. Sellers list a server and
their monthly price; Radar computes and displays the savings vs. buying
equivalent hardware today; buyers browse and contact sellers; the two parties
complete the Hetzner transfer and payment themselves, off-platform.

### Why not a full brokerage (escrow + fee)

Handling payments between strangers turns Radar from a passive info tool into a
regulated financial intermediary (escrow, chargebacks, fraud liability, and
possible money-transmission/KYC obligations under EU/BaFin rules). The transfer
also can't be guaranteed — it needs Hetzner's cooperation plus both parties'
identity and agreement — so Radar would become the party blamed when a deal
goes wrong. Per-unit deltas are thin (cloud especially: ~€1/mo on a small
instance), so a transaction fee doesn't cover the support cost. Hetzner
tolerates — even hosts — classifieds-style transfers (see the ToS review: their
forum "Marktplatz" is exactly this board), but a money-handling broker is a
different animal: it undercuts the price increase they just pushed through and
gives them a single, concrete party to act against. The classifieds model
captures the defensible value — Radar's pricing data and the match — without any
of that exposure.

## ToS & Hetzner-relationship review (2026-07)

Done as the gate before building (see implementation steps). Sources: Hetzner's
Robot server-transfer docs, the Cloud billing FAQ, the 15 June 2026
standardization press release + FAQ, the AGB (terms & conditions), and the
Hetzner forum. Findings:

- **No anti-circumvention or anti-resale language anywhere.** Not in the AGB, the
  standardization FAQ/press release, the cloud billing FAQ, or the transfer docs.
  The cloud FAQ enumerates repricing *triggers* (currency change, rescale,
  restore) as plain billing mechanics, not as an anti-abuse posture. (This
  corrects the "explicit anti-circumvention posture" framing that used to be in
  "Why not a full brokerage" — that posture does not exist.)
- **Hetzner sanctions — and hosts — customer-to-customer transfers.** Their own
  Robot docs direct sellers to the forum **"Marktplatz"** to "search for or write
  an offer to transfer a dedicated root server to another customer." Radar's
  board is a better-tooled version of something Hetzner already runs, not an
  adversarial one. This is the single biggest de-risking finding.
- **Transfer mechanics (dedicated / Robot):** token-based. Seller must hold the
  server ≥31 days, creates a 7-day transfer token, buyer redeems it; billing
  splits at the transfer moment (seller pays before, buyer after). No
  relationship or commercial-purpose restriction.
- **AGB §2.8** requires Hetzner's consent to transfer contractual rights to a
  third party — but the token flow *is* that consent mechanism (Hetzner-issued
  tooling that creates a fresh contract for the buyer). Not a blocker.
- **Grandfathered price survival:**
  - *Cloud* — verified. A same-currency project transfer preserves legacy
    pricing; a different currency, a rescale, or restoring a deleted server
    reprices to current rates.
  - *Dedicated* — strong inference, **not yet a verbatim guarantee.** "Existing
    contracts keep their terms and conditions"; new prices apply only to "new
    orders and rescales"; a transfer is neither. No Hetzner sentence explicitly
    states that a transferred server keeps its old price *for the new owner*.
    **Open action:** confirm via a support ticket or one real Marktplatz trade
    before betting the dedicated MVP on it.

**Net:** the legal/ToS gate is green. The real risk shifts from "will Hetzner
allow it" to demand + competing with the incumbent forum Marktplatz (see
Decisions & trade-offs).

## Architecture

Listings are user data → **Cloudflare D1** (like alerts). Savings math needs the
auction/standard price data → **DuckDB WASM in the browser** (like every other
price computation in the app). The split mirrors the existing architecture:
`+page.server.ts` loads listings from D1, the browser enriches them with a
current-equivalent price and savings.

### D1 schema (new migration `0017_add_marketplace_listings.sql`)

(`0016` is reserved for the Phase 0 interest-capture table — see the
[legacy-server value calculator spec](./legacy-server-value-calculator-2026-07.md).)

```sql
CREATE TABLE marketplace_listing (
    id                TEXT PRIMARY KEY,              -- UUID
    user_id           TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    kind              TEXT NOT NULL CHECK(kind IN ('dedicated','cloud')),
    title             TEXT NOT NULL,                 -- seller-provided, <=100 chars
    -- hardware descriptor, JSON snapshot captured at listing time so the card
    -- renders without a live match (cpu, ram_size, disks, location, extras;
    -- for cloud: server_type_id + location_id)
    specs             TEXT NOT NULL,
    monthly_price     INTEGER NOT NULL,             -- seller's price, net cents
    currency          TEXT NOT NULL DEFAULT 'EUR',  -- matters for cloud transfers
    -- current-equivalent price snapshotted at creation for sorting/history;
    -- the live figure is recomputed in-browser on render
    equivalent_price  INTEGER,                       -- net cents, nullable
    notes             TEXT,                          -- free text, <=1000 chars
    contact           TEXT NOT NULL,                 -- how to reach the seller (see below)
    status            TEXT NOT NULL DEFAULT 'active'
                        CHECK(status IN ('active','pending','sold','withdrawn')),
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at        DATETIME NOT NULL              -- auto-expire to keep board fresh
);

CREATE INDEX idx_marketplace_active ON marketplace_listing(status, expires_at);
CREATE INDEX idx_marketplace_user   ON marketplace_listing(user_id);
```

### Current-equivalent price & savings (browser / DuckDB)

Reuses the existing aggregation logic in `src/lib/api/frontend/filter.ts` and
`src/lib/api/shared/configurations.ts`. For a dedicated listing's spec, the
current-equivalent price is:

```
min(
  cheapest current `standard` (fixed_price) server matching the spec,
  current auction floor (MAX_BY(price, seen)) for the equivalent config
) + HETZNER_IPV4_COST_CENTS
```

Savings shown on the card: `equivalent - monthly_price` (absolute) and
`(equivalent - monthly_price) / equivalent` (percent). Matching is a heuristic
(CPU family + cores, RAM tier, total disk); when no confident match exists the
card shows the seller's price only, flagged "no current equivalent found",
rather than a misleading number. **Cloud has no price data yet** (see phasing) —
cloud savings are out of scope until a cloud pricing feed is added.

### Backend API (`src/lib/api/backend/marketplace.ts`)

Mirrors `alerts.ts` / `cloud-alerts.ts`:
`getActiveListings(db, filters?)`, `getListingsForUser(db, userId)`,
`createListing(...)`, `updateListing(...)`, `setListingStatus(...)`,
`deleteListing(...)`, `isBelowMaxListings(db, userId)` (cap, e.g. 5/user).

### Frontend

- **`/marketplace`** — public browse page (`+page.server.ts` loads active
  listings; `+page.svelte` computes savings in-browser against DuckDB). Cards
  show spec, seller monthly price, current-equivalent, savings € / %, currency,
  and a "Contact seller" action. Filter/sort by savings, price, spec.
  Prominent disclaimer banner (unaffiliated; caveat emptor; transfer is between
  the parties).
- **Create/edit listing modal** (auth-gated) — reuses `ServerFilter` spec
  inputs, `VatSelector`, currency selection; captures monthly price + notes +
  contact.
- **"My listings"** — management view (new tab on the alerts hub or a section
  on the marketplace page): edit, mark sold/withdrawn, delete.
- **Nav** — add a "Marketplace" link.

### Contact / anti-abuse

- **Contact relay (preferred):** buyer submits interest via a form → Radar
  emails the seller (reusing the notification/email plumbing). Avoids exposing
  seller emails to scrapers; rate-limited per user/IP. If deferred, MVP allows a
  seller-provided contact string (email/handle) shown only to logged-in users.
- **Report/flag** button on each listing → manual moderation initially (small
  volume). Listings auto-expire (`expires_at`) so the board stays current.

## Safety & trust

Radar never touches money or executes the transfer, so it can't *guarantee*
safety — but the transaction is two strangers moving a server off-platform,
which is the classic fraud setup (buyer pays and gets no transfer; seller
transfers and gets no payment; misrepresented specs; a silent rescale or
currency change that reprices what the buyer thought was a legacy server).
Keeping it "reasonably safe" is layered:

1. **Structural (already decided).** Classifieds, not brokerage — no escrow, no
   payments, no transfer execution, no identity claims. Radar is never a party to
   the deal, so it carries no financial-intermediary or dispute liability. This
   is the foundation; everything else is hygiene on top.
2. **Platform hygiene (build in Phase 1).**
   - Auth-gate listing *and* contact: only logged-in, email-verified accounts can
     post or reach a seller. Raises the cost of throwaway scam accounts.
   - Contact relay over exposed emails (see "Contact / anti-abuse"): no scrapable
     seller addresses; rate-limited per user/IP.
   - Per-user listing cap (≈5) + creation rate limit; auto-expiry (`expires_at`)
     stops the board filling with stale/abandoned bait.
   - Report/flag on every listing → manual moderation at current volume.
3. **Scam-prevention UX (the part that actually protects users).**
   - A short, unmissable safety note *at the point of contact*, not buried in
     Terms: "Radar handles no money and no transfers. Agree terms, then use
     Hetzner's official token flow. Never pay before the transfer shows up in
     your own Hetzner account."
   - Link to Hetzner's official transfer procedure and the forum Marktplatz
     best-practices, so users follow a known-safe sequence instead of improvising.
   - Lean on the ordering Hetzner's own flow enables: the token is created only
     after agreement, and the buyer can confirm the server is in their account
     before releasing payment.
4. **Honest numbers (don't let the headline mislead).**
   - Currency badge on every listing — a cross-currency cloud transfer reprices,
     so the "savings" would be fiction; surface it so buyers self-filter.
   - "No confident current equivalent found" flag instead of a made-up figure
     when matching is uncertain (see the equivalent-price section).
   - A standing caveat that legacy-price survival is Hetzner's call, not Radar's —
     especially for dedicated (see ToS review open action). Radar shows the
     *potential* saving, never a promise.
5. **Legal posture.** Disclaimer banner (unaffiliated; used hardware; Radar not a
   party) + Terms/Privacy update + GDPR-clean handling of seller contact data
   (relay minimizes what's stored/exposed) + a pointer to Hetzner's official docs.

Explicitly out of scope for safety: Radar does **not** verify server ownership,
vet sellers, or arbitrate disputes — and must never imply it does, since that
would create the reliance it can't back.

## Decisions & trade-offs

- **Classifieds, not brokerage.** No money, no escrow, no transfer execution —
  see "Why not a full brokerage" above. This is the single most important
  scoping decision and the reason the feature is safe to ship.
- **Seller enters the price; Radar computes the equivalent.** Radar has no
  access to a user's Hetzner account, so it cannot know the grandfathered price.
  The authoritative, differentiated number Radar provides is the
  current-equivalent price and the resulting savings.
- **Dedicated first, cloud later.** The `standard`/`fixed_price` data needed for
  a dedicated current-equivalent already exists; cloud pricing is not ingested
  today, so cloud listings would show no savings. Cloud waits for a pricing
  feed.
- **Snapshot specs + equivalent at creation, recompute live on render.** The
  snapshot keeps cards renderable and sortable server-side; the live recompute
  keeps the headline honest as prices move.
- **Currency is first-class.** Surfaced on every listing because a cloud
  transfer across currencies reprices — buyers must see the seller's currency to
  know a legacy-price transfer is even possible.
- **Contact relay over public emails** to limit scraping/abuse; can start with a
  visible contact string if relay is deferred.
- **Terms/disclaimer update required** before launch: unaffiliated with Hetzner,
  no warranty on used hardware, Radar is not a party to any transaction, and a
  pointer to Hetzner's official transfer docs.
- **The incumbent is Hetzner's own forum Marktplatz.** Radar isn't creating the
  market; it's competing with a free board that already reaches every Hetzner
  customer. Radar's only durable wedge is the thing the forum has zero of: the
  **savings computation** (legacy price vs. current-equivalent) and, later,
  buyer-side match alerts. Scope the pitch as "a savings/matching layer," not "a
  marketplace," and consider pointing at / mirroring forum listings rather than
  launching from an empty board.

## Implementation steps

Phase 0 — validate before building (cheap; no marketplace schema):
- [x] Spec (this document)
- [x] Confirm no ToS blocker — done 2026-07 (see "ToS & Hetzner-relationship
      review"): no anti-resale / anti-circumvention language; Hetzner hosts its
      own transfer "Marktplatz". Gate is green. One open action: confirm the
      dedicated legacy-price survives a transfer, via support ticket / real trade.
- [ ] **"What's your legacy server worth?" calculator** — a public page that
      reuses the current-equivalent math (`src/lib/api/frontend/filter.ts`,
      `src/lib/api/shared/configurations.ts`) and the `ServerFilter` / `VatSelector`
      inputs to show a seller their savings vs. buying equivalent hardware today,
      with a soft "notify me when a marketplace launches" email capture (small new
      D1 table + POST endpoint; no full listing schema). No moderation, no Terms
      rewrite. Ships Radar's differentiator standalone and measures seller/buyer
      demand before committing to the board.
- [ ] Go/no-go on Phase 1 from probe signal (interest sign-ups vs. calculator use)

Phase 1 — dedicated MVP (classifieds board):
- [ ] Migration `0017_add_marketplace_listings.sql`
- [ ] Backend API `marketplace.ts` (CRUD + caps + validation)
- [ ] `/marketplace` browse page + in-browser savings computation
- [ ] Create/edit listing modal + "My listings" management
- [ ] Contact: relay email (or interim contact string) + rate limiting
- [ ] Report/flag + listing auto-expiry
- [ ] Disclaimer banner + Terms/Privacy update + Nav link
- [ ] `npm run check` / lint / tests green

Phase 2 — buyer-side match alerts:
- [ ] Reuse the `price_alert` filter to notify buyers when a new listing matches
      their criteria (new notification event `marketplace_listing.matched`,
      wired through the existing channel plumbing)

Phase 3 — cloud listings:
- [ ] Ingest Hetzner Cloud pricing (server-type prices) into a queryable store
- [ ] Cloud current-equivalent + savings, with same-currency transfer caveat
- [ ] Cloud listing create/browse

Out of scope (explicitly not building): escrow/payments, transfer execution or
automation, identity verification, dispute resolution, any per-transaction fee.
```

Monetization, if pursued later, is a listing/subscription model layered on top —
never a cut of the transaction.
