import type { PageServerLoad } from "./$types";
import { HETZNER_IPV4_COST_CENTS } from "$lib/constants";

interface AuctionRow {
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

export interface ConfigurationServer {
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

function mapRowToConfig(row: AuctionRow): ConfigurationServer {
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
    markup_percentage: 0,
    last_seen: row.seen
      ? Math.floor(new Date(row.seen).getTime() / 1000)
      : null,
    count: 1,
  };
}

// Deduplicate by CPU, keeping the one with lowest price for each category
function dedupeByCategory(
  rows: AuctionRow[],
  orderBy: (row: AuctionRow) => number,
): ConfigurationServer[] {
  const seen = new Set<string>();
  const result: ConfigurationServer[] = [];

  // Sort by the category metric
  const sorted = [...rows].sort((a, b) => orderBy(a) - orderBy(b));

  for (const row of sorted) {
    if (!seen.has(row.cpu)) {
      seen.add(row.cpu);
      result.push(mapRowToConfig(row));
      if (result.length >= 4) break;
    }
  }

  return result;
}

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env?.DB;

  if (!db) {
    return {
      cheapestConfigurations: [] as ConfigurationServer[],
      cheapDiskConfigurations: [] as ConfigurationServer[],
      cheapRamConfigurations: [] as ConfigurationServer[],
      cheapNvmeConfigurations: [] as ConfigurationServer[],
      cheapSataConfigurations: [] as ConfigurationServer[],
    };
  }

  try {
    // Fetch all current auctions with storage - we'll filter/sort in JS
    // This is more efficient than 5 separate queries
    const baseQuery = `
      SELECT cpu, ram, ram_size, is_ecc, hdd_arr,
             nvme_size, nvme_drives, sata_size, sata_drives,
             hdd_size, hdd_drives, with_inic, with_hwr,
             with_gpu, with_rps, price, seen
      FROM current_auctions
      WHERE ram_size > 0
        AND (hdd_size > 0 OR nvme_size > 0 OR sata_size > 0)
      ORDER BY price ASC
      LIMIT 100
    `;

    const result = await db.prepare(baseQuery).all<AuctionRow>();
    const rows = result.results ?? [];

    // Get cheapest overall (by absolute price)
    const cheapestConfigurations = dedupeByCategory(rows, (r) => r.price);

    // Get cheapest per GB of HDD (only rows with HDD)
    const hddRows = rows.filter((r) => r.hdd_size > 0);
    const cheapDiskConfigurations = dedupeByCategory(
      hddRows,
      (r) => r.price / r.hdd_size,
    );

    // Get cheapest per GB of RAM
    const cheapRamConfigurations = dedupeByCategory(
      rows,
      (r) => r.price / r.ram_size,
    );

    // Get cheapest per GB of NVMe (only rows with NVMe)
    const nvmeRows = rows.filter((r) => r.nvme_size > 0);
    const cheapNvmeConfigurations = dedupeByCategory(
      nvmeRows,
      (r) => r.price / r.nvme_size,
    );

    // Get cheapest per GB of SATA (only rows with SATA)
    const sataRows = rows.filter((r) => r.sata_size > 0);
    const cheapSataConfigurations = dedupeByCategory(
      sataRows,
      (r) => r.price / r.sata_size,
    );

    return {
      cheapestConfigurations,
      cheapDiskConfigurations,
      cheapRamConfigurations,
      cheapNvmeConfigurations,
      cheapSataConfigurations,
    };
  } catch (error) {
    console.error("Failed to load configurations:", error);
    return {
      cheapestConfigurations: [] as ConfigurationServer[],
      cheapDiskConfigurations: [] as ConfigurationServer[],
      cheapRamConfigurations: [] as ConfigurationServer[],
      cheapNvmeConfigurations: [] as ConfigurationServer[],
      cheapSataConfigurations: [] as ConfigurationServer[],
    };
  }
};
