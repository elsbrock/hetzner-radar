import type { PageServerLoad } from "./$types";
import {
  CONFIGURATION_CATEGORIES,
  type ConfigurationCategoryId,
  buildCategoryQuery,
} from "$lib/api/shared/configurations";

interface AuctionRow {
  cpu: string;
  ram: string;
  ram_size: number;
  is_ecc: number;
  hdd_arr: string;
  nvme_size: number | null;
  nvme_drives: string;
  sata_size: number | null;
  sata_drives: string;
  hdd_size: number | null;
  hdd_drives: string;
  with_inic: number | null;
  with_hwr: number | null;
  with_gpu: number | null;
  with_rps: number | null;
  price: number;
  seen: string;
  cpu_cores: number | null;
  cpu_threads: number | null;
  cpu_generation: string | null;
  cpu_score: number | null;
  cpu_multicore_score: number | null;
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
  cpu_cores: number | null;
  cpu_threads: number | null;
  cpu_generation: string | null;
  cpu_score: number | null;
  cpu_multicore_score: number | null;
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
    with_inic: row.with_inic === null ? null : Boolean(row.with_inic),
    with_hwr: row.with_hwr === null ? null : Boolean(row.with_hwr),
    with_gpu: row.with_gpu === null ? null : Boolean(row.with_gpu),
    with_rps: row.with_rps === null ? null : Boolean(row.with_rps),
    price: row.price,
    min_price: row.price,
    last_price: row.price,
    markup_percentage: 0,
    last_seen: row.seen
      ? Math.floor(new Date(row.seen).getTime() / 1000)
      : null,
    count: 1,
    cpu_cores: row.cpu_cores,
    cpu_threads: row.cpu_threads,
    cpu_generation: row.cpu_generation,
    cpu_score: row.cpu_score,
    cpu_multicore_score: row.cpu_multicore_score,
  };
}

export type ConfigurationsByCategory = Record<
  ConfigurationCategoryId,
  ConfigurationServer[]
>;

function emptyCategories(): ConfigurationsByCategory {
  return Object.fromEntries(
    CONFIGURATION_CATEGORIES.map((c) => [c.id, []]),
  ) as unknown as ConfigurationsByCategory;
}

export const load: PageServerLoad = async ({ platform }) => {
  const db = platform?.env?.DB;

  if (!db) {
    return {
      categories: emptyCategories(),
      lastUpdatedAt: null as number | null,
      gpuServerCount: 0,
    };
  }

  const categoryResults = await Promise.all(
    CONFIGURATION_CATEGORIES.map(async (category) => {
      try {
        const sql = buildCategoryQuery(category, {
          tableName: "current_auctions",
        });
        const result = await db.prepare(sql).all<AuctionRow>();
        return [
          category.id,
          (result.results ?? []).map(mapRowToConfig),
        ] as const;
      } catch (error) {
        console.error(`Failed to load category ${category.id}:`, error);
        return [category.id, []] as const;
      }
    }),
  );

  let lastUpdatedAt: number | null = null;
  let gpuServerCount = 0;
  try {
    const meta = await db
      .prepare(
        `SELECT
           MAX(seen) AS last_seen,
           SUM(CASE WHEN with_gpu = 1 THEN 1 ELSE 0 END) AS gpu_count
         FROM current_auctions`,
      )
      .first<{ last_seen: string | null; gpu_count: number | null }>();
    lastUpdatedAt = meta?.last_seen
      ? Math.floor(new Date(meta.last_seen).getTime() / 1000)
      : null;
    gpuServerCount = meta?.gpu_count ?? 0;
  } catch (error) {
    console.error("Failed to load configurations metadata:", error);
  }

  const categories = Object.fromEntries(
    categoryResults,
  ) as unknown as ConfigurationsByCategory;

  return {
    categories,
    lastUpdatedAt,
    gpuServerCount,
  };
};
