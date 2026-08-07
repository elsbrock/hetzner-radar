# Statistics page rework: tabs, honest gaps, smoothing (August 2026)

**Status:** implemented (not yet deployed)
**Date:** 2026-08-07

## Intent

`/statistics` is one very long scroll with eight charts, all mounted at once, and
three problems that make the numbers harder to trust than they should be:

1. **Everything renders on one page.** Eight `GenericChart` canvases (one of them
   an 11-series stack, one a 26-series stack) are constructed on load, plus ~25
   DuckDB queries. There is no navigation: to reach the AMD CPU model chart you
   scroll past everything else. The section nesting is also broken — "Price
   Statistics", "Volume Statistics" and "CPU Statistics" are all nested _inside_
   the "Price Index" `<section>`.
2. **Missing days are drawn as straight lines.** The stats queries `GROUP BY` an
   observed day, so a day with no matching rows simply is not in the result. With
   a Chart.js time scale the neighbouring points get joined, and a datacenter that
   was absent for 34 of 90 days (`HEL1-DC10`) renders as a confident diagonal
   across the hole. `FSN1` and `NBG1` (bare, no `-DCn` suffix) appear on exactly
   one day each and become a spike joined to nothing.
3. **Daily minima are noisy, and the colours are random.** `GenericChart` calls
   `getRandomColor()` per series per effect run, so every data update, theme flip
   or resize repaints the whole chart in new colours. On the datacenter stacks
   that is 26 fresh random hues each time.

This spec addresses all three, plus the smoothed-line request.

## Architecture

### 1. Tabbed sections

The page becomes:

```
┌──────────────────────────────────────────┐
│  Key metrics (6 QuickStats, full width)  │   always visible
├───────────┬──────────────────────────────┤
│ ▸ Index   │  only the active tab's       │
│   Prices  │  charts are mounted          │
│   Volume  │                              │
│   CPU     │                              │
└───────────┴──────────────────────────────┘
```

| Tab         | `?tab=`  | Charts                                                        |
| ----------- | -------- | ------------------------------------------------------------- |
| Price index | `index`  | Overall price index                                           |
| Prices      | `prices` | €/GB RAM (ECC vs non-ECC), €/TB HDD, €/TB SSD, avg sold price |
| Volume      | `volume` | By country, by datacenter FI, by datacenter DE, Intel vs AMD  |
| CPU models  | `cpu`    | Intel models, AMD models                                      |

The tab strip is the sticky left rail (`sticky top-24`, 200px), reusing the visual
language of the `/guide` page's "On this page" nav — a left border with the active
item in orange — but as `role="tablist"` buttons rather than anchors, because these
switch panels rather than scroll. Below `lg` it collapses to a horizontally
scrollable strip above the content.

State lives in `?tab=`, written with `replaceState` so tab switching does not
create history entries but a tab _is_ linkable and survives reload. An unknown or
absent value falls back to `index`.

Key metrics stay outside the tabs: they are the page's headline and they need the
full width for six tiles.

Only the active panel is rendered (`{#if}`, not `hidden`), so at most four canvases
exist at a time. Data fetching is unchanged — one pass on load, because the queries
share DuckDB connections and splitting them per tab would serialise them behind tab
clicks for no real gain.

### 2. Gaps are gaps

New module `src/lib/chartSeries.ts`.

The fix cannot be "insert null wherever a day is missing", because _missing_ means
two different things:

- **Volume series** (count of listings): a day the crawler observed, where this
  datacenter/CPU/country had no listing, genuinely means **zero**. Zero-fill.
- **Price series** (min €/GB, min €/TB, index, avg sold): a day where no server of
  that shape was listed has **no price**. There is no defensible number, so the
  line must break.
- **A day nobody observed** (crawler outage): unknown for _every_ series. Break,
  regardless of kind.

So the page first fetches the set of observed days (`getObservedDays`, a single
`select distinct date_trunc('d', seen)`), builds a day grid from it, and aligns
every series onto that grid:

```ts
buildDayGrid(observedDays): DayGrid            // every calendar day min..max + observed set
alignSeries(stats, grid, 'zero' | 'gap'): TemporalPoint[]
```

`TemporalPoint` is `{ x: number; y: number | null }`. Chart.js breaks a line at a
`null` when `spanGaps` is false, which becomes the `GenericChart` default.

This matters most on the stacked volume charts: nulls in a stack would make the
bands above the hole drop to the baseline and misstate the total, whereas
zero-filling is both what actually happened and what stacks correctly.

### 3. Smoothing

`movingAverage(points, window)` computes a **centered** moving average (default
7 days). It is null-preserving in both directions:

- if the point at the centre is `null`, the output is `null` — a gap stays a gap
  rather than being bridged by its neighbours;
- nulls inside the window are skipped, and the average needs at least half the
  window present, so the curve does not lurch at the edges of a gap.

On the price charts (index, RAM, disk, SSD, sold price) a "7-day average" toggle —
on by default, one control at the top of the page — thins the raw series to a
1px 35%-alpha line and draws the average over it at 2.5px in the full series
colour. Legend entries read `NVMe` and `NVMe · 7d avg`.

Volume charts do not get the overlay: they are stacked areas where a second line
per band would be unreadable, and their day-to-day counts are meaningful.

Chart.js `tension` drops from 0.4 to 0 for raw lines — bezier tension was doing
cosmetic smoothing that overshoots and invents extrema. The moving average is the
honest version of that. The average line keeps a light 0.25 tension.

### 4. Stable colours

`seriesColor(index)` replaces `getRandomColor()`:

- slots 1–8 are the validated categorical palette from the data-viz reference
  (blue, orange, aqua, yellow, magenta, green, violet, red), with light/dark steps;
- past 8, deterministic golden-angle HSL, so a 26-series stack still gets distinct,
  **stable** colours.

Colour is assigned by the series' position in a fixed, sorted list, not by rank in
the current view, and never regenerated per render.

> Decision: the data-viz guidance is to fold past the 8th series into "Other".
> Rejected here on request — the Germany stack keeps all 26 datacenters. The
> stacked form plus an index-mode tooltip carries identity well enough, and losing
> `FSN1-DC22` into a grey band would defeat the point of the chart. Revisit if the
> legend proves unusable.

### 5. Key-metric audit

Reviewing the six tiles turned up six problems; the row is now five tiles.
Figures below are from the local January 2026 snapshot; the live numbers differ
but the structural problems do not.

| Tile         | Verdict                                                               |
| ------------ | --------------------------------------------------------------------- |
| Price Index  | correct value, unreachable subtitle — relabelled                      |
| 30-Day Trend | arrow stuck on mount, single-day endpoints — fixed, now smoothed      |
| Lowest Price | leaked listings via the vendor buckets — now `min(price)`             |
| AMD vs Intel | compared two unrelated machines — **dropped**                         |
| ECC Premium  | sign-inverted vs its name, confounded by RAM size — **now Best €/GB** |
| NVMe vs HDD  | 5× wrong from fixed-price contamination — fixed (1.1× → 6.2×)         |

**AMD vs Intel is gone.** It divided the cheapest AMD listing (€33) by the
cheapest Intel one (€29) — different RAM, disks and CPU generations. It reported
which vendor happened to be attached to the day's cheapest machine. A share-of-
listings tile would be honest, but the Volume tab already answers that; five
tiles is enough.

**ECC Premium becomes "Best €/GB RAM"**, an absolute. The old delta compared
ECC's minimum €/GB (€0.164 — a 256 GB Xeon E5-1650v3 at €42) against non-ECC's
(€0.273 — a 128 GB i7-8700 at €35) and reported "−40.0%" under a tile named
_premium_. ECC machines simply carry more RAM; the number measured capacity, not
error correction.

**Fixed-price listings corrupt every per-unit price.** Hetzner's configurable
offers store the configurator's drive _menu_ in `nvme_drives`, not one machine's
drives: `[512, 960, 1000, 1920, 2000, 3840, 7680, 15360]` — 33 TB — appearing
verbatim under two different CPUs on €37 and €44 listings, alongside a 45,720 GB
`sata_size`. Since `getDiskPriceStats` takes a **minimum**, one such row sets the
value for the entire day. Excluding `fixed_price = TRUE` moves the last day's
NVMe minimum from €1.14/TB to €6.30/TB, and the NVMe-vs-HDD tile from 1.1× to
6.2×. `getSoldAuctionPriceStats` already filtered these out; `getRamPriceStats`
and `getDiskPriceStats` now do too.

**The trend arrow never moved.** `FontAwesomeIcon` renders its SVG on mount and
does not swap it when the `icon` prop changes, so the tile kept the `faArrowDown`
it mounted with while the data was still empty — showing ↓ next to a red "+4.08%"
and the words "Prices rising". `QuickStat` now wraps the icon in `{#key icon}`.

**The 30-day trend compared two raw days**, either of which could be an outlier.
It now compares 7-day averages.

**`cpu_vendor` is not a clean two-way split.** It holds `Intel` (60,555 rows),
`AMD` (48,541), plus `Intel®` (77) and `2x` (4). "Lowest Price" was
`min(cheapest AMD, cheapest Intel)`, so those 81 stragglers could never win it.
It is now a plain `min(price)` via `getMinPriceStats`.

**The price index cannot exceed 1.0.** Over the snapshot's 90 days: min 0.951,
max exactly 1.000, median 0.965, zero days above 1.0. The baseline is a _trailing_
90-day median that includes the current row, and auction prices ratchet downward
within a listing's life, so today's minimum is essentially always ≤ that median.
The old subtitle ("Values > 1.0 = higher prices") described an unreachable state;
it now reads "Today vs its rolling 90-day median. Lower = cheaper." Rebasing the
index so it can swing both ways is a separate change — the metric, not the label.

## Decisions & trade-offs

- **Tabs over a sticky table of contents.** A TOC keeps one long page and does
  nothing for the eight-canvases-at-once cost. Tabs address "don't show all on one
  page" literally.
- **Zero-fill vs null-fill per series kind** rather than one global rule. One rule
  is wrong for half the charts either way; see above.
- **Overlay rather than replacing raw with the average.** The daily spikes are
  often the interesting part (a single very cheap listing); the average is context,
  not a substitute.
- **`GenericChart` changed, not forked.** It has two other consumers
  (`/servers/cpu/[slug]`, `CloudAvailabilityChart` — the latter is a matrix chart
  and does not use the line path). Most of the new behaviour is additive, but two
  line defaults do change for `/servers/cpu/[slug]` as well: `tension` 0.4 → 0 and
  `borderWidth` 3 → 2. Deliberate — the whole point of this change is that the
  chart draws what the data says, and a bezier through daily minima invents
  extrema on that page for the same reason it does here.

### 6. `/servers/cpu/[slug]` gets the same treatment

That page's 90-day history chart carried a live bug: it passed
`new Date(p.day).getTime()` — **milliseconds** — to a component that multiplies
by 1000, so every x sat ~56 million years out. The plot shape survived (a
constant factor on a self-scaling axis) but the tick labels were nonsense
month/day pairs from dates centuries apart, which is why they appeared to run
backwards. It now passes epoch seconds, aligns onto a day grid so a day with no
listing breaks the line, and draws the same faded-raw + 7-day-average pair.

Chasing it surfaced a robustness hole in `buildDayGrid`: SQLite's `date(seen)`
returns null for an unparseable timestamp, `new Date(null).getTime()` is `0`, and
`Math.min` then stretched the grid back to 1970 — 20,673 points with the real
data one pixel wide at the right edge. `buildDayGrid` now drops non-finite and
non-positive days before taking the extent, so one bad row costs one point
instead of the whole chart.

## Implementation steps

- [x] `src/lib/chartSeries.ts`: `buildDayGrid`, `alignSeries`, `movingAverage`,
      `seriesColor` + unit tests
- [x] `getObservedDays` in `src/lib/api/frontend/stats.ts`
- [x] `GenericChart`: `y: number | null`, `spanGaps: false`, per-series
      `width`/`dashed`/`tension`/`alpha`, stable palette
- [x] `StatCard.svelte`: the repeated card chrome (title, blurb, chart slot)
- [x] `/statistics`: tab strip, `?tab=` sync, key metrics pinned, smoothing toggle
- [x] Key-metric fixes: `{#key icon}` in `QuickStat`, `fixed_price` filter on the
      per-unit price queries, `getMinPriceStats`, smoothed trend, honest subtitles
- [x] Drop the AMD-vs-Intel tile; replace ECC Premium with an absolute Best €/GB
- [x] `/servers/cpu/[slug]`: epoch-seconds fix, gap breaks, average overlay;
      `buildDayGrid` guards against junk timestamps
- [x] `npm run check`, `npm run lint`, `npm run test`
