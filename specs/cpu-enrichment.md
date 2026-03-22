# CPU Enrichment Plan

## Goal
Enrich auction servers with CPU cores, threads, generation, and benchmark score data from Geekbench. Enable filtering/sorting by these fields in both the browsing UI and alert system.

## Data Source
- [r59q/geekbench-cpu-specs](https://github.com/r59q/geekbench-cpu-specs) — auto-updated daily JSON with cores, threads, scores, family, etc.
- ~86% of Hetzner CPU names match automatically after normalization (strip ®™, `2x` prefix, case, version spacing)
- ~4 CPUs need manual overrides

## Design Decisions
- **Vendor the data**: `data/cpu-specs.json` is the source of truth, checked into the repo. No runtime external fetches.
- **Single normalization**: generator script handles all name matching. Both pipelines consume the same file.
- **Dual-CPU servers** (`2x ...`): strip prefix for lookup, double core/thread counts. Store per-socket score.
- **`cpu_generation`**: mapped from Geekbench `family` field (Skylake, Zen 2, etc.)

## Phases

### Phase 1: CPU specs data layer
- [x] `scripts/generate_cpu_specs.py` — fetch Geekbench JSON, normalize, match, output mapping
- [x] Manual overrides for unmatched CPUs (~4)
- [x] `data/cpu-specs.json` committed to repo

### Phase 2: DuckDB pipeline (GHA → browser)
- [x] Add `cpu_score`, `cpu_multicore_score` columns to `server` table in `update_incremental.py`
- [x] After auction import, UPDATE `cpu_cores`, `cpu_threads`, `cpu_generation`, `cpu_score`, `cpu_multicore_score` from `cpu-specs.json`
- [x] Standard servers keep existing enrichment from Hetzner API

### Phase 3: D1 pipeline (CF Worker → alerts)
- [x] D1 migration: add `cpu_cores`, `cpu_threads`, `cpu_generation`, `cpu_score`, `cpu_multicore_score` to `current_auctions` and `auctions`
- [x] Bundle `cpu-specs.json` into worker (symlinked from data/)
- [x] Enrich in `AuctionDataTransformer.transformServers()` via `lookupCpuSpecs()`
- [x] Update `AuctionDatabaseService` INSERT statements with new columns

### Phase 4: Alert filtering
- [x] Add `cpuCores`, `cpuThreads` range filters to MATCH_ALERTS_SQL
- [x] Update frontend alert filter UI (shares same filter type — works automatically)

### Phase 5: Frontend display & filtering
- [x] Add `cpuCores`, `cpuThreads` range fields to `ServerFilter` type with defaults
- [x] Add cores/threads range sliders to filter UI (CPU section)
- [x] Add CPU core/thread filtering to DuckDB filter query
- [x] Add `cpu_score`, `cpu_multicore_score` to `ServerConfiguration` type and query
- [x] Show CPU cores/threads, generation, and Geekbench scores in server detail drawer (all server types)
- [x] Add "CPU Score" sort option (sorts by multicore score)

### Phase 6: CI guard
- [x] Weekly GitHub Action to re-run generator, open PR on changes
