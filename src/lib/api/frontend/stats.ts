/*
 * Statistics
 */

import { getData } from '$lib/api/frontend/dbapi';
import { generateFilterQuery } from '$lib/api/frontend/filter';
import type { ServerFilter } from '$lib/filter';
import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import SQL from 'sql-template-strings';

export type NameValuePair = {
	name: string;
	value: string;
};

export async function getDatacenters(
	conn: AsyncDuckDBConnection,
	filter: ServerFilter
): Promise<NameValuePair[]> {
	const datacenter_filter_query = generateFilterQuery(filter, true, false);
	const datacenters_query =
		SQL`select distinct datacenter as name, datacenter as value from server where`
			.append(datacenter_filter_query)
			.append(SQL` order by datacenter`);
	return getData<NameValuePair>(conn, datacenters_query);
}

export async function getCPUModels(
	conn: AsyncDuckDBConnection,
	filter: ServerFilter
): Promise<NameValuePair[]> {
	const cpumodel_filter_query = generateFilterQuery(filter, false, true);
	const cpumodel_query = SQL`select distinct cpu as name, cpu as value from server where`
		.append(cpumodel_filter_query)
		.append(SQL` order by cpu`);
	return getData<NameValuePair>(conn, cpumodel_query);
}

export type TemporalStat = {
	x: number;
	y: number;
};
export async function getRamPriceStats(
	conn: AsyncDuckDBConnection,
	withECC?: boolean,
	country?: string
): Promise<TemporalStat[]> {
	const query = SQL`
		select
			x, min(price_per_gb) as y
		from (
			select
				EXTRACT(epoch FROM date_trunc('d', seen))::int as x,
				price / ram_size as price_per_gb
			from
				server`;
	if (withECC !== undefined || country) {
		query.append(SQL` where 1 = 1`);
		if (withECC !== undefined) {
			query.append(SQL` and is_ecc = ${withECC}`);
		}
		if (country) {
			query.append(SQL` and country = ${country}`);
		}
	}
	query.append(SQL`
		) group by
			x
		order by
			x
	`);
	return getData<TemporalStat>(conn, query);
}

export async function getDiskPriceStats(
	conn: AsyncDuckDBConnection,
	diskType: string
): Promise<TemporalStat[]> {
	const query = {
		sql: `
			select
				x, min(price_per_tb) as y
			from (
				select
					EXTRACT(epoch FROM date_trunc('d', seen))::int as x,
					price / (${diskType}_size/1024) as price_per_tb
				from
					server
				where
					${diskType}_size > 0
			)
			group by
				x
			order by
				x
		`,
		values: []
	};
	return getData<TemporalStat>(conn, query as any);
}

export async function getGPUPriceStats(conn: AsyncDuckDBConnection): Promise<TemporalStat[]> {
	const query = SQL`
		select
			x, min(price) as y
		from (
			select
				EXTRACT(epoch FROM date_trunc('d', seen))::int as x,
				price
			from
				server
			where
				with_gpu = true
		)
		group by
			x
		order by
			x
	`;
	return getData<TemporalStat>(conn, query);
}

export async function getCPUVendorPriceStats(
	conn: AsyncDuckDBConnection,
	vendor: string,
	country?: string
): Promise<TemporalStat[]> {
	const query = SQL`
		select
			x, min(price) as y
		from (
			select
				EXTRACT(epoch FROM date_trunc('d', seen))::int as x,
				price
			from
				server
			where
				cpu_vendor = ${vendor}
	`;
	if (country) {
		query.append(SQL` and country = ${country}`);
	}
	query.append(SQL`)
		group by
			x
		order by
			x
	`);
	return getData<TemporalStat>(conn, query);
}

export async function getVolumeStats(
	conn: AsyncDuckDBConnection,
	country?: string
): Promise<TemporalStat[]> {
	const query = SQL`
		select
			x, count(distinct id)::int as y
		from (
			select
				EXTRACT(epoch FROM date_trunc('d', seen))::int as x,
				id
			from
				server
	`;
	if (country) {
		query.append(SQL`where location = ${country}`);
	}
	query.append(SQL`
		)
		group by
			x
		order by
			x
	`);
	return getData<TemporalStat>(conn, query);
}

export async function getVolumeByDatacenterStats(
	conn: AsyncDuckDBConnection,
	datacenter: string,
	country: string
): Promise<TemporalStat[]> {
	const query = SQL`
		select
			x, count(distinct id)::int as y
		from (
			select
				EXTRACT(epoch FROM date_trunc('d', seen))::int as x,
				id
			from
				server
			where
				datacenter = ${datacenter}
				and location = ${country}
		)
		group by
			x
		order by
			x
	`;
	return getData<TemporalStat>(conn, query);
}

export async function getVolumeByDatacenterByCountryStats(
	conn: AsyncDuckDBConnection
): Promise<{ [datacenter: string]: { [country: string]: TemporalStat[] } }> {
	// Get all datacenters and countries
	const datacentersQuery = SQL`
		select distinct datacenter
		from server
		where datacenter is not null and datacenter != ''
		order by datacenter
	`;

	const countriesQuery = SQL`
		select distinct location as country
		from server
		where location is not null and location != ''
		order by location
	`;

	const [datacenters, countries] = await Promise.all([
		getData<{ datacenter: string }>(conn, datacentersQuery),
		getData<{ country: string }>(conn, countriesQuery)
	]);

	const result: {
		[datacenter: string]: { [country: string]: TemporalStat[] };
	} = {};

	// Initialize the result structure
	for (const dc of datacenters) {
		result[dc.datacenter] = {};
	}

	// Query for each datacenter and country combination
	const promises = [];

	for (const dc of datacenters) {
		for (const country of countries) {
			const promise = getVolumeByDatacenterStats(conn, dc.datacenter, country.country).then(
				(stats) => {
					if (!result[dc.datacenter]) {
						result[dc.datacenter] = {};
					}
					result[dc.datacenter][country.country] = stats;
				}
			);
			promises.push(promise);
		}
	}

	await Promise.all(promises);

	return result;
}

export async function getDatacenterList(
	conn: AsyncDuckDBConnection,
	country?: string
): Promise<string[]> {
	const query = SQL`
		select distinct datacenter
		from server
		where datacenter is not null and datacenter != ''
	`;

	if (country) {
		query.append(SQL` and location = ${country}`);
	}

	query.append(SQL` order by datacenter`);

	const result = await getData<{ datacenter: string }>(conn, query);
	return result.map((item) => item.datacenter);
}

export async function getVolumeByCPUVendorStats(
	conn: AsyncDuckDBConnection,
	vendor: string
): Promise<TemporalStat[]> {
	const query = SQL`
		select
			x, count(distinct id)::int as y
		from (
			select
				EXTRACT(epoch FROM date_trunc('d', seen))::int as x,
				id
			from
				server
			where
				cpu_vendor = ${vendor}
		)
		group by
			x
		order by
			x
	`;
	return getData<TemporalStat>(conn, query);
}

export async function getPriceIndexStats(conn: AsyncDuckDBConnection): Promise<TemporalStat[]> {
	const query = SQL`
		WITH config_daily_prices AS (
				-- Calculate the daily min price for each configuration
				SELECT
						date_trunc('d', seen) AS date,
						cpu, ram_size, is_ecc, hdd_arr,
						nvme_size, nvme_drives,
						sata_size, sata_drives,
						hdd_size, hdd_drives,
						with_gpu, with_inic, with_hwr, with_rps,
						min(price) AS daily_min_price,
						COUNT(*) AS server_count
				FROM server
				GROUP BY
						cpu, ram_size, is_ecc, hdd_arr,
						nvme_size, nvme_drives,
						sata_size, sata_drives,
						hdd_size, hdd_drives,
						with_gpu, with_inic, with_hwr, with_rps,
						date_trunc('d', seen)
		),
		-- Calculate a baseline reference price for each configuration
		config_baseline AS (
				SELECT
						cpu, ram_size, is_ecc, hdd_arr,
						nvme_size, nvme_drives,
						sata_size, sata_drives,
						hdd_size, hdd_drives,
						with_gpu, with_inic, with_hwr, with_rps,
						-- Use median price over the last 90 days as the baseline
						percentile_cont(0.5) WITHIN GROUP (ORDER BY daily_min_price) AS baseline_price
				FROM config_daily_prices
				WHERE date >= current_date - INTERVAL '90 days'
				GROUP BY
						cpu, ram_size, is_ecc, hdd_arr,
						nvme_size, nvme_drives,
						sata_size, sata_drives,
						hdd_size, hdd_drives,
						with_gpu, with_inic, with_hwr, with_rps
		),
		-- Calculate the price index by comparing daily prices to the baseline
		config_price_index AS (
				SELECT
						cdp.date,
						cdp.daily_min_price,
						cdp.server_count,
						cb.baseline_price,
						-- Calculate ratio of current price to baseline
						cdp.daily_min_price / NULLIF(cb.baseline_price, 0) AS price_ratio
				FROM config_daily_prices cdp
				JOIN config_baseline cb ON
						cdp.cpu = cb.cpu AND
						cdp.ram_size = cb.ram_size AND
						cdp.is_ecc = cb.is_ecc AND
						cdp.hdd_arr = cb.hdd_arr AND
						cdp.nvme_size = cb.nvme_size AND
						cdp.nvme_drives = cb.nvme_drives AND
						cdp.sata_size = cb.sata_size AND
						cdp.sata_drives = cb.sata_drives AND
						cdp.hdd_size = cb.hdd_size AND
						cdp.hdd_drives = cb.hdd_drives AND
						cdp.with_gpu = cb.with_gpu AND
						cdp.with_inic = cb.with_inic AND
						cdp.with_hwr = cb.with_hwr AND
						cdp.with_rps = cb.with_rps
		),
		daily_price_index AS (
				-- Consolidate to a single price index per day
				SELECT
						date,
						SUM(price_ratio * server_count) AS weighted_sum,
						SUM(server_count) AS total_servers
				FROM config_price_index
				GROUP BY date
		)
		-- Final result: one price index value per day
		SELECT
				EXTRACT(epoch FROM date_trunc('d', date))::int as x,
				weighted_sum / NULLIF(total_servers, 0) as y
		FROM daily_price_index
		ORDER BY date;
	`;
	return getData<TemporalStat>(conn, query);
}

export type LastUpdate = {
	last_updated: number;
};

export async function getSoldAuctionPriceStats(c: AsyncDuckDBConnection): Promise<TemporalStat[]> {
	const query = SQL`
		WITH RankedAuctions AS (
			SELECT
				id,
				price,
				seen,
				fixed_price,
				ROW_NUMBER() OVER (PARTITION BY id ORDER BY seen DESC) as rn
			FROM server
		),
		SoldAuctions AS (
			SELECT
				id,
				price,
				seen
			FROM RankedAuctions
			WHERE rn = 1 AND fixed_price = FALSE -- Only latest entry for each ID, and not fixed price
		)
		SELECT
			EXTRACT(epoch FROM date_trunc('day', seen))::int AS x, -- Date as Unix epoch timestamp
			AVG(price) AS y                     -- Average price
		FROM SoldAuctions
		GROUP BY 1 -- Group by the first selected column (date_trunc('day', seen))
		ORDER BY 1; -- Order by the first selected column (date_trunc('day', seen))
	`;
	try {
		const result = await getData<TemporalStat>(c, query);
		return result;
	} catch (error) {
		console.error('Error in getSoldAuctionPriceStats:', error);
		return [];
	}
}

export function getLastUpdated(conn: AsyncDuckDBConnection): Promise<LastUpdate[]> {
	return getData<LastUpdate>(
		conn,
		SQL`select extract('epoch' from seen)::int as last_updated from server order by last_updated desc limit 1`
	);
}

/**
 * Get volume statistics for a specific CPU model from a specific vendor
 * @param conn DuckDB connection
 * @param vendor CPU vendor (Intel or AMD)
 * @param model CPU model (optional) - if provided, filters to this specific model
 * @param limit Maximum number of models to return (optional) - if provided and model is not specified, returns top N models by volume
 * @returns Array of TemporalStat objects
 */
export async function getVolumeByCPUModelStats(
	conn: AsyncDuckDBConnection,
	vendor: string,
	model?: string,
	limit?: number
): Promise<{ [model: string]: TemporalStat[] }> {
	// If a specific model is requested, get volume data for just that model
	if (model) {
		const query = SQL`
      select
        EXTRACT(epoch FROM date_trunc('d', seen))::int as x,
        count(distinct id)::int as y
      from
        server
      where
        cpu_vendor = ${vendor}
        and cpu = ${model}
      group by
        x
      order by
        x
    `;

		const result = await getData<TemporalStat>(conn, query);
		return { [model]: result };
	}

	// Otherwise, get the top N models by volume
	const topModelsQuery = SQL`
    select
      cpu as model,
      count(distinct id) as count
    from
      server
    where
      cpu_vendor = ${vendor}
      and cpu is not null
      and cpu != ''
    group by
      cpu
    order by
      count desc
  `;

	if (limit) {
		topModelsQuery.append(SQL` limit ${limit}`);
	}

	const topModels = await getData<{ model: string; count: number }>(conn, topModelsQuery);

	// Initialize result object
	const result: { [model: string]: TemporalStat[] } = {};

	// Query volume data for each top model
	const promises = topModels.map(async ({ model }) => {
		const modelQuery = SQL`
      select
        EXTRACT(epoch FROM date_trunc('d', seen))::int as x,
        count(distinct id)::int as y
      from
        server
      where
        cpu_vendor = ${vendor}
        and cpu = ${model}
      group by
        x
      order by
        x
    `;

		const modelStats = await getData<TemporalStat>(conn, modelQuery);
		result[model] = modelStats;
	});

	await Promise.all(promises);

	return result;
}

/**
 * Get popularity statistics comparing current auction count to historical average
 * @param conn DuckDB connection
 * @param filter Server filter to apply (optional)
 * @returns A number representing the ratio of current auction count to 30-day average
 */
export async function getPopularityStats(
	conn: AsyncDuckDBConnection,
	filter?: ServerFilter
): Promise<number> {
	// Start with base query
	const query = SQL`
    WITH daily_counts AS (
      SELECT
        date_trunc('day', seen) AS day,
        COUNT(DISTINCT id) AS daily_count
      FROM
        server
  `;

	// Apply filter if provided
	if (filter) {
		const filterQuery = generateFilterQuery(filter, false, false);
		if (filterQuery.text.trim() !== '') {
			query.append(SQL` WHERE `).append(filterQuery);
		}
	}

	// Complete the query to calculate current count vs 30-day average
	query.append(SQL`
      GROUP BY
        day
      ORDER BY
        day
    ),
    
    stats AS (
      SELECT
		-- Only count auctions with price updates in the last 70 minutes
		(SELECT COUNT(DISTINCT id) FROM server 
		WHERE seen >= NOW()::timestamp - INTERVAL '70 minutes'
		-- Apply the same filter conditions here if provided
		) AS current_count,
		AVG(daily_count) AS avg_count_30d
      FROM
        daily_counts
      WHERE
        day >= (SELECT MAX(day) FROM daily_counts) - INTERVAL '30 days'
    )
    
    SELECT
      CASE
        WHEN avg_count_30d = 0 THEN 1
        ELSE current_count / avg_count_30d
      END AS popularity_ratio
    FROM
      stats
  `);

	const result = await getData<{ popularity_ratio: number }>(conn, query);

	// Return 1 (neutral) if no data is available
	if (result.length === 0) {
		return 1;
	}

	return result[0].popularity_ratio;
}
