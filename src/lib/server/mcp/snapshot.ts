/**
 * Reader for the auction snapshot published by the worker.
 *
 * The producer is `worker/src/auction-snapshot.ts`. These types are a
 * deliberate duplicate — this repo does not share code across the worker/app
 * workspace boundary (same pattern as `src/lib/api/backend/webhook.ts`). The
 * `version` field exists so drift surfaces as a logged mismatch rather than a
 * silent mis-parse.
 */

export const SNAPSHOT_VERSION = 1;
export const SNAPSHOT_KEY = "snapshot:current";

/** How long a fetched snapshot is reused within an isolate. */
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface SnapshotPricing {
  currency: "EUR";
  monthly_net: number;
  ipv4_monthly: number;
  setup_net: number;
  total_monthly_net: number;
  vat_included: false;
  fixed_price: boolean;
  next_reduce_at: string | null;
}

export interface SnapshotAuction {
  id: number;
  datacenter: string;
  location: string;
  cpu: string;
  cpu_vendor: string;
  cpu_count: number;
  cpu_cores: number | null;
  cpu_threads: number | null;
  cpu_generation: string | null;
  cpu_score: number | null;
  cpu_multicore_score: number | null;
  is_highio: boolean;
  ram_size: number;
  is_ecc: boolean;
  nvme_count: number;
  nvme_drives: number[];
  nvme_size: number;
  sata_count: number;
  sata_drives: number[];
  sata_size: number;
  hdd_count: number;
  hdd_drives: number[];
  hdd_size: number;
  with_inic: boolean;
  with_hwr: boolean;
  with_gpu: boolean;
  with_rps: boolean;
  traffic: string;
  bandwidth: number;
  information: string[];
  seen: string;
  pricing: SnapshotPricing;
}

export interface AuctionSnapshot {
  version: number;
  generated_at: string;
  count: number;
  auctions: SnapshotAuction[];
}

/**
 * Module-scope cache. Isolates are reused across requests on Workers, so in
 * practice this means one KV read per isolate per 5 minutes rather than one per
 * request. It is intentionally not a `Map` keyed by binding: an isolate only
 * ever sees one SNAPSHOT namespace.
 */
let cached: { snapshot: AuctionSnapshot; fetchedAt: number } | null = null;

/** Test seam — resets the isolate cache. */
export function __resetSnapshotCache(): void {
  cached = null;
}

export class SnapshotUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotUnavailableError";
  }
}

/**
 * Returns the current snapshot, reading from KV at most once per CACHE_TTL_MS.
 *
 * Throws SnapshotUnavailableError when there is nothing to serve — callers turn
 * that into an MCP error rather than pretending the auction list is empty,
 * which would read to a model as "no servers available".
 */
export async function getSnapshot(
  kv: SnapshotNamespace | undefined,
  now: number = Date.now(),
): Promise<AuctionSnapshot> {
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.snapshot;
  }

  if (!kv) {
    throw new SnapshotUnavailableError(
      "Auction snapshot storage is not configured.",
    );
  }

  const raw = await kv.get(SNAPSHOT_KEY, "json");

  if (!raw) {
    // Prefer a stale snapshot over failing outright: five-minute-old data is
    // far more useful than an error, and the feed only refreshes that often.
    if (cached) return cached.snapshot;
    throw new SnapshotUnavailableError(
      "Auction snapshot has not been published yet.",
    );
  }

  const snapshot = raw as AuctionSnapshot;

  if (snapshot.version !== SNAPSHOT_VERSION) {
    console.warn(
      `[mcp] snapshot version mismatch: got ${snapshot.version}, expected ${SNAPSHOT_VERSION}`,
    );
  }

  cached = { snapshot, fetchedAt: now };
  return snapshot;
}
