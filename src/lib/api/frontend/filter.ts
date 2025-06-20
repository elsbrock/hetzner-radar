/*
 * Server Price and Configurations
 */

import { getData } from '$lib/api/frontend/dbapi';
import { HETZNER_IPV4_COST_CENTS } from '$lib/constants';
import type { ServerFilter } from '$lib/filter';
import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import SQL, { SQLStatement } from 'sql-template-strings';

export function generateFilterQuery(
	filter: ServerFilter,
	withCPU: boolean,
	withDatacenters: boolean,
	recentlySeen: boolean = true
): SQLStatement {
	let query = SQL` cpu_count >= ${filter.cpuCount} and (`;

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
		console.log(filter.selectedDatacenters);
		query
			.append(SQL` and datacenter in (`)
			.append(filter.selectedDatacenters.map((d) => `'${d}'`).join(', '))
			.append(SQL` )`);
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
			.append(filter.selectedCpuModels.map((d) => `'${d}'`).join(', '))
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
	query.append(
		SQL` and array_length(array_filter(nvme_drives, x -> x >= ${filter.ssdNvmeInternalSize[0] * 250} AND x <= ${filter.ssdNvmeInternalSize[1] * 250})) = array_length(nvme_drives)`
	);
	query.append(
		SQL` and array_length(array_filter(sata_drives, x -> x >= ${filter.ssdSataInternalSize[0] * 250} AND x <= ${filter.ssdSataInternalSize[1] * 250})) = array_length(sata_drives)`
	);
	query.append(
		SQL` and array_length(array_filter(hdd_drives, x -> x >= ${filter.hddInternalSize[0] * 500} AND x <= ${filter.hddInternalSize[1] * 500})) = array_length(hdd_drives)`
	);

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
		query.append(SQL` and seen > (now()::timestamp - interval '70 minute')::timestamp`);
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
	filter: ServerFilter
): Promise<ServerPriceStat[]> {
	let prices_filter_query = generateFilterQuery(filter, true, true, false);
	let prices_query = SQL`
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
};

export async function getConfigurations(
	conn: AsyncDuckDBConnection,
	filter: ServerFilter
): Promise<ServerConfiguration[]> {
	let configurations_filter_query = generateFilterQuery(filter, true, true, false);
	let configurations_query = SQL`
    SELECT
        * exclude(last_seen),
        extract('epoch' from last_seen) as last_seen
    FROM (
        SELECT
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
        WHERE `;
	configurations_query.append(configurations_filter_query);
	configurations_query.append(`
        GROUP BY
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
			SQL` where last_seen > (now()::timestamp - interval '70 minute')::timestamp`
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
		return d;
	});
}
