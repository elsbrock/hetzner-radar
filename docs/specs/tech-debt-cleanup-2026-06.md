# Tech Debt Cleanup — June 2026

## Intent

Reduce accumulated technical debt across the SvelteKit app: fix a latent bug,
remove dead code, strip debug logging, deduplicate copy-pasted helpers, and
finish the Svelte 5 runes migration. No behavioral changes intended except the
bug fix.

## Findings (survey 2026-06-10)

- **Bug**: `tearDownDB()` in `src/stores/db.ts` recursively calls itself
  instead of `tearDownDB` from `$lib/duckdb`, so the DuckDB instance/worker is
  never terminated (and would stack-overflow if the store were set).
- **Dead code**: components `CurrencySelector`, `HetznerModal`,
  `ServerFactSheet`, `Toolbar` have no importers; `getAuctionsForConfiguration`
  in `src/lib/api/frontend/auctions.ts` is exported but never used.
- **Lint**: unused `Spinner` import in `src/routes/configurations/+page.svelte`
  (eslint error).
- **Debug logging**: ~36 `console.log` calls across 10 files; worst offender
  `src/routes/analyze/+page.svelte` (15).
- **Duplication**: JSON-LD escaping helper
  (`JSON.stringify(v).replace(/</g, "\\u003c")`) copy-pasted in 4 route pages;
  `formatStorage` (GB→TB) duplicated in 2 pages.
- **Legacy Svelte 4 syntax**: `export let` props in 6 files (rest of the
  codebase uses runes).

Out of scope (deliberately): SEO `<svelte:head>` boilerplate consolidation
(larger refactor, higher regression risk), Chart.js `as any` casts (upstream
type limitations), splitting the 900–1300-line route pages, Discord type
sharing between `src/` and `worker/` (separate packages), untracked `claurst*`
binaries in repo root (not ours to delete).

## Decisions

- Shared helpers live in `src/lib/util.ts` (existing utility module) rather
  than a new file, keeping the change minimal.
- `console.error`/`console.warn` in genuine error paths are kept; only
  development/debug `console.log` is removed.
- Each step is an isolated conventional commit so any item is trivially
  revertable.

## Implementation Steps

- [x] Survey codebase (checks, lint, tests, exploration)
- [ ] Fix `tearDownDB` recursion bug
- [ ] Remove unused `Spinner` import (lint error)
- [ ] Delete unused components and unused export
- [ ] Remove debug `console.log` statements
- [ ] Extract shared `jsonLdSafe` + `formatStorage` helpers
- [ ] Migrate remaining `export let` props to `$props()`
- [ ] Final validation: `npm run check`, `npm run lint`, `npm run test`,
      `npm run build`
