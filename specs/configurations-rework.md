# Configurations Page Rework

## Intent

The `/configurations` page is meant to surface genuinely useful "best deal" highlights so visitors can see at a glance what's worth buying today. It currently does not deliver on that:

1. The highlighted configs frequently look wrong or inconsistent between reloads.
2. CPU performance data (`cpu_score`, `cpu_multicore_score`) has been available since the CPU-enrichment work (`specs/cpu-enrichment.md`, phases 2–3 done) but is not used for ranking.
3. The page has two divergent implementations — D1 (primary) and DuckDB (fallback) — with different bugs.

This spec is about fixing the ranking logic first. The follow-up (static per-config / per-CPU SEO landing pages) is out of scope here and tracked separately.

## Current problems

### D1 implementation — `src/routes/configurations/+page.server.ts`

- `baseQuery` fetches the **top 100 cheapest** listings and dedupes in JS for every category (`+page.server.ts:125-168`). This biases every category toward cheap servers. A configuration that is excellent €/GB RAM but priced above the top-100 cutoff is invisible. Same for NVMe, SATA, HDD, and (once added) €/score.
- "Cheapest per GB HDD" filters `hdd_size > 0` in JS, which is correct, but the pre-filter to "top 100 cheapest overall" still dominates the sample.
- `dedupeByCategory` picks one row per CPU. That means a CPU with two genuinely great variants (e.g. 32 GB ECC vs 64 GB ECC) only surfaces once — the other is silently dropped.

### DuckDB fallback — `src/lib/api/frontend/configs.ts`

- Every category uses `SELECT DISTINCT ON (cpu) ... ORDER BY cpu, seen DESC` (`configs.ts:15-35` and the four parallel functions). That keeps **the most recently polled row per CPU**, not the cheapest or best-by-category. The outer `ORDER BY price ASC LIMIT 4` then ranks that near-random sample.
- No category-specific denominator gating at the SQL level (HDD sort runs even when `hdd_size` can be 0 in the CPU's picked row → division by zero / NULLs).

### Both implementations

- `cpu_score` / `cpu_multicore_score` are never referenced.
- "Cheapest" is framed as raw euros or €/component, never €/performance. A €18 server with a Geekbench multicore of 1,500 outranks a €22 server with 6,000 — the latter is obviously the better deal for most workloads.
- Dedupe-by-CPU is an implicit editorial choice that isn't documented. Users never asked "show me one pick per CPU"; it was a way to reduce noise.

## Proposed ranking model

Replace the five existing categories with a set framed around **intent**, not component:

| Category                                     | Metric (lower is better)                         | Required fields            |
| -------------------------------------------- | ------------------------------------------------ | -------------------------- |
| Best price/performance                       | `price / cpu_multicore_score`                    | `cpu_multicore_score > 0`  |
| Cheapest absolute                            | `price` with `cpu_multicore_score >= 4000` floor | —                          |
| Best €/core                                  | `price / cpu_cores`                              | `cpu_cores > 0`            |
| Best €/GB RAM                                | `price / ram_size`                               | `ram_size > 0`             |
| Best €/TB NVMe                               | `price / (nvme_size / 1000)`                     | `nvme_size > 0`            |
| Best €/TB bulk storage (SATA + HDD combined) | `price / ((sata_size + hdd_size) / 1000)`        | `sata_size + hdd_size > 0` |

Scores are **Geekbench 5 multicore** (source: `r59q/geekbench-cpu-specs` → `cpu-list.v1.json`, see `data/cpu-specs.json`). 4,000 GB5 multicore is the floor for "cheapest absolute": excludes Atom-class and old Celerons but keeps older Xeon E3 / Ryzen / EPYC Naples — i.e. anything still reasonable for modern workloads.

**GPU servers** get a subtle "N GPU servers available →" link below the category grid that deep-links to `/analyze?withGPU=true`. Inventory is too thin for a dedicated card.

### Selection rules

- Do not pre-limit to "top 100 cheapest" before categorizing. Each category ranks over **all current listings** matching its required fields, then takes top **N = 4**.
- Drop the "one row per CPU" dedupe. Instead, dedupe on **(cpu, ram_size, storage_bucket, is_ecc)** where `storage_bucket` is a coarse bucket of the primary drive shape (e.g., `"2x512-nvme"`, `"4x2tb-sata"`). This lets a 32 GB and a 64 GB variant of the same CPU both appear if they genuinely are best in different categories, without flooding the list with near-identical rows.
- Tie-breaker: lower `price`, then more recent `seen`.
- Exclude listings with `cpu_multicore_score IS NULL` only from score-dependent categories — keep them eligible elsewhere so CPU-enrichment gaps don't silently remove rows.
- A **"last updated"** timestamp (max `seen` across current_auctions) is shown on the page so users know how stale the snapshot is.

### Unified implementation

- Consolidate to a single ranking module consumed by both code paths. D1 and DuckDB should share category definitions — differing only in dialect/connection.
- Prefer doing ranking in SQL (window functions), not in JS, to avoid re-introducing the "top 100" bias.
- Keep the D1 path authoritative (it's what production uses). The DuckDB fallback should produce identical categories so the page's output doesn't change shape depending on env.

## Implementation steps

- [ ] Decide final category list (resolve open questions below)
- [ ] Write shared category definitions (TS): `name`, `sqlMetric`, `whereClause`, `denominatorGuard`
- [ ] Rewrite `src/routes/configurations/+page.server.ts` to run one query per category against D1 using window functions (`ROW_NUMBER() OVER (PARTITION BY cpu, ram_size, … ORDER BY metric ASC)`), no pre-LIMIT
- [ ] Rewrite `src/lib/api/frontend/configs.ts` with the same category list, DuckDB dialect
- [ ] Update `src/routes/configurations/+page.svelte` to render the new categories (icons, copy, explanation of each metric)
- [ ] Update `src/lib/components/landing/ConfigurationsTeaser.svelte` if it pulls from the same functions
- [ ] Add a "last snapshot updated at" line to the page header
- [ ] Verify `tests/configurations.spec.ts` still passes; extend it to assert that each category is non-empty and that required fields are non-null for its metric
- [ ] Remove dead code paths (the "top 100" base query, the old dedupe helper)

## Out of scope (separate spec later)

- Per-CPU and per-configuration landing pages (`/servers/cpu/[slug]`, `/servers/config/[slug]`) for SEO.
- Product / AggregateOffer JSON-LD.
- Sitemap expansion.
- Hetzner model-name (AX41, EX44…) enrichment.

All of these depend on ranking being trustworthy first.

## Decisions (resolved)

1. **GPU** — no dedicated category; render a small "N GPU servers available →" link beneath the category grid pointing at `/analyze?withGPU=true`. Inventory too thin.
2. **Score floor for "cheapest absolute"** — 4,000 GB5 multicore. Excludes Atom-class and old Celerons but keeps legitimately usable older Xeons, Ryzens, and EPYC Naples. Revisit if fleet composition shifts.
3. **Dedupe key** — `(cpu, ram_size, storage_bucket, is_ecc)`, not one-row-per-CPU. Variants that genuinely win different categories should coexist.
4. **Bulk storage** — combine SATA + HDD into one "€/TB bulk" category. Hetzner rarely lists HDD-only auctions now.
5. **N per category** — keep at 4. Fits mobile layout and keeps each card's signal strong.
