# Landing Page Redesign — Radar / Monitoring Visual Language

## Intent

The hero works and stays untouched. Everything below it read as a flat stack of
identical white bordered boxes — no hierarchy, no personality. This redesign gives
the sections below the hero a cohesive **instrument / radar monitoring** identity
that is faithful to the hero (orange signal on warm/dark surfaces, floating radar
dots) while making the page feel like a live tool rather than a brochure.

Growth is real (see numbers below), so the stats are **promoted, not deleted** —
surfaced as a single high-impact social-proof status bar instead of five equal cards.

Prod numbers at time of writing (D1 prod, 2026-07-01):
users 2,132 · price alerts 165 + cloud alerts 928 = 1,093 active · notifications
sent 821 + 34,744 = 35,565 · auctions tracked 155,010 · current batch 67.

## Scope

Keep every existing section. Restyle only. Sections, top → bottom:

1. Hero — **unchanged**
2. LiveMetrics → **social-proof status bar** (dark instrument strip)
3. FeaturesSection — restyle
4. ScreenshotCarousel — restyle (monitor bezel)
5. ConfigurationsTeaser — restyle
6. StatisticsTeaser — restyle
7. FAQSection — restyle
8. OpenSourceBanner — restyle

## Design language

Stack: SvelteKit 5 (runes) + Tailwind v4 + Flowbite. Light **and** dark mode. No
new web fonts — telemetry feel comes from `font-mono` + uppercase tracking on small
labels. Respect the documented marketing font hierarchy in `app.css`.

**Tokens / motifs**

- **Signal**: orange-500 (`#f97316`), matches the hero radar dots. Amber for warmth.
- **Live/online**: emerald-500 pulsing dot — the monitoring convention for "healthy/live".
- **Radar grid**: faint square-grid background texture on feature/atmosphere panels.
- **Section eyebrow**: a reusable `SectionEyebrow` — pulsing signal dot + monospace
  uppercase tracked label (e.g. `LIVE FEED`, `COVERAGE`, `RANKINGS`). Gives every
  section a consistent telemetry header above its `<h2>`.
- **Panels**: keep white / gray-800 surfaces but add depth — top hairline accent,
  hover lift, orange edge reveal on interactive cards. Kill the uniform border-box look.

**Social-proof band** (LiveMetrics) — iterated with the user. A boxed dark
instrument panel read as cluttered; a light pill with five stats + dividers still
read as cluttered; a boxless airy trio read as "floating". Final: a **full-width
band flush under the hero** (breaks out with `-mx-8` + `width: calc(100% + 4rem)`,
matching the hero), subtle `bg-gray-50` / `dark:bg-gray-900/50` surface, `border-b`
to separate from content. Just **three headline numbers** — users · alerts sent ·
auctions tracked — big, neutral, count up on load. Grounded, not floating; three
strong numbers instead of five weak ones. (The dropped `glance-last-batch` /
`glance-active-alerts` assertions were removed from `tests/landing.spec.ts`.)

## Implementation steps

- [ ] `app.css`: add `.radar-grid`, `.signal-ping`/pulse, scanline utilities (light+dark)
- [ ] `SectionEyebrow.svelte` reusable component
- [ ] LiveMetrics → status bar
- [ ] Restyle Features / Configurations / Statistics
- [ ] Restyle Carousel / FAQ / OpenSource banner + tighten `+page.svelte` rhythm
- [ ] `npm run check` clean

## Decisions / trade-offs

- **Keep-all-sections restyle** over a leaner rebuild — chosen by the user; lowest
  risk, preserves SEO content and existing tests/testids.
- **Dark strip in light mode**: bold, but reads as a control panel and anchors the
  page; the alternative (a light strip) blended into the hero and the cards below.
- **No custom fonts**: consistency with the rest of the app beats a landing-only
  display face; `font-mono` carries the telemetry cue.
- Preserve existing `data-testid` attributes on the metrics so E2E tests keep passing.
