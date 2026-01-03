/*
 * Server Price and Configurations
 */

import { getData } from "$lib/api/frontend/dbapi";
import { HETZNER_IPV4_COST_CENTS } from "$lib/constants";
import type { ServerFilter } from "$lib/filter";
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import SQL, { SQLStatement } from "sql-template-strings";

export function generateFilterQuery(
  filter: ServerFilter,
  withCPU: boolean,
  withDatacenters: boolean,
  recentlySeen: boolean = true,
  hasServerTypeColumn: boolean = true,
): SQLStatement {
  const query = SQL` cpu_count >= ${filter.cpuCount}`;

  // server type filtering - only filter when column exists AND user disabled one type
  if (hasServerTypeColumn && (!filter.showAuction || !filter.showStandard)) {
    query.append(SQL` and (`);
    if (filter.showAuction) {
      query.append(SQL` server_type = 'auction'`);
    } else {
      query.append(SQL` 1=2`);
    }
    if (filter.showStandard) {
      query.append(SQL` or server_type = 'standard'`);
    } else {
      query.append(SQL` or 1=2`);
    }
    query.append(SQL` )`);
  }

  query.append(SQL` and (`);

  // location filtering
  if (filter.locationGermany) {
    query.append(SQL` location = 'Germany'`);
  } else {
    query.append(SQL` 1=2`);
  }

  if (filter.locationFinland) {
    query.append(SQL` or location = 'Finland'`);
  } else {
    query.append(SQL` or 1=2`);
  }

  query.append(SQL` )`);

  // datacenter filtering
  if (withDatacenters && filter.selectedDatacenters.length > 0) {
    // Separate city prefixes from specific datacenters
    const cityPrefixes = ["FSN", "NBG", "HEL"];
    const selectedPrefixes = filter.selectedDatacenters.filter((d) =>
      cityPrefixes.includes(d),
    );
    const selectedSpecific = filter.selectedDatacenters.filter(
      (d) => !cityPrefixes.includes(d),
    );

    const conditions: string[] = [];

    // Add LIKE conditions for city prefixes
    for (const prefix of selectedPrefixes) {
      conditions.push(`datacenter LIKE '${prefix}%'`);
    }

    // Add IN condition for specific datacenters
    if (selectedSpecific.length > 0) {
      conditions.push(
        `datacenter in (${selectedSpecific.map((d) => `'${d}'`).join(", ")})`,
      );
    }

    if (conditions.length > 0) {
      query
        .append(SQL` and (`)
        .append(conditions.join(" or "))
        .append(SQL`)`);
    }
  }

  query.append(SQL` and (`);

  // CPU vendor filtering
  if (filter.cpuIntel) {
    query.append(SQL` cpu_vendor = 'Intel'`);
  } else {
    query.append(SQL` 1=2`);
  }

  if (filter.cpuAMD) {
    query.append(SQL` or cpu_vendor = 'AMD'`);
  } else {
    query.append(SQL` or 1=2`);
  }

  query.append(SQL` )`);

  if (withCPU && filter.selectedCpuModels.length > 0) {
    query
      .append(SQL` and cpu in (`)
      .append(filter.selectedCpuModels.map((d) => `'${d}'`).join(", "))
      .append(SQL` )`);
  }

  // RAM settings
  if (filter.extrasECC !== null) {
    query.append(SQL` and is_ecc = ${filter.extrasECC}`);
  }

  query.append(SQL` and ram_size >= ${Math.pow(2, filter.ramInternalSize[0])}`);
  query.append(SQL` and ram_size <= ${Math.pow(2, filter.ramInternalSize[1])}`);

  // disk data
  query.append(SQL` and nvme_count >= ${filter.ssdNvmeCount[0]}`);
  query.append(SQL` and nvme_count <= ${filter.ssdNvmeCount[1]}`);
  query.append(SQL` and sata_count >= ${filter.ssdSataCount[0]}`);
  query.append(SQL` and sata_count <= ${filter.ssdSataCount[1]}`);
  query.append(SQL` and hdd_count >= ${filter.hddCount[0]}`);
  query.append(SQL` and hdd_count <= ${filter.hddCount[1]}`);
  // NVMe size filtering - per-disk or total mode (default to per-disk for backwards compatibility)
  if (filter.ssdNvmeSizeMode === "total") {
    query.append(
      SQL` and nvme_size >= ${filter.ssdNvmeInternalSize[0] * 500} and nvme_size <= ${filter.ssdNvmeInternalSize[1] * 500}`,
    );
  } else {
    query.append(
      SQL` and array_length(array_filter(nvme_drives, x -> x >= ${filter.ssdNvmeInternalSize[0] * 500} AND x <= ${filter.ssdNvmeInternalSize[1] * 500})) = array_length(nvme_drives)`,
    );
  }

  // SATA size filtering - per-disk or total mode
  if (filter.ssdSataSizeMode === "total") {
    query.append(
      SQL` and sata_size >= ${filter.ssdSataInternalSize[0] * 500} and sata_size <= ${filter.ssdSataInternalSize[1] * 500}`,
    );
  } else {
    query.append(
      SQL` and array_length(array_filter(sata_drives, x -> x >= ${filter.ssdSataInternalSize[0] * 500} AND x <= ${filter.ssdSataInternalSize[1] * 500})) = array_length(sata_drives)`,
    );
  }

  // HDD size filtering - per-disk or total mode
  if (filter.hddSizeMode === "total") {
    query.append(
      SQL` and hdd_size >= ${filter.hddInternalSize[0] * 500} and hdd_size <= ${filter.hddInternalSize[1] * 500}`,
    );
  } else {
    query.append(
      SQL` and array_length(array_filter(hdd_drives, x -> x >= ${filter.hddInternalSize[0] * 500} AND x <= ${filter.hddInternalSize[1] * 500})) = array_length(hdd_drives)`,
    );
  }

  // // extras
  if (filter.extrasINIC !== null) {
    query.append(SQL` and with_inic = ${filter.extrasINIC}`);
  }
  if (filter.extrasGPU !== null) {
    query.append(SQL` and with_gpu = ${filter.extrasGPU}`);
  }
  if (filter.extrasHWR !== null) {
    query.append(SQL` and with_hwr = ${filter.extrasHWR}`);
  }
  if (filter.extrasRPS !== null) {
    query.append(SQL` and with_rps = ${filter.extrasRPS}`);
  }

  // recently seen
  if (recentlySeen && filter.recentlySeen) {
    query.append(
      SQL` and seen > (now()::timestamp - interval '70 minute')::timestamp`,
    );
  }

  return query;
}

export type ServerPriceStat = {
  min_price: number;
  max_price: number;
  count: number;
  mean_price: number;
  seen: number;
};

export async function getPrices(
  conn: AsyncDuckDBConnection,
  filter: ServerFilter,
): Promise<ServerPriceStat[]> {
  const prices_filter_query = generateFilterQuery(filter, true, true, false);
  const prices_query = SQL`
        select
			min(price + ${HETZNER_IPV4_COST_CENTS / 100}) as min_price, -- Add IPv4 cost
			max(price + ${HETZNER_IPV4_COST_CENTS / 100}) as max_price, -- Add IPv4 cost
			count(distinct id)::int as count,
			round(mean(price + ${HETZNER_IPV4_COST_CENTS / 100}))::int as mean_price, -- Add IPv4 cost
			extract('epoch' from date_trunc('d', seen))::int as seen
        from
        	server
        where`;
  prices_query.append(prices_filter_query)
    .append(SQL` group by extract('epoch' from date_trunc('d', seen))::int
            order by seen`);
  return getData<ServerPriceStat>(conn, prices_query);
}

export type ServerConfiguration = {
  server_type?: "auction" | "standard"; // Optional for backward compat with old DBs
  information?: string[]; // Product name for standard servers, special info for auctions
  datacenter?: string; // Full datacenter code (e.g. "FSN1-DC14", "HEL1")
  with_hwr: null | boolean;
  with_gpu: null | boolean;
  with_rps: null | boolean;
  with_inic: null | boolean;
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
  price: number | null;
  min_price: number | null;
  last_price: number | null;
  markup_percentage: number | null;
  last_seen: number | null;
  count: number | null;
  // New fields for standard servers
  setup_price?: number | null;
  cpu_cores?: number | null;
  cpu_threads?: number | null;
  cpu_generation?: string | null;
};

// Check if a column exists in the database
async function hasColumn(
  conn: AsyncDuckDBConnection,
  columnName: string,
): Promise<boolean> {
  try {
    const result = await getData<{ count: number }>(
      conn,
      SQL`SELECT count(*) as count FROM duckdb_columns() WHERE table_name='server' AND column_name='${columnName}'`,
    );
    return result.length > 0 && result[0].count > 0;
  } catch {
    return false;
  }
}

// Check if server_type column exists in the database (backwards compat helper)
async function hasServerTypeColumn(
  conn: AsyncDuckDBConnection,
): Promise<boolean> {
  return hasColumn(conn, "server_type");
}

export async function getConfigurations(
  conn: AsyncDuckDBConnection,
  filter: ServerFilter,
): Promise<ServerConfiguration[]> {
  // Check if columns exist for backward compatibility
  const hasServerType = await hasServerTypeColumn(conn);
  const hasNewColumns = await hasColumn(conn, "setup_price");

  const configurations_filter_query = generateFilterQuery(
    filter,
    true,
    true,
    false,
    hasServerType,
  );

  // Build SELECT and GROUP BY dynamically based on column existence
  const serverTypeSelect = hasServerType
    ? "server_type,"
    : "'auction' as server_type,";
  const serverTypeGroupBy = hasServerType ? "server_type," : "";

  // New columns for standard servers (optional for backwards compat)
  const newColumnsSelect = hasNewColumns
    ? `ANY_VALUE(datacenter) AS datacenter,
            ANY_VALUE(setup_price) AS setup_price,
            ANY_VALUE(cpu_cores) AS cpu_cores,
            ANY_VALUE(cpu_threads) AS cpu_threads,
            ANY_VALUE(cpu_generation) AS cpu_generation,`
    : `NULL AS datacenter,
            0 AS setup_price,
            NULL AS cpu_cores,
            NULL AS cpu_threads,
            NULL AS cpu_generation,`;

  const configurations_query = SQL`
    SELECT
        * exclude(last_seen),
        extract('epoch' from last_seen) as last_seen
    FROM (
        SELECT
            `
    .append(serverTypeSelect)
    .append(newColumnsSelect).append(SQL`
            ANY_VALUE(information)::JSON AS information,
            cpu,
            ram_size,
            is_ecc,
            hdd_arr::JSON AS hdd_arr,
            nvme_size,
            nvme_drives::JSON AS nvme_drives,
            sata_size,
            sata_drives::JSON AS sata_drives,
            hdd_size,
            hdd_drives::JSON AS hdd_drives,
            with_gpu,
            with_inic,
            with_hwr,
            with_rps,
            nvme_count,
            sata_count,
            hdd_count,
            MAX(seen) AS last_seen,
            MIN(price + ${HETZNER_IPV4_COST_CENTS / 100}) AS min_price, -- Add IPv4 cost
            MAX_BY(price + ${HETZNER_IPV4_COST_CENTS / 100}, seen) AS price, -- Add IPv4 cost
            CASE
                WHEN MIN(price + ${HETZNER_IPV4_COST_CENTS / 100}) > 0 THEN
                    ((MAX_BY(price + ${HETZNER_IPV4_COST_CENTS / 100}, seen) - MIN(price + ${HETZNER_IPV4_COST_CENTS / 100})) / MIN(price + ${HETZNER_IPV4_COST_CENTS / 100})) * 100
                ELSE 0 -- Avoid division by zero, assume 0% markup if min price is 0
            END AS markup_percentage -- Calculate percentage markup
        from server
        WHERE `);
  configurations_query.append(configurations_filter_query);
  configurations_query
    .append(
      `
        GROUP BY
            `,
    )
    .append(serverTypeGroupBy).append(`
            cpu,
            ram_size,
            is_ecc,
            hdd_arr::JSON,
            nvme_size,
            nvme_drives::JSON,
            sata_size,
            sata_drives::JSON,
            hdd_size,
            hdd_drives::JSON,
            with_gpu,
            with_inic,
            with_hwr,
            with_rps,
            nvme_count,
            sata_count,
            hdd_count
    )`);
  if (filter.recentlySeen) {
    configurations_query.append(
      SQL` where last_seen > (now()::timestamp - interval '70 minute')::timestamp`,
    );
  }
  configurations_query.append(`
    ORDER BY price asc
`);

  const data = await getData<ServerConfiguration>(conn, configurations_query);
  return data.map((d: ServerConfiguration) => {
    d.hdd_arr = JSON.parse(d.hdd_arr as unknown as string);
    d.nvme_drives = JSON.parse(d.nvme_drives as unknown as string);
    d.sata_drives = JSON.parse(d.sata_drives as unknown as string);
    d.hdd_drives = JSON.parse(d.hdd_drives as unknown as string);
    if (d.information) {
      d.information = JSON.parse(d.information as unknown as string);
    }
    return d;
  });
}
