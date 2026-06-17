# Alert disk-size matching fix

**Status:** implemented (not yet deployed)
**Date:** 2026-06-17

## Intent

Two user bug reports: alerts trigger on servers that don't match the disk-size
constraints the user configured.

1. **NVMe per-disk**: user set "min 3.5 TB per disk" (`ssdNvmeInternalSize:[7,18]`,
   `ssdNvmeSizeMode:"per-disk"`) but got alerted on a server with ~half that.
2. **HDD total**: user set "≥ 39 TB total HDD" (`hddInternalSize:[78,660]`,
   `hddSizeMode:"total"`, `hddCount` left at default `[0,15]`) but got false
   positives, including a 2×512 GB SSD server. Opening the triggering auction on
   the Analyze page shows "No matching auctions found".

## Root cause

The alert matcher in `worker/src/alert-service.ts` (`MATCH_ALERTS_SQL`) drifted
from the frontend filter (`src/lib/api/frontend/filter.ts` `generateFilterQuery`,
which powers the Analyze page and the alert preview). On 2025-12-31, commits
`2919b9b0` (total-size mode) and `46515314` (multiplier 250→500) fixed the
frontend; the worker was never updated. Three concrete divergences:

- **A. Wrong multiplier.** Worker divides NVMe/SATA drive sizes by **250**; the UI
  and frontend query use **500 GB per slider unit** (`getFormattedDiskSize(v, 500)`).
  Every NVMe/SATA size threshold in an alert is therefore effectively **halved** →
  report #1. (HDD already used 500 in both.)
- **B. Size skipped when count lower bound is 0.** Worker gates each per-disk size
  check behind `xxxCount[0] != 0`. Count sliders default to a `0` lower bound, so
  users who constrain by *size only* get the size filter silently ignored. The
  frontend never gates size on count.
- **C. `total` size mode unsupported.** Worker always applies per-disk min/max
  logic and has no `xxx_size` (sum) branch → report #2 (combined with B, the HDD
  size was ignored entirely and the alert matched on price/location/CPU alone).

The worker tests mocked the DB and only string-matched the SQL, so none of this
was caught.

### Also found while adding test coverage

- **D. Datacenter city prefixes never matched.** The datacenter picker offers both
  specific datacenters (`FSN1-DC14`) and city prefixes (`FSN`/`NBG`/`HEL`). The
  frontend matches prefixes with `datacenter LIKE 'FSN%'`; the worker used exact
  `c.datacenter IN (...)`, so an alert filtered by city **silently never fired**
  (false negative). Fixed by matching each selection as either an exact value or,
  for `FSN`/`NBG`/`HEL`, a `LIKE prefix || '%'` — via a prefix-aware `EXISTS`.

## Decision

Rewrite only the disk-matching block of `MATCH_ALERTS_SQL` to mirror
`generateFilterQuery` exactly. Frontend is the source of truth (it's what the user
sees and what the preview/Analyze page evaluates). No frontend changes.

Per disk type (NVMe, SATA, HDD), unit = **500 GB**:

- count predicate: `count BETWEEN lo AND hi`
- size predicate:
  - `total`: `size BETWEEN sizeLo*500 AND sizeHi*500`
  - `per-disk`: `count = 0 OR (min_drive >= sizeLo*500 AND max_drive <= sizeHi*500)`
    (the `count = 0` branch mirrors the frontend's empty-array pass:
    `array_filter(...) == array_length(...)` is true for an empty array)
  - missing `sizeMode` (old alerts) coalesces to `per-disk`
- clause = `(count predicate AND size predicate)`

Combine per `diskMode` (missing → `and`):

- **and**: `nvme AND sata AND hdd`
- **or**: all-unconstrained → no-op; otherwise OR of each *active* clause, where a
  type is active when its count range differs from the default
  (`[0,8]`/`[0,4]`/`[0,15]`). Mirrors frontend `nvmeActive`/`sataActive`/`hddActive`.

Implementation: compose the SQL from small helpers keyed off a `DISK_FILTER_TYPES`
table so NVMe/SATA/HDD and the AND/OR branches can't drift from each other again.

## Verification

D1 is SQLite-compatible. Add a test (`alert-matching-sql.test.ts`) using the
built-in `node:sqlite` (Node 24, no native dep) that creates `current_auctions`,
`price_alert`, `user`, loads fixtures reproducing both reports, runs the real
`MATCH_ALERTS_SQL`, and asserts:

- report #1: server with 2×~1.9 TB NVMe no longer matches a 3.5 TB/disk alert; a
  2×4 TB NVMe server does.
- report #2: 2×512 GB SSD server no longer matches a ≥39 TB-total-HDD alert; a
  server with ≥39 TB total HDD does.
- regressions: AND mode, OR mode, count-only filters, old alerts (missing
  `sizeMode`/`diskMode`) still behave.

## Steps

- [x] Write spec (this file)
- [x] Rewrite disk-matching block in `worker/src/alert-service.ts`
- [x] Fix datacenter city-prefix matching (finding D)
- [x] Add `node:sqlite` verification test (`worker/src/__tests__/alert-matching-sql.test.ts`)
      covering **every** matching dimension: price/VAT/IPv4, location, CPU vendor/count,
      RAM (log2), datacenters (specific + city prefix), CPU models, extras, cores/threads,
      disk per-disk/total, AND/OR, and old-alert backward compat
- [x] Worker `vitest` green (225 tests), changed files pass prettier + eslint

## Remaining test gaps (not addressed here)

- **Frontend ↔ worker conformance.** `generateFilterQuery` (DuckDB) and
  `MATCH_ALERTS_SQL` (D1/SQLite) remain two independent reimplementations. The new
  test pins the worker side to the intended behavior, but nothing yet asserts the
  two engines agree on a shared fixture set. That harness (run both over identical
  cases) is the real insurance against future drift — deferred.
- `generateFilterQuery` itself still has no unit test; its only coverage is the
  Playwright suite, which is currently CI-manual-only.
