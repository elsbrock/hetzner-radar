import { getData } from "$lib/api/frontend/dbapi";
import type { ServerConfiguration } from "$lib/api/frontend/filter";
import type { ServerFilter } from "$lib/filter";
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import SQL, { SQLStatement } from "sql-template-strings";

export interface AuctionResult {
  id: string;
  lastPrice: number;
  lastSeen: number; // Unix timestamp
}

export async function getAuctionsForConfiguration(
  conn: AsyncDuckDBConnection,
  config: ServerConfiguration,
  filter: ServerFilter,
): Promise<AuctionResult[]> {
  const sortedNvmeDrives = [...config.nvme_drives].sort((a, b) => a - b);
  const sortedSataDrives = [...config.sata_drives].sort((a, b) => a - b);
  const sortedHddDrives = [...config.hdd_drives].sort((a, b) => a - b);

  const query: SQLStatement = SQL`
			WITH filtered_servers AS (
				SELECT
					id,
					price,
					seen,
					CAST(EXTRACT('epoch' FROM seen) AS INT) AS seen_epoch,
					ROW_NUMBER() OVER (PARTITION BY id ORDER BY seen DESC) AS rn
				FROM server
				WHERE cpu = ${config.cpu}
					AND ram_size = ${config.ram_size}
					AND nvme_count = ${config.nvme_drives.length}
					AND sata_count = ${config.sata_drives.length}
					AND hdd_count = ${config.hdd_drives.length}
					AND is_ecc = ${config.is_ecc}
					AND with_inic = ${config.with_inic}
					AND with_gpu = ${config.with_gpu}
					AND with_hwr = ${config.with_hwr}
					AND with_rps = ${config.with_rps}
	`;

  if (filter.recentlySeen) {
    query.append(
      SQL` AND seen > (now()::timestamp - interval '70 minute')::timestamp`,
    );
  }

  // Location filtering
  const locationConditions: string[] = [];
  if (filter.locationGermany) {
    locationConditions.push("location = 'Germany'");
  }
  if (filter.locationFinland) {
    locationConditions.push("location = 'Finland'");
  }
  if (locationConditions.length > 0) {
    query
      .append(SQL` AND (`)
      .append(locationConditions.join(" OR "))
      .append(SQL`)`);
  } else {
    // No locations selected - return no results
    query.append(SQL` AND 1=0`);
  }

  // Datacenter filtering
  if (filter.selectedDatacenters.length > 0) {
    const cityPrefixes = ["FSN", "NBG", "HEL"];
    const selectedPrefixes = filter.selectedDatacenters.filter((d) =>
      cityPrefixes.includes(d),
    );
    const selectedSpecific = filter.selectedDatacenters.filter(
      (d) => !cityPrefixes.includes(d),
    );

    const dcConditions: string[] = [];

    // Add LIKE conditions for city prefixes
    for (const prefix of selectedPrefixes) {
      dcConditions.push(`datacenter LIKE '${prefix}%'`);
    }

    // Add IN condition for specific datacenters
    if (selectedSpecific.length > 0) {
      dcConditions.push(
        `datacenter IN (${selectedSpecific.map((d) => `'${d}'`).join(", ")})`,
      );
    }

    if (dcConditions.length > 0) {
      query
        .append(SQL` AND (`)
        .append(dcConditions.join(" OR "))
        .append(SQL`)`);
    }
  }

  const nvmeListLiteral = `[${sortedNvmeDrives.join(",")}]`;
  query.append(` AND list_sort(nvme_drives) = `).append(nvmeListLiteral);

  const sataListLiteral = `[${sortedSataDrives.join(",")}]`;
  query.append(` AND list_sort(sata_drives) = `).append(sataListLiteral);

  const hddListLiteral = `[${sortedHddDrives.join(",")}]`;
  query.append(` AND list_sort(hdd_drives) = `).append(hddListLiteral);

  // Complete the query with the final SELECT to get only the most recent entry for each auction
  query.append(SQL`
			)
			SELECT
				id,
				price AS lastPrice,
				seen_epoch AS lastSeen
			FROM filtered_servers
			WHERE rn = 1
			ORDER BY date_trunc('h', seen) DESC, price ASC
			LIMIT 6
	`);

  return await getData<AuctionResult>(conn, query);
}
