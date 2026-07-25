/**
 * In-memory auction search over the KV snapshot.
 *
 * The whole live dataset is a few hundred records, so this is a linear scan —
 * no query planner, no D1 rows read, and simpler than the equivalent SQL (which
 * has to compare drive arrays as JSON strings).
 *
 * `AuctionQuery` is deliberately shared with the alert tools: an agent can
 * search with some parameters and then create an alert from the identical ones.
 * It is also what keeps `ServerFilter` construction normalised — see
 * `src/lib/server/mcp/filter.ts`.
 */

import type { SnapshotAuction } from "./snapshot";

/** Units are stated in the field names because a model will otherwise guess. */
export interface AuctionQuery {
  /** Case-insensitive substring of the CPU name, e.g. "epyc" or "7302". */
  cpu?: string;
  /** "Intel" or "AMD". */
  cpu_vendor?: string;
  min_cpu_cores?: number;
  min_cpu_threads?: number;
  /** Minimum Geekbench multi-core score, where known. */
  min_cpu_multicore_score?: number;
  min_ram_gb?: number;
  /** Matched against pricing.total_monthly_net — server + IPv4, before VAT. */
  max_price_eur?: number;
  /** "Germany" or "Finland". */
  location?: string;
  /** Exact datacenter ("FSN1-DC14") or city prefix ("FSN"). */
  datacenter?: string;
  min_nvme_count?: number;
  /** Sum across all NVMe drives, GB. */
  min_nvme_total_gb?: number;
  min_sata_count?: number;
  min_sata_total_gb?: number;
  min_hdd_count?: number;
  min_hdd_total_gb?: number;
  /** Size of the single largest drive of any type, GB. */
  min_largest_drive_gb?: number;
  ecc?: boolean;
  gpu?: boolean;
  inic?: boolean;
  hwr?: boolean;
  rps?: boolean;
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

const CITY_PREFIXES = ["FSN", "NBG", "HEL"];

function matchesDatacenter(auction: SnapshotAuction, wanted: string): boolean {
  const dc = auction.datacenter.toUpperCase();
  const want = wanted.toUpperCase();
  // "FSN" should match FSN1-DC14; "FSN1-DC14" should match only itself.
  if (CITY_PREFIXES.includes(want)) return dc.startsWith(want);
  return dc === want;
}

function largestDrive(auction: SnapshotAuction): number {
  const all = [
    ...auction.nvme_drives,
    ...auction.sata_drives,
    ...auction.hdd_drives,
  ];
  return all.length ? Math.max(...all) : 0;
}

/** A single auction against a single query. Exported for testing. */
export function matchesQuery(
  auction: SnapshotAuction,
  query: AuctionQuery,
): boolean {
  if (query.cpu && !auction.cpu.toLowerCase().includes(query.cpu.toLowerCase()))
    return false;

  if (
    query.cpu_vendor &&
    auction.cpu_vendor.toLowerCase() !== query.cpu_vendor.toLowerCase()
  )
    return false;

  // CPU enrichment is absent for unrecognised models. Treat "unknown" as not
  // meeting a minimum rather than silently passing it through.
  if (query.min_cpu_cores !== undefined) {
    if (auction.cpu_cores === null || auction.cpu_cores < query.min_cpu_cores)
      return false;
  }
  if (query.min_cpu_threads !== undefined) {
    if (
      auction.cpu_threads === null ||
      auction.cpu_threads < query.min_cpu_threads
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

  if (query.min_ram_gb !== undefined && auction.ram_size < query.min_ram_gb)
    return false;

  if (
    query.max_price_eur !== undefined &&
    auction.pricing.total_monthly_net > query.max_price_eur
  )
    return false;

  if (
    query.location &&
    auction.location.toLowerCase() !== query.location.toLowerCase()
  )
    return false;

  if (query.datacenter && !matchesDatacenter(auction, query.datacenter))
    return false;

  if (
    query.min_nvme_count !== undefined &&
    auction.nvme_count < query.min_nvme_count
  )
    return false;
  if (
    query.min_nvme_total_gb !== undefined &&
    auction.nvme_size < query.min_nvme_total_gb
  )
    return false;
  if (
    query.min_sata_count !== undefined &&
    auction.sata_count < query.min_sata_count
  )
    return false;
  if (
    query.min_sata_total_gb !== undefined &&
    auction.sata_size < query.min_sata_total_gb
  )
    return false;
  if (
    query.min_hdd_count !== undefined &&
    auction.hdd_count < query.min_hdd_count
  )
    return false;
  if (
    query.min_hdd_total_gb !== undefined &&
    auction.hdd_size < query.min_hdd_total_gb
  )
    return false;
  if (
    query.min_largest_drive_gb !== undefined &&
    largestDrive(auction) < query.min_largest_drive_gb
  )
    return false;

  // Tri-state: only filter when the caller expressed a preference.
  if (query.ecc !== undefined && auction.is_ecc !== query.ecc) return false;
  if (query.gpu !== undefined && auction.with_gpu !== query.gpu) return false;
  if (query.inic !== undefined && auction.with_inic !== query.inic)
    return false;
  if (query.hwr !== undefined && auction.with_hwr !== query.hwr) return false;
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
    /** Present only when the caller supplied vat_rate. */
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
    // total_matched is reported separately so a model can tell "these are the
    // only 3" from "these are the cheapest 20 of 300".
    total_matched: matched.length,
    returned: page.length,
    truncated: matched.length > page.length,
    auctions: page.map((a) => withVat(a, options.vat_rate)),
  };
}
