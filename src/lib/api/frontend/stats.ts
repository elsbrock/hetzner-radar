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

export type LastUpdate = {
  last_updated: number;
};

export function getLastUpdated(conn: AsyncDuckDBConnection): Promise<LastUpdate[]> {
  return getData<LastUpdate>(
    conn,
    SQL`select extract('epoch' from seen)::int as last_updated from server order by last_updated desc limit 1`
  );
}