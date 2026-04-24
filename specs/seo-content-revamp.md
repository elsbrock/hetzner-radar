# SEO Content Revamp

## Intent

Hetzner Server Radar has substance (real data, real tools) but its content pages haven't been tuned for SEO — most inherit a single generic meta description from `src/routes/+layout.svelte`, every page has the same canonical, and several pages end with filler "scenarios" copy that signals low-value content under Google's helpful-content framework.

This spec is a shared playbook for revamping all major content pages. It sits alongside `specs/configurations-rework.md` (which fixed the ranking logic) and covers:

- Unique `<svelte:head>` per page (title, description, canonical, OG, Twitter)
- Page-appropriate JSON-LD (BreadcrumbList on every page; ItemList / FAQPage / Article / StatisticalStudy where they fit)
- Removing generic filler, adding data-backed or internal-linking content
- Tighter headings with real search intent

Out of scope: per-CPU / per-configuration landing pages (the next big SEO lever — covered by a separate spec to be written after this one lands).

## Tone & style (applies to all copy)

- Pragmatic and slightly opinionated. No marketing-speak, no exclamation points, no "discover / unlock / empower" vocabulary.
- Match the existing voice on `/about` — confident, plain, technical where it needs to be.
- Short sentences. Active voice. No emoji in copy.
- Prefer concrete over vague: "Track the 500+ live Hetzner server auctions" beats "Find the perfect server for your needs".
- Don't invent features. If a claim isn't backed by something the site does, cut it.

## Meta tag pattern (every page)

Use a `<svelte:head>` block on each page with:

- `<title>` — 50–60 chars. Format: `<Page Topic> — Server Radar` or `<Page Topic> | Hetzner Server Radar`. Include a primary keyword.
- `<meta name="description">` — 140–155 chars. Specific to the page. First 120 chars carry the message.
- `<link rel="canonical" href="https://radar.iodev.org/<path>">` — absolute, trailing slash only for root.
- Open Graph: `og:title`, `og:description`, `og:url`, `og:type` (`website` for hubs, `article` for changelog entries), `og:image` (reuse root `og-image.webp` unless page-specific exists).
- Twitter card: `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`.
- Page-specific `<meta name="robots">` only if different from `index,follow`.

The root layout provides author, viewport, favicon, theme-color — pages should **not** duplicate those.

## JSON-LD (every page)

- **Always:** `BreadcrumbList` for non-root pages (`Home → <Page>`).
- **Landing / hub pages:** extend the existing root `WebSite` schema with `potentialAction: SearchAction` if there's a real search surface.
- **Data pages** (`/statistics`, `/configurations`, `/cloud-status`): use `Dataset` or `ItemList` where the page genuinely shows enumerated entities.
- **FAQ blocks:** any page with a real FAQ section emits `FAQPage` JSON-LD. Limit to 3–6 questions; only ones real users ask.
- **Article-style pages** (`/about`, `/changelog`): `Article` with `datePublished` / `dateModified`.

Keep JSON-LD truthful — Google demotes pages where rich data doesn't match visible content.

## Page-by-page scope

### `/` (landing)

- Unique `<svelte:head>` with title targeting "Hetzner dedicated server price tracker" (or similar — pick one primary keyword, don't keyword-stuff).
- Keep `HeroSection`, `LiveMetrics`, `ConfigurationsTeaser`, `StatisticsTeaser`, `OpenSourceBanner`.
- Review `FeaturesSection`, `ScreenshotCarousel`, `FAQSection`, `TestimonialsSection` — cut anything generic. FAQ should keep and emit FAQPage schema.
- Update `ConfigurationsTeaser.svelte` to feature the new **Best Price/Performance** category introduced by `specs/configurations-rework.md` — currently it only links to affordable/ram/storage/nvme.
- Add `SearchAction` potentialAction pointing to `/analyze` if feasible.

### `/configurations`

- Add `<svelte:head>` (page was just reworked in `specs/configurations-rework.md`, but SEO bits were deferred).
- Emit one `ItemList` with `Product` entries per category (6 lists), each product showing CPU, RAM, storage, `offers.price`.
- Drop the "Common Usage Scenarios" block — it's generic filler with no links, no data. Replace with a small data-backed block: live CPU-generation breakdown, or top-N CPU families with listing counts, each deep-linking into `/analyze` with pre-applied filters.
- Replace the "Ready to Explore More?" CTA with a specific one: "Browse all N live auctions →" where N comes from the snapshot metadata already loaded.

### `/statistics`

- Add `<svelte:head>` targeting "Hetzner server price history" / "Hetzner auction statistics".
- Add a concise intro paragraph above the first chart explaining what the page tracks and over what window.
- JSON-LD: `Dataset` schema (name, description, temporalCoverage, variableMeasured listing the indices tracked).
- Cross-link to `/analyze` and `/configurations` at natural points.

### `/cloud-status`

- Add `<svelte:head>` targeting "Hetzner cloud availability" / "Hetzner cloud server stock".
- Intro paragraph above the availability matrix explaining what data drives the page.
- JSON-LD: `Dataset` schema covering availability-over-time.
- Keep the recent rework intact — only add head tags, schema, and a short intro.

### `/about`

- Unique `<svelte:head>` with personal framing ("Why I built Server Radar").
- JSON-LD: `Article` with `author: Person` (Simon Elsbrock) and `datePublished`.
- Tighten copy if generic sentences crept in — prioritize the why/how over boilerplate.

### `/changelog`

- Already has a page-specific `<meta name="description">` — upgrade to full meta set (canonical, OG, Twitter).
- Emit `Article` or `Blog` JSON-LD with entries.
- No copy changes needed unless something is stale.

### Out of scope

- `/contact`, `/privacy`, `/terms` — leave alone (low SEO value, short content, often have templated copy that's fine as-is).
- Auth-gated pages (`/alerts`, `/settings`) — not indexed.

## Shared implementation notes

- Put the `<svelte:head>` block at the top of each `+page.svelte`, right after the `<script>` block.
- For dynamic content in JSON-LD (e.g. listing counts, snapshot timestamps), compute in `+page.server.ts` or in the derived state and render as a JSON string. Sanitize anything user-controlled — these pages are all server-controlled so this is mainly about escaping quotes in strings.
- Use absolute URLs in OG / canonical / JSON-LD, not relative. Base: `https://radar.iodev.org`.
- Don't repeat the root `WebSite` schema on subpages — it's already emitted by `src/routes/+layout.svelte`.

## Verification per page

- [ ] `npm run check` clean
- [ ] `npm run lint` clean
- [ ] Open page in dev, confirm `<head>` has unique title, description, canonical
- [ ] View page source, confirm JSON-LD parses (paste into https://validator.schema.org if in doubt)
- [ ] Lighthouse SEO score ≥ 95 on each page (mobile + desktop)

## Execution order

1. `/configurations` (SEO bits only — core rework is already merged)
2. `/` (landing) — biggest SEO lever
3. `/statistics`
4. `/cloud-status`
5. `/about`
6. `/changelog`

Each page lands as its own commit so review stays manageable.
