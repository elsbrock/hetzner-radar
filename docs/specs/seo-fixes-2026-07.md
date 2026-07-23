# SEO Fixes & Guide Page (July 2026)

## Intent

A competitor comparison (auction.akua.dev / hetzner-value-auctions.cnap.tech) showed our
technical SEO is fundamentally sounder, but surfaced four real gaps. This spec follows up on
`docs/specs/seo-content-revamp.md` and extends it in two places where that spec is now
outdated:

- It assumed auth-gated pages are "not indexed" — they are in fact emitted by the dynamic
  sitemap and carry no `noindex`.
- It scoped `/privacy`, `/terms`, `/contact` out — but with the root-layout meta fallbacks
  removed (see below), these pages need minimal own tags so they don't ship with none.

The competitor's only ranking asset is a single long-form guide page. We close that content
gap with a combined help/guide page (user direction: help content for the auction search,
resource availability, and alerting, plus background on how Server Radar works, how the
Hetzner auction works, and what happened to prices / Hetzner news).

## Architecture / Decisions

1. **Root layout owns only global tags** (viewport, author, favicon, theme-color, `WebSite`
   JSON-LD). The hardcoded `canonical: https://radar.iodev.org/`, `description`, `keywords`
   (legacy, ignored by Google), `robots` and `og:*` fallbacks are removed from
   `src/routes/+layout.svelte`. Rationale: SvelteKit does not deduplicate `<meta>`/`<link>`
   between layout and page heads, so every page with its own head currently ships *two*
   canonicals — the layout one claiming `/` is canonical for every URL. Every indexable page
   already has (or gets, in this spec) its own complete head, so fallbacks are not needed.
2. **Auth/session pages are excluded from the sitemap and noindexed.**
   `excludeRoutePatterns` in `src/routes/sitemap.xml/+server.ts` for `/auth/*`, `/alerts`,
   `/cloud-alerts`, `/settings`; `noindex` meta via a `+layout.svelte` head in `(authed)`
   and on the two auth pages.
3. **`/analyze` gets a crawlable identity**: unique title/description/canonical/OG plus a
   short server-rendered intro block (visible above the tool) so the page is no longer an
   empty shell ("Hang tight") to crawlers. No behavioural changes to the tool itself.
4. **`/privacy`, `/terms`, `/contact` get minimal heads** (title, description, canonical) —
   no schema, no copy changes.
5. **New `/guide` page** (linked as "Guide" in the footer Resources section): long-form,
   fully server-rendered. Sections:
   - How the Hetzner server auction works (background, sourced facts)
   - What happened to auction prices (notable Hetzner news/price developments, sourced)
   - How Server Radar works (data collection, what we track)
   - Using the auction search (`/analyze`) effectively
   - Tracking resource availability (`/cloud-status`)
   - Price alerts (email/Discord, target price semantics)
   JSON-LD: `Article` + `BreadcrumbList` + `FAQPage` (3–6 real questions). Tone per
   `seo-content-revamp.md` (pragmatic, no marketing-speak, don't invent features; facts about
   Hetzner sourced from research, uncertain claims cut).
6. Changelog entry for the guide page (noteworthy feature); technical SEO fixes get none.

## Trade-offs

- Removing layout fallbacks means a future page added without a head has no description —
  accepted; the sitemap is the checklist and `seo-content-revamp.md` documents the pattern.
- `robots: index,follow` meta dropped entirely (indexing is the default; keeping it in the
  layout would conflict with per-page `noindex`).
- `/guide` vs `/help` naming: guide matches the informational search intent (how the
  auction works) while still serving as the help page.

## Implementation Steps

- [ ] Remove page-level meta fallbacks from `src/routes/+layout.svelte`
- [ ] Sitemap excludes + `noindex` for auth/authed routes
- [ ] Minimal heads for `/privacy`, `/terms`, `/contact`
- [ ] `/analyze`: head + server-rendered intro copy
- [ ] `/guide` page with content, schema, footer link
- [ ] Changelog entry for the guide
- [ ] `npm run check` + `npm run lint` clean; verify heads in page source
