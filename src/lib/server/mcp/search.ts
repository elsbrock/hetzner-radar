/**
 * In-memory auction search over the KV snapshot.
 *
 * The whole live dataset is a few hundred records, so this is a linear scan —
 * no query planner, no D1 rows read, and simpler than the equivalent SQL.
 *
 * The query schema mirrors the UI's `ServerFilter` feature-for-feature (ranges,
 * per-disk vs total sizing, AND/OR disk matching) so anything expressible in the
 * web filter is expressible here, and an alert created via MCP behaves
 * identically to one created in the UI. The matching semantics below are ported
 * from `src/lib/api/frontend/filter.ts`, which is the reference implementation.
 *
 * Units are plain and stated in the field names (GB, EUR, counts). The encoded
 * forms `ServerFilter` uses internally — log2 for RAM, 500 GB units for disks —
 * are an implementation detail handled in `filter.ts`.
 */

import type { SnapshotAuction } from "./snapshot";
import { CITY_PREFIXES } from "$lib/api/shared/filter-constants";

export type SizeMode = "per-disk" | "total";
export type DiskMode = "and" | "or";

export interface AuctionQuery {
  // ---- CPU ----
  /** Case-insensitive substring of the CPU name, e.g. "epyc" or "7302". */
  cpu?: string;
  /** Exact CPU model names; a server matches if it is any of them. */
  cpu_models?: string[];
  /** "Intel" or "AMD". Omit for either. */
  cpu_vendor?: string;
  /** Number of physical CPUs (sockets). */
  cpu_count?: number;
  min_cpu_cores?: number;
  max_cpu_cores?: number;
  min_cpu_threads?: number;
  max_cpu_threads?: number;
  /** Geekbench multi-core score. No ServerFilter equivalent — search only. */
  min_cpu_multicore_score?: number;

  // ---- Memory ----
  min_ram_gb?: number;
  max_ram_gb?: number;
  ecc?: boolean;

  // ---- Disks ----
  min_nvme_count?: number;
  max_nvme_count?: number;
  min_nvme_size_gb?: number;
  max_nvme_size_gb?: number;
  /** "total" sums the drives; "per-disk" requires every drive to fit the range. */
  nvme_size_mode?: SizeMode;

  min_sata_count?: number;
  max_sata_count?: number;
  min_sata_size_gb?: number;
  max_sata_size_gb?: number;
  sata_size_mode?: SizeMode;

  min_hdd_count?: number;
  max_hdd_count?: number;
  min_hdd_size_gb?: number;
  max_hdd_size_gb?: number;
  hdd_size_mode?: SizeMode;

  /** "and" (default) requires every disk constraint; "or" requires any. */
  disk_mode?: DiskMode;

  /** Total drives across all types. No ServerFilter equivalent — search only. */
  min_drive_count?: number;
  max_drive_count?: number;

  // ---- Location ----
  /** Convenience for a single country; `locations` takes precedence. */
  location?: string;
  locations?: string[];
  /** Exact datacenters ("FSN1-DC14") or city prefixes ("FSN"). */
  datacenters?: string[];

  // ---- Extras ----
  inic?: boolean;
  hwr?: boolean;
  gpu?: boolean;
  rps?: boolean;

  // ---- Price ----
  /** Matched against pricing.total_monthly_net — server + IPv4, before VAT. */
  max_price_eur?: number;
  min_price_eur?: number;
}

export type SortKey = "price" | "cpu_score" | "ram" | "next_reduce";

export interface SearchOptions {
  limit?: number;
  sort?: SortKey;
  /** e.g. 0.19 for 19% German VAT. Adds a gross view; never changes filtering. */
  vat_rate?: number;
}

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;

export { CITY_PREFIXES };
export const LOCATIONS = ["Germany", "Finland"];

function inRange(value: number, min?: number, max?: number): boolean {
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

function matchesDatacenter(
  auction: SnapshotAuction,
  wanted: string[],
): boolean {
  const dc = auction.datacenter.toUpperCase();
  return wanted.some((w) => {
    const want = w.toUpperCase();
    // Mirrors the UI: prefixes use LIKE 'FSN%', everything else is exact.
    return CITY_PREFIXES.includes(want) ? dc.startsWith(want) : dc === want;
  });
}

/**
 * One disk type's clause, mirroring the SQL in
 * `src/lib/api/frontend/filter.ts`.
 *
 * In "per-disk" mode every individual drive must fall inside the size range —
 * an empty drive list passes trivially, exactly as `array_filter(...) =
 * array_length(...)` does for an empty array.
 */
function matchesDisk(
  count: number,
  drives: number[],
  total: number,
  minCount?: number,
  maxCount?: number,
  minSize?: number,
  maxSize?: number,
  mode: SizeMode = "total",
): boolean {
  if (!inRange(count, minCount, maxCount)) return false;

  if (minSize === undefined && maxSize === undefined) return true;

  if (mode === "total") return inRange(total, minSize, maxSize);
  return drives.every((d) => inRange(d, minSize, maxSize));
}

/** Whether the caller expressed any constraint on this disk type. */
function diskConstrained(
  minCount?: number,
  maxCount?: number,
  minSize?: number,
  maxSize?: number,
): boolean {
  return (
    minCount !== undefined ||
    maxCount !== undefined ||
    minSize !== undefined ||
    maxSize !== undefined
  );
}

function totalDriveCount(auction: SnapshotAuction): number {
  return auction.nvme_count + auction.sata_count + auction.hdd_count;
}

export function matchesQuery(
  auction: SnapshotAuction,
  query: AuctionQuery,
): boolean {
  // ---- CPU ----
  if (query.cpu && !auction.cpu.toLowerCase().includes(query.cpu.toLowerCase()))
    return false;

  if (query.cpu_models?.length) {
    const wanted = query.cpu_models.map((m) => m.toLowerCase());
    if (!wanted.includes(auction.cpu.toLowerCase())) return false;
  }

  if (
    query.cpu_vendor &&
    auction.cpu_vendor.toLowerCase() !== query.cpu_vendor.toLowerCase()
  )
    return false;

  if (query.cpu_count !== undefined && auction.cpu_count !== query.cpu_count)
    return false;

  // CPU enrichment is absent for unrecognised models. Treat "unknown" as not
  // meeting a stated minimum rather than silently passing it through.
  if (query.min_cpu_cores !== undefined || query.max_cpu_cores !== undefined) {
    if (auction.cpu_cores === null) return false;
    if (!inRange(auction.cpu_cores, query.min_cpu_cores, query.max_cpu_cores))
      return false;
  }
  if (
    query.min_cpu_threads !== undefined ||
    query.max_cpu_threads !== undefined
  ) {
    if (auction.cpu_threads === null) return false;
    if (
      !inRange(
        auction.cpu_threads,
        query.min_cpu_threads,
        query.max_cpu_threads,
      )
    )
      return false;
  }
  if (query.min_cpu_multicore_score !== undefined) {
    if (
      auction.cpu_multicore_score === null ||
      auction.cpu_multicore_score < query.min_cpu_multicore_score
    )
      return false;
  }

  // ---- Memory ----
  if (!inRange(auction.ram_size, query.min_ram_gb, query.max_ram_gb))
    return false;
  if (query.ecc !== undefined && auction.is_ecc !== query.ecc) return false;

  // ---- Price ----
  if (
    !inRange(
      auction.pricing.total_monthly_net,
      query.min_price_eur,
      query.max_price_eur,
    )
  )
    return false;

  // ---- Location ----
  const locations = query.locations?.length
    ? query.locations
    : query.location
      ? [query.location]
      : null;
  if (
    locations &&
    !locations.some((l) => l.toLowerCase() === auction.location.toLowerCase())
  )
    return false;

  if (
    query.datacenters?.length &&
    !matchesDatacenter(auction, query.datacenters)
  )
    return false;

  // ---- Disks ----
  const nvmeSet = diskConstrained(
    query.min_nvme_count,
    query.max_nvme_count,
    query.min_nvme_size_gb,
    query.max_nvme_size_gb,
  );
  const sataSet = diskConstrained(
    query.min_sata_count,
    query.max_sata_count,
    query.min_sata_size_gb,
    query.max_sata_size_gb,
  );
  const hddSet = diskConstrained(
    query.min_hdd_count,
    query.max_hdd_count,
    query.min_hdd_size_gb,
    query.max_hdd_size_gb,
  );

  if (nvmeSet || sataSet || hddSet) {
    const nvmeOk = matchesDisk(
      auction.nvme_count,
      auction.nvme_drives,
      auction.nvme_size,
      query.min_nvme_count,
      query.max_nvme_count,
      query.min_nvme_size_gb,
      query.max_nvme_size_gb,
      query.nvme_size_mode ?? "total",
    );
    const sataOk = matchesDisk(
      auction.sata_count,
      auction.sata_drives,
      auction.sata_size,
      query.min_sata_count,
      query.max_sata_count,
      query.min_sata_size_gb,
      query.max_sata_size_gb,
      query.sata_size_mode ?? "total",
    );
    const hddOk = matchesDisk(
      auction.hdd_count,
      auction.hdd_drives,
      auction.hdd_size,
      query.min_hdd_count,
      query.max_hdd_count,
      query.min_hdd_size_gb,
      query.max_hdd_size_gb,
      query.hdd_size_mode ?? "total",
    );

    if (query.disk_mode === "or") {
      // Mirrors the UI: only constrained types take part in the OR, otherwise
      // an unconstrained type would always satisfy it and the filter would be
      // a no-op.
      const clauses: boolean[] = [];
      if (nvmeSet) clauses.push(nvmeOk);
      if (sataSet) clauses.push(sataOk);
      if (hddSet) clauses.push(hddOk);
      if (clauses.length && !clauses.some(Boolean)) return false;
    } else {
      if (nvmeSet && !nvmeOk) return false;
      if (sataSet && !sataOk) return false;
      if (hddSet && !hddOk) return false;
    }
  }

  if (
    !inRange(
      totalDriveCount(auction),
      query.min_drive_count,
      query.max_drive_count,
    )
  )
    return false;

  // ---- Extras: tri-state, only filter when a preference is expressed ----
  if (query.inic !== undefined && auction.with_inic !== query.inic)
    return false;
  if (query.hwr !== undefined && auction.with_hwr !== query.hwr) return false;
  if (query.gpu !== undefined && auction.with_gpu !== query.gpu) return false;
  if (query.rps !== undefined && auction.with_rps !== query.rps) return false;

  return true;
}

function compare(
  a: SnapshotAuction,
  b: SnapshotAuction,
  sort: SortKey,
): number {
  switch (sort) {
    case "cpu_score":
      // Unknown scores sort last rather than winning by comparing as 0.
      return (b.cpu_multicore_score ?? -1) - (a.cpu_multicore_score ?? -1);
    case "ram":
      return b.ram_size - a.ram_size;
    case "next_reduce": {
      // Soonest price drop first; servers that will never drop sort last.
      const at = a.pricing.next_reduce_at
        ? Date.parse(a.pricing.next_reduce_at)
        : Infinity;
      const bt = b.pricing.next_reduce_at
        ? Date.parse(b.pricing.next_reduce_at)
        : Infinity;
      return at - bt;
    }
    case "price":
    default:
      return a.pricing.total_monthly_net - b.pricing.total_monthly_net;
  }
}

export interface PricedAuction extends SnapshotAuction {
  pricing: SnapshotAuction["pricing"] & {
    vat_rate?: number;
    total_monthly_gross?: number;
  };
}

/** Adds a gross view without ever mutating the cached snapshot object. */
export function withVat(
  auction: SnapshotAuction,
  vatRate: number | undefined,
): PricedAuction {
  if (vatRate === undefined) return auction as PricedAuction;

  return {
    ...auction,
    pricing: {
      ...auction.pricing,
      vat_rate: vatRate,
      total_monthly_gross:
        Math.round(auction.pricing.total_monthly_net * (1 + vatRate) * 100) /
        100,
    },
  };
}

export interface SearchResult {
  total_matched: number;
  returned: number;
  truncated: boolean;
  auctions: PricedAuction[];
}

export function searchAuctions(
  auctions: SnapshotAuction[],
  query: AuctionQuery,
  options: SearchOptions = {},
): SearchResult {
  const limit = Math.min(
    Math.max(1, options.limit ?? DEFAULT_LIMIT),
    MAX_LIMIT,
  );

  const matched = auctions.filter((a) => matchesQuery(a, query));
  matched.sort((a, b) => compare(a, b, options.sort ?? "price"));

  const page = matched.slice(0, limit);

  return {
    // Reported separately so a model can tell "these are the only 3" from
    // "these are the cheapest 20 of 300".
    total_matched: matched.length,
    returned: page.length,
    truncated: matched.length > page.length,
    auctions: page.map((a) => withVat(a, options.vat_rate)),
  };
}
