import { getData } from '$lib/api/frontend/dbapi';
import { HETZNER_IPV4_COST_CENTS } from '$lib/constants';
import type { ServerConfiguration } from '$lib/api/frontend/filter';
import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import SQL, { SQLStatement } from 'sql-template-strings';

/**
 * Represents the result structure for an auction query.
 */
export interface AuctionResult {
	id: string;
	lastPrice: number;
	lastSeen: number; // Unix timestamp
}

/**
 * Fetches the latest auction data matching a specific server configuration.
 *
 * @param conn - The asynchronous DuckDB connection.
 * @param config - The server configuration to match auctions against.
 * @returns A promise resolving to an array of matching auction results, ordered by last seen time.
 */
export async function getAuctionsForConfiguration(
	conn: AsyncDuckDBConnection,
	config: ServerConfiguration
): Promise<AuctionResult[]> {
	// Construct the SQL query to find matching auctions
	// Assumes 'auction' table exists with columns matching ServerConfiguration fields
	// and that array columns (nvme_drives, etc.) can be compared directly.
	// Ensure the config arrays are sorted for consistent comparison in SQL
	const sortedNvmeDrives = [...config.nvme_drives].sort((a, b) => a - b);
	const sortedSataDrives = [...config.sata_drives].sort((a, b) => a - b);
	const sortedHddDrives = [...config.hdd_drives].sort((a, b) => a - b);

	// Construct the SQL query using the append pattern for clarity and consistency
	// Construct the SQL query using the append pattern for clarity and consistency
	// Explicitly type as SQLStatement
	const query: SQLStatement = SQL`
		WITH LatestAuctions AS (
			SELECT DISTINCT ON (id)
				id,
				price,
				seen
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

	// Append list comparison clauses separately by constructing the list literal string
	// Handle empty arrays correctly by generating '[]'
	const nvmeListLiteral = `[${sortedNvmeDrives.join(',')}]`;
	query.append(` AND list_sort(nvme_drives) = `).append(nvmeListLiteral);

	const sataListLiteral = `[${sortedSataDrives.join(',')}]`;
	query.append(` AND list_sort(sata_drives) = `).append(sataListLiteral);

	const hddListLiteral = `[${sortedHddDrives.join(',')}]`;
	query.append(` AND list_sort(hdd_drives) = `).append(hddListLiteral);

	// Complete the WITH clause and final SELECT
	query.append(SQL`
			ORDER BY id, seen DESC
		)
		SELECT
			id,
			(price + ${HETZNER_IPV4_COST_CENTS / 100}) AS lastPrice, -- Add IPv4 cost
			CAST(EXTRACT('epoch' FROM seen) AS INT) AS lastSeen,
			date_trunc('hour', seen) as seen_hour -- Add hourly truncated timestamp for sorting
		FROM LatestAuctions
		ORDER BY seen_hour DESC, lastPrice ASC -- Order by hour desc, then price asc
		LIMIT 6;
	`);

	// Execute the query and return the results
	// The getData function is assumed to handle the mapping to AuctionResult[] based on the generic type.
	return await getData<AuctionResult>(conn, query);
}