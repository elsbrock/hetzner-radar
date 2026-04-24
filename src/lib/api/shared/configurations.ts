import { HETZNER_IPV4_COST_CENTS } from "$lib/constants";

export type ConfigurationCategoryId =
  | "price-performance"
  | "affordable"
  | "per-core"
  | "per-ram"
  | "per-nvme"
  | "per-bulk-storage";

export interface ConfigurationCategory {
  id: ConfigurationCategoryId;
  anchor: string;
  title: string;
  tagline: string;
  iconKey: "chart" | "server" | "cpu" | "memory" | "flash" | "archive";
  sqlMetric: string;
  sqlExtraWhere: string;
  displayStoragePrice?: "perTB";
  displayRamPrice?: "perGB";
  highlightScore?: true;
}

export const RESULTS_PER_CATEGORY = 4;

export const CHEAPEST_ABSOLUTE_SCORE_FLOOR = 4000;

export const CONFIGURATION_CATEGORIES: readonly ConfigurationCategory[] = [
  {
    id: "price-performance",
    anchor: "price-performance",
    title: "Best Price/Performance",
    tagline:
      "Cheapest euros per Geekbench 5 multicore point — the all-round best deals today.",
    iconKey: "chart",
    sqlMetric: "effective_price / NULLIF(cpu_multicore_score, 0)",
    sqlExtraWhere: "cpu_multicore_score > 0",
    highlightScore: true,
  },
  {
    id: "affordable",
    anchor: "affordable",
    title: "Most Affordable Configurations",
    tagline: `Lowest absolute price among CPUs with a Geekbench 5 multicore ≥ ${CHEAPEST_ABSOLUTE_SCORE_FLOOR}, so old Atom-class chips don't dominate.`,
    iconKey: "server",
    sqlMetric: "effective_price",
    sqlExtraWhere: `cpu_multicore_score >= ${CHEAPEST_ABSOLUTE_SCORE_FLOOR}`,
  },
  {
    id: "per-core",
    anchor: "cores",
    title: "Best Value per CPU Core",
    tagline:
      "Most cores per euro — good for parallel workloads, CI runners, build farms.",
    iconKey: "cpu",
    sqlMetric: "effective_price / NULLIF(cpu_cores, 0)",
    sqlExtraWhere: "cpu_cores > 0",
  },
  {
    id: "per-ram",
    anchor: "ram",
    title: "Best Value for Memory",
    tagline:
      "Most RAM per euro — ideal for virtual machines, databases, caches.",
    iconKey: "memory",
    sqlMetric: "effective_price / NULLIF(ram_size, 0)",
    sqlExtraWhere: "",
    displayRamPrice: "perGB",
  },
  {
    id: "per-nvme",
    anchor: "nvme",
    title: "High-Performance NVMe Storage",
    tagline:
      "Most NVMe capacity per euro — fast storage for databases, CI, latency-sensitive apps.",
    iconKey: "flash",
    sqlMetric: "effective_price / NULLIF(nvme_size, 0)",
    sqlExtraWhere: "nvme_size > 0",
    displayStoragePrice: "perTB",
  },
  {
    id: "per-bulk-storage",
    anchor: "storage",
    title: "Best Value Bulk Storage",
    tagline:
      "Most SATA + HDD capacity per euro — backups, media servers, archives.",
    iconKey: "archive",
    sqlMetric: "effective_price / NULLIF(sata_size + hdd_size, 0)",
    sqlExtraWhere: "(sata_size + hdd_size) > 0",
    displayStoragePrice: "perTB",
  },
] as const;

const DEDUPE_PARTITION =
  "cpu, ram_size, is_ecc, nvme_size, sata_size, hdd_size";

export interface CategoryQueryOptions {
  tableName: string;
  ipv4CostEur?: number;
}

export function buildCategoryQuery(
  category: ConfigurationCategory,
  {
    tableName,
    ipv4CostEur = HETZNER_IPV4_COST_CENTS / 100,
  }: CategoryQueryOptions,
): string {
  const extraWhere = category.sqlExtraWhere
    ? `AND ${category.sqlExtraWhere}`
    : "";
  return `
    WITH base AS (
      SELECT *,
        (price + ${ipv4CostEur}) AS effective_price
      FROM ${tableName}
      WHERE ram_size > 0
        AND (hdd_size > 0 OR nvme_size > 0 OR sata_size > 0)
        ${extraWhere}
    ),
    deduped AS (
      SELECT * FROM (
        SELECT *,
          ROW_NUMBER() OVER (
            PARTITION BY ${DEDUPE_PARTITION}
            ORDER BY effective_price ASC, seen DESC
          ) AS _dedupe_rank
        FROM base
      ) t
      WHERE _dedupe_rank = 1
    )
    SELECT
      cpu, ram, ram_size, is_ecc, hdd_arr,
      nvme_size, nvme_drives, sata_size, sata_drives,
      hdd_size, hdd_drives,
      with_inic, with_hwr, with_gpu, with_rps,
      effective_price AS price,
      seen,
      cpu_cores, cpu_threads, cpu_generation,
      cpu_score, cpu_multicore_score
    FROM deduped
    ORDER BY (${category.sqlMetric}) ASC, effective_price ASC
    LIMIT ${RESULTS_PER_CATEGORY}
  `;
}
