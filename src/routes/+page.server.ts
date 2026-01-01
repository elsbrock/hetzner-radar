import type { PageServerLoad } from "./$types";
import { HETZNER_IPV4_COST_CENTS } from "$lib/constants";

// Update interface to match the actual query result structure
interface CountQueryResult {
  count: bigint;
}

// Raw auction row from D1
interface CurrentAuctionRow {
  id: number;
  cpu: string;
  ram: string;
  ram_size: number;
  is_ecc: number;
  hdd_arr: string;
  nvme_size: number;
  nvme_drives: string;
  sata_size: number;
  sata_drives: string;
  hdd_size: number;
  hdd_drives: string;
  with_inic: number;
  with_hwr: number;
  with_gpu: number;
  with_rps: number;
  price: number;
  seen: string;
}

// ServerConfiguration type for the frontend
export interface FeaturedServer {
  cpu: string;
  ram: string[];
  ram_size: number;
  is_ecc: boolean;
  hdd_arr: string[];
  nvme_size: number | null;
  nvme_drives: number[];
  sata_size: number | null;
  sata_drives: number[];
  hdd_size: number | null;
  hdd_drives: number[];
  with_inic: boolean | null;
  with_hwr: boolean | null;
  with_gpu: boolean | null;
  with_rps: boolean | null;
  price: number | null;
  min_price: number | null;
  last_price: number | null;
  markup_percentage: number | null;
  last_seen: number | null;
  count: number | null;
}

function parseJsonArray<T>(value: string | null): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapAuctionToFeaturedServer(row: CurrentAuctionRow): FeaturedServer {
  const priceWithIpv4 = row.price + HETZNER_IPV4_COST_CENTS / 100;
  return {
    cpu: row.cpu,
    ram: parseJsonArray<string>(row.ram),
    ram_size: row.ram_size,
    is_ecc: Boolean(row.is_ecc),
    hdd_arr: parseJsonArray<string>(row.hdd_arr),
    nvme_size: row.nvme_size || null,
    nvme_drives: parseJsonArray<number>(row.nvme_drives),
    sata_size: row.sata_size || null,
    sata_drives: parseJsonArray<number>(row.sata_drives),
    hdd_size: row.hdd_size || null,
    hdd_drives: parseJsonArray<number>(row.hdd_drives),
    with_inic: Boolean(row.with_inic),
    with_hwr: Boolean(row.with_hwr),
    with_gpu: Boolean(row.with_gpu),
    with_rps: Boolean(row.with_rps),
    price: priceWithIpv4,
    min_price: priceWithIpv4,
    last_price: priceWithIpv4,
    markup_percentage: 0, // These are the cheapest, so 0% markup
    last_seen: row.seen
      ? Math.floor(new Date(row.seen).getTime() / 1000)
      : null,
    count: 1,
  };
}

// Deduplicate by CPU, keeping the cheapest for each CPU model
function dedupeByСpu(rows: CurrentAuctionRow[]): FeaturedServer[] {
  const seen = new Set<string>();
  const result: FeaturedServer[] = [];

  // Already sorted by price from DB query
  for (const row of rows) {
    if (!seen.has(row.cpu)) {
      seen.add(row.cpu);
      result.push(mapAuctionToFeaturedServer(row));
      if (result.length >= 4) break;
    }
  }

  return result;
}

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env?.DB;

  if (!db)
    return {
      userStats: 0,
      alertStats: 0,
      historyStats: 0,
      auctionStats: 0,
      latestBatchStats: 0,
      featuredServers: [] as FeaturedServer[],
    };

  try {
    // Get all stats from DB
    const [
      userStats,
      alertStats,
      historyStats,
      auctionStats,
      latestBatchStats,
      featuredServersRows,
    ] = await Promise.all([
      db
        .prepare("SELECT COUNT(*) as count FROM user")
        .first<CountQueryResult>()
        .then((result) =>
          Number((result as unknown as CountQueryResult)?.count ?? 0n),
        )
        .catch(() => 0),

      db
        .prepare(
          `
          SELECT
            (SELECT COUNT(*) FROM price_alert) +
            (SELECT COUNT(*) FROM cloud_availability_alert) as count
        `,
        )
        .first<CountQueryResult>()
        .then((result) =>
          Number((result as unknown as CountQueryResult)?.count ?? 0n),
        )
        .catch(() => 0),

      db
        .prepare(
          `
          SELECT
            (SELECT COUNT(*) FROM price_alert_history) +
            (SELECT COUNT(*) FROM cloud_alert_history) as count
        `,
        )
        .first<CountQueryResult>()
        .then((result) =>
          Number((result as unknown as CountQueryResult)?.count ?? 0n),
        )
        .catch(() => 0),

      db
        .prepare("SELECT COUNT(DISTINCT id) as count FROM auctions")
        .first<CountQueryResult>()
        .then((result) =>
          Number((result as unknown as CountQueryResult)?.count ?? 0n),
        )
        .catch(() => 0),

      db
        .prepare("SELECT COUNT(*) as count FROM current_auctions")
        .first<CountQueryResult>()
        .then((result) =>
          Number((result as unknown as CountQueryResult)?.count ?? 0n),
        )
        .catch(() => 0),

      // Fetch cheapest servers for landing page hero (more than 4 to allow deduplication)
      db
        .prepare(
          `SELECT id, cpu, ram, ram_size, is_ecc, hdd_arr,
                  nvme_size, nvme_drives, sata_size, sata_drives,
                  hdd_size, hdd_drives, with_inic, with_hwr,
                  with_gpu, with_rps, price, seen
           FROM current_auctions
           ORDER BY price ASC
           LIMIT 50`,
        )
        .all<CurrentAuctionRow>()
        .then((result) => result.results ?? [])
        .catch(() => [] as CurrentAuctionRow[]),
    ]);

    // Deduplicate by CPU to show variety (one per CPU model)
    const featuredServers = dedupeByСpu(featuredServersRows);

    // Ensure we return actual numbers, not null or undefined
    return {
      userStats: userStats || 0,
      alertStats: alertStats || 0,
      historyStats: historyStats || 0,
      auctionStats: auctionStats || 0,
      latestBatchStats: latestBatchStats || 0,
      featuredServers,
    };
  } catch (error) {
    console.error("Failed to load stats:", error);
    return {
      userStats: 0,
      alertStats: 0,
      historyStats: 0,
      auctionStats: 0,
      latestBatchStats: 0,
      featuredServers: [] as FeaturedServer[],
    };
  }
};
