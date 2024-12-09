/*
 * Statistics
 */

import { getData } from "$lib/api/frontend/dbapi";
import { generateFilterQuery } from "$lib/api/frontend/filter";
import type { ServerFilter } from "$lib/filter";
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import SQL from "sql-template-strings";

export type NameValuePair = {
	name: string;
	value: string;
};

export async function getDatacenters(conn: AsyncDuckDBConnection, filter: ServerFilter): Promise<NameValuePair[]> {
	let datacenter_filter_query = generateFilterQuery(filter, true, false);
	let datacenters_query =
		SQL`select distinct datacenter as name, datacenter as value from server where`
			.append(datacenter_filter_query)
			.append(SQL` order by datacenter`);
	return getData<NameValuePair>(conn, datacenters_query);
}

export async function getCPUModels(conn: AsyncDuckDBConnection, filter: ServerFilter): Promise<NameValuePair[]> {
	let cpumodel_filter_query = generateFilterQuery(filter, false, true);
	let cpumodel_query = SQL`select distinct cpu as name, cpu as value from server where`
		.append(cpumodel_filter_query)
		.append(SQL` order by cpu`);
	return getData<NameValuePair>(conn, cpumodel_query);
}

export type TemporalStat = {
	x: number;
	y: number;
};

export async function getRamPriceStats(conn: AsyncDuckDBConnection, withECC?: boolean, country?: string): Promise<TemporalStat[]> {
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

export async function getCPUVendorPriceStats(conn: AsyncDuckDBConnection, vendor: string, country?: string): Promise<TemporalStat[]> {
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

export async function getVolumeStats(conn: AsyncDuckDBConnection, country?: string): Promise<TemporalStat[]> {
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
		config_deviations AS (
				-- Calculate normalized deviation for each configuration
				SELECT
						date,
						daily_min_price,
						server_count,
						avg(daily_min_price) OVER (
								PARTITION BY
										cpu, ram_size, is_ecc, hdd_arr,
										nvme_size, nvme_drives,
										sata_size, sata_drives,
										hdd_size, hdd_drives,
										with_gpu, with_inic, with_hwr, with_rps
								ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
						) AS rolling_avg_price
				FROM config_daily_prices
		),
		daily_price_index AS (
				-- Consolidate to a single price index per day
				SELECT
						date,
						SUM((daily_min_price / NULLIF(rolling_avg_price, 0)) * server_count) AS weighted_sum,
						SUM(server_count) AS total_servers
				FROM config_deviations
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

export function getLastUpdated(conn: AsyncDuckDBConnection): Promise<LastUpdate[]> {
  return getData<LastUpdate>(
    conn,
    SQL`select extract('epoch' from seen)::int as last_updated from server order by last_updated desc limit 1`
  );
}
