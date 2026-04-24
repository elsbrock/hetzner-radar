import { type ServerConfiguration } from "$lib/api/frontend/filter";
import {
  CONFIGURATION_CATEGORIES,
  type ConfigurationCategoryId,
  buildCategoryQuery,
} from "$lib/api/shared/configurations";
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";

export type ConfigurationsByCategory = Record<
  ConfigurationCategoryId,
  ServerConfiguration[]
>;

interface RawRow {
  cpu: string;
  ram: unknown;
  ram_size: number;
  is_ecc: number | boolean;
  hdd_arr: unknown;
  nvme_size: number | null;
  nvme_drives: unknown;
  sata_size: number | null;
  sata_drives: unknown;
  hdd_size: number | null;
  hdd_drives: unknown;
  with_inic: number | boolean | null;
  with_hwr: number | boolean | null;
  with_gpu: number | boolean | null;
  with_rps: number | boolean | null;
  price: number;
  seen: unknown;
  cpu_cores: number | null;
  cpu_threads: number | null;
  cpu_generation: string | null;
  cpu_score: number | null;
  cpu_multicore_score: number | null;
}

function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toBool(value: number | boolean | null | undefined): boolean | null {
  if (value === null || value === undefined) return null;
  return Boolean(value);
}

function toUnixSeconds(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  if (typeof value === "number") return Math.floor(value / 1000);
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
  }
  return null;
}

function mapRow(row: RawRow): ServerConfiguration {
  return {
    cpu: row.cpu,
    ram: toArray<string>(row.ram),
    ram_size: row.ram_size,
    is_ecc: Boolean(row.is_ecc),
    hdd_arr: toArray<string>(row.hdd_arr),
    nvme_size: row.nvme_size || null,
    nvme_drives: toArray<number>(row.nvme_drives),
    sata_size: row.sata_size || null,
    sata_drives: toArray<number>(row.sata_drives),
    hdd_size: row.hdd_size || null,
    hdd_drives: toArray<number>(row.hdd_drives),
    with_inic: toBool(row.with_inic),
    with_hwr: toBool(row.with_hwr),
    with_gpu: toBool(row.with_gpu),
    with_rps: toBool(row.with_rps),
    price: row.price,
    min_price: row.price,
    last_price: row.price,
    markup_percentage: 0,
    last_seen: toUnixSeconds(row.seen),
    count: 1,
    cpu_cores: row.cpu_cores,
    cpu_threads: row.cpu_threads,
    cpu_generation: row.cpu_generation,
    cpu_score: row.cpu_score,
    cpu_multicore_score: row.cpu_multicore_score,
  };
}

async function runCategoryQuery(
  conn: AsyncDuckDBConnection,
  sql: string,
): Promise<ServerConfiguration[]> {
  const stmt = await conn.prepare(sql);
  try {
    const arrow = await stmt.query();
    const rows = arrow.toArray().map((row) => row.toJSON() as RawRow);
    return rows.map(mapRow);
  } finally {
    stmt?.close();
  }
}

export async function getConfigurationsByCategory(
  conn: AsyncDuckDBConnection,
): Promise<ConfigurationsByCategory> {
  const entries = await Promise.all(
    CONFIGURATION_CATEGORIES.map(async (category) => {
      const sql = buildCategoryQuery(category, { tableName: "server" });
      const rows = await runCategoryQuery(conn, sql);
      return [category.id, rows] as const;
    }),
  );
  return Object.fromEntries(entries) as ConfigurationsByCategory;
}

export async function getConfigurationsMeta(
  conn: AsyncDuckDBConnection,
): Promise<{ lastUpdatedAt: number | null; gpuServerCount: number }> {
  const stmt = await conn.prepare(
    `SELECT
       MAX(seen) AS last_seen,
       SUM(CASE WHEN with_gpu THEN 1 ELSE 0 END) AS gpu_count
     FROM server`,
  );
  try {
    const arrow = await stmt.query();
    const rows = arrow.toArray().map((row) => row.toJSON()) as Array<{
      last_seen: unknown;
      gpu_count: number | null;
    }>;
    const row = rows[0];
    return {
      lastUpdatedAt: toUnixSeconds(row?.last_seen),
      gpuServerCount: Number(row?.gpu_count ?? 0),
    };
  } finally {
    stmt?.close();
  }
}
