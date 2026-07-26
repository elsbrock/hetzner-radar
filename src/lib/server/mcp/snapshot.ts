/**
 * Reader for the auction snapshot published by the worker.
 *
 * The producer is `worker/src/auction-snapshot.ts`. The payload shape itself
 * lives in `@server-radar/filter-spec/snapshot` and is imported by both sides —
 * it used to be hand-mirrored here, from a time when the repo could not share
 * code across the worker/app workspace boundary. Re-exported below so existing
 * `$lib/server/mcp/snapshot` importers keep working unchanged.
 */

import {
  SNAPSHOT_KEY,
  SNAPSHOT_VERSION,
  type AuctionSnapshot,
  type SnapshotAuction,
  type SnapshotPricing,
} from "@server-radar/filter-spec/snapshot";

export { SNAPSHOT_KEY, SNAPSHOT_VERSION };
export type { AuctionSnapshot, SnapshotAuction, SnapshotPricing };

/** How long a fetched snapshot is reused within an isolate. */
const CACHE_TTL_MS = 5 * 60 * 1000;

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
