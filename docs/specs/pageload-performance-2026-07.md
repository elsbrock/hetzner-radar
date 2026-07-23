# Page Load Performance (July 2026)

## Intent

Initial page loads feel sluggish and shift around (CLS), while client-side navigation is
fast. Reported symptoms: nav reflows on load (line break between icon and label), the
"what's new" banner pops in late, general lack of snappiness.

## Root causes found

1. **DuckDB initialized on every page.** The root layout's `onMount` calls
   `initializeDB()`, which instantiates DuckDB WASM (multi-MB from jsDelivr) _and_
   downloads the full `sb.duckdb` database — with a `?cb=${Math.random()}` cache-buster,
   i.e. a full re-download on every single page view, including `/about` and `/guide`
   which never query it.
2. **FontAwesome CSS is injected at runtime.** No `config.autoAddCss = false` + static
   CSS import, so server-rendered SVG icons are unstyled (wrong size → nav items wrap)
   until the FA JS runs. This is the nav reflow.
3. **Banner pops in after hydration.** `Banner.svelte` starts hidden and only decides
   visibility in `onMount` (localStorage), so for every user who hasn't dismissed it the
   banner appears late and pushes the whole page down (CLS).

## Fixes

1. **Lazy DB init**: remove `initializeDB()` from the root layout. Pages/components that
   actually query DuckDB initialize it idempotently on mount/open: `/analyze`,
   `/configurations`, `/statistics`, `ServerDetailDrawer` (on open), SQL console (already
   does). `tearDownDB` stays in the root layout.
2. **Cache-buster bucketing**: `cb` becomes a 5-minute time bucket so the DB file can be
   served from HTTP cache across navigations/reloads within the window (data updates
   every few minutes; ≤5 min staleness is acceptable and matches the update cadence).
   `reloadDB` (explicit refresh) keeps a random buster to force freshness.
3. **FontAwesome**: `config.autoAddCss = false` + static import of
   `@fortawesome/fontawesome-svg-core/styles.css` in the root layout so icon CSS is in
   the initial stylesheet.
4. **Banner without CLS**: banner is server-rendered visible by default; a small
   pre-paint script in `app.html` (next to the theme script, same localStorage read)
   hides dismissed banners via injected CSS before first paint. The banner element id
   encodes id+version (`banner-<id>-v<version>`), so bumping the version in the layout
   automatically un-hides for everyone. Zero shift for both dismissed and non-dismissed
   users.

## Trade-offs

- Bucketed cache-buster means up to 5 minutes of staleness on the auction dataset for
  repeat navigations — same order as the data update cadence; the outdated-data alert
  still offers an explicit fresh reload.
- Pre-paint banner script duplicates the "read `sr-settings` from localStorage" logic in
  plain JS (app.html can't import TS). Kept tiny and defensive.

## Implementation steps

- [x] Root layout: drop eager `initializeDB`, add FA CSS config
- [x] `initializeDB()` on mount in analyze, configurations, statistics; on open in
      ServerDetailDrawer
- [x] Bucketed `cb` in `dbapi.initDB`, random for `reloadDB`
- [x] Banner SSR-visible + pre-paint hide script in `app.html`
- [x] Verify: no DuckDB/sb.duckdb network activity on `/`, `/guide`, `/about`; nav does
      not reflow; banner visible in SSR HTML and hidden pre-paint when dismissed
