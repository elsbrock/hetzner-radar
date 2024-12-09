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
							date_trunc('day', seen) AS date,
							cpu, ram_size, is_ecc, hdd_arr,
							nvme_size, nvme_drives,
							sata_size, sata_drives,
							hdd_size, hdd_drives,
							with_gpu, with_inic, with_hwr, with_rps,
							min(price) AS daily_min_price
					FROM server
					GROUP BY
							date_trunc('day', seen),
							cpu, ram_size, is_ecc, hdd_arr,
							nvme_size, nvme_drives,
							sata_size, sata_drives,
							hdd_size, hdd_drives,
							with_gpu, with_inic, with_hwr, with_rps
			),
			config_filtered_counts AS (
					-- Count only servers with the minimum price
					SELECT
							date_trunc('day', seen) AS date,
							s.cpu, s.ram_size, s.is_ecc, s.hdd_arr,
							s.nvme_size, s.nvme_drives,
							s.sata_size, s.sata_drives,
							s.hdd_size, s.hdd_drives,
							s.with_gpu, s.with_inic, s.with_hwr, s.with_rps,
							COUNT(*) AS server_count
					FROM server s
					JOIN config_daily_prices cdp
					ON date_trunc('day', s.seen) = cdp.date
						AND s.cpu = cdp.cpu
						AND s.ram_size = cdp.ram_size
						AND s.is_ecc = cdp.is_ecc
						AND s.hdd_arr = cdp.hdd_arr
						AND s.nvme_size = cdp.nvme_size
						AND s.nvme_drives = cdp.nvme_drives
						AND s.sata_size = cdp.sata_size
						AND s.sata_drives = cdp.sata_drives
						AND s.hdd_size = cdp.hdd_size
						AND s.hdd_drives = cdp.hdd_drives
						AND s.with_gpu = cdp.with_gpu
						AND s.with_inic = cdp.with_inic
						AND s.with_hwr = cdp.with_hwr
						AND s.with_rps = cdp.with_rps
						AND s.price = cdp.daily_min_price
					GROUP BY
							date_trunc('day', s.seen),
							s.cpu, s.ram_size, s.is_ecc, s.hdd_arr,
							s.nvme_size, s.nvme_drives,
							s.sata_size, s.sata_drives,
							s.hdd_size, s.hdd_drives,
							s.with_gpu, s.with_inic, s.with_hwr, s.with_rps
			),
			config_deviations AS (
					-- Calculate normalized deviation for each configuration
					SELECT
							cdp.date,
							cdp.daily_min_price,
							cfc.server_count,
							avg(cdp.daily_min_price) OVER (
									PARTITION BY
											cdp.cpu, cdp.ram_size, cdp.is_ecc, cdp.hdd_arr,
											cdp.nvme_size, cdp.nvme_drives,
											cdp.sata_size, cdp.sata_drives,
											cdp.hdd_size, cdp.hdd_drives,
											cdp.with_gpu, cdp.with_inic, cdp.with_hwr, cdp.with_rps
									ORDER BY cdp.date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
							) AS rolling_avg_price
					FROM config_daily_prices cdp
					JOIN config_filtered_counts cfc
					ON cdp.date = cfc.date
						AND cdp.cpu = cfc.cpu
						AND cdp.ram_size = cfc.ram_size
						AND cdp.is_ecc = cfc.is_ecc
						AND cdp.hdd_arr = cfc.hdd_arr
						AND cdp.nvme_size = cfc.nvme_size
						AND cdp.nvme_drives = cfc.nvme_drives
						AND cdp.sata_size = cfc.sata_size
						AND cdp.sata_drives = cfc.sata_drives
						AND cdp.hdd_size = cfc.hdd_size
						AND cdp.hdd_drives = cfc.hdd_drives
						AND cdp.with_gpu = cfc.with_gpu
						AND cdp.with_inic = cfc.with_inic
						AND cdp.with_hwr = cfc.with_hwr
						AND cdp.with_rps = cfc.with_rps
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
				EXTRACT(epoch FROM date_trunc('day', date))::int AS x,
				weighted_sum / NULLIF(total_servers, 0) AS y
		FROM daily_price_index
		ORDER BY date
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
