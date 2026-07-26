/**
 * The auction snapshot published to KV after each import.
 *
 * Producer: `worker/src/auction-snapshot.ts` (`buildSnapshot`).
 * Consumer: `src/lib/server/mcp/snapshot.ts` (`getSnapshot`), which the public
 * MCP server reads instead of querying D1 — the whole live dataset is a few
 * hundred rows / ~8-20 KB gzipped, so filtering it in memory is cheaper and
 * simpler than SQL, and costs zero D1 rows read.
 *
 * These declarations used to exist twice, once on each side, because the repo
 * genuinely could not share code across the worker/app workspace boundary. That
 * stopped being true when this package landed: the worker imports it, verified
 * against both a SvelteKit build and a wrangler dry-run. Both sides now import
 * from here, so `SNAPSHOT_VERSION` guards a stale *deployment* reading a newer
 * payload — its original job of detecting drift between two hand-mirrored copies
 * no longer applies.
 */

export const SNAPSHOT_VERSION = 1;
export const SNAPSHOT_KEY = "snapshot:current";

export interface SnapshotPricing {
  currency: "EUR";
  /** Monthly server price, net of VAT and excluding the IPv4 address. */
  monthly_net: number;
  /** Monthly cost of the included IPv4 address, net of VAT. */
  ipv4_monthly: number;
  /** One-off setup fee, net of VAT. */
  setup_net: number;
  /** monthly_net + ipv4_monthly. Still net — VAT is applied by the caller. */
  total_monthly_net: number;
  /** Always false. Stated explicitly so a model cannot assume otherwise. */
  vat_included: false;
  /** Fixed-price servers do not drop further. */
  fixed_price: boolean;
  /** When the price next drops, ISO 8601. Null for fixed-price servers. */
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
