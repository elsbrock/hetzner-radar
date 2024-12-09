/*
 * Server Price and Configurations
 */

import { getData } from "$lib/api/frontend/dbapi";
import type { ServerFilter } from "$lib/filter";
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import SQL, { SQLStatement } from "sql-template-strings";

export function generateFilterQuery(
    filter: ServerFilter,
    withCPU: boolean,
    withDatacenters: boolean,
    recentlySeen: boolean = true,
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
            .append(filter.selectedDatacenters.map((d) => `'${d}'`).join(", "))
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
            .append(filter.selectedCpuModels.map((d) => `'${d}'`).join(", "))
            .append(SQL` )`);
    }

    // RAM settings
    if (filter.extrasECC !== null) {
        query.append(SQL` and is_ecc = ${filter.extrasECC}`);
    }

    query.append(
        SQL` and ram_size >= ${Math.pow(2, filter.ramInternalSize[0])}`,
    );
    query.append(
        SQL` and ram_size <= ${Math.pow(2, filter.ramInternalSize[1])}`,
    );

    // disk data
    query.append(SQL` and nvme_count >= ${filter.ssdNvmeCount[0]}`);
    query.append(SQL` and nvme_count <= ${filter.ssdNvmeCount[1]}`);
    query.append(SQL` and sata_count >= ${filter.ssdSataCount[0]}`);
    query.append(SQL` and sata_count <= ${filter.ssdSataCount[1]}`);
    query.append(SQL` and hdd_count >= ${filter.hddCount[0]}`);
    query.append(SQL` and hdd_count <= ${filter.hddCount[1]}`);
    query.append(
        SQL` and array_length(array_filter(nvme_drives, x -> x >= ${filter.ssdNvmeInternalSize[0] * 250} AND x <= ${filter.ssdNvmeInternalSize[1] * 250})) = array_length(nvme_drives)`,
    );
    query.append(
        SQL` and array_length(array_filter(sata_drives, x -> x >= ${filter.ssdSataInternalSize[0] * 250} AND x <= ${filter.ssdSataInternalSize[1] * 250})) = array_length(sata_drives)`,
    );
    query.append(
        SQL` and array_length(array_filter(hdd_drives, x -> x >= ${filter.hddInternalSize[0] * 500} AND x <= ${filter.hddInternalSize[1] * 500})) = array_length(hdd_drives)`,
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
    let prices_filter_query = generateFilterQuery(filter, true, true, false);
    let prices_query = SQL`
        select
			min(price) as min_price,
			max(price) as max_price,
			count(distinct id)::int as count,
			round(mean(price))::int as mean_price,
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
    filter: ServerFilter,
): Promise<ServerConfiguration[]> {
    let configurations_filter_query = generateFilterQuery(filter, true, true);
    let configurations_query = SQL`
		WITH subquery AS (
			SELECT
				cpu, ram_size, is_ecc, hdd_arr,
				nvme_size, nvme_drives, nvme_count,
				sata_size, sata_drives, sata_count,
				hdd_size, hdd_drives, hdd_count,
				with_gpu, with_inic, with_hwr, with_rps,
				price,
				seen,
				FIRST_VALUE(price) OVER (PARTITION BY cpu, ram_size, is_ecc, hdd_arr,
												nvme_size, nvme_drives,
												sata_size, sata_drives,
												hdd_size, hdd_drives,
												with_gpu, with_inic, with_hwr, with_rps
										ORDER BY seen DESC) AS last_price,
				MAX(seen) OVER (PARTITION BY cpu, ram_size, is_ecc, hdd_arr,
										nvme_size, nvme_drives,
										sata_size, sata_drives,
										hdd_size, hdd_drives,
										with_gpu, with_inic, with_hwr, with_rps
							) AS last_seen,
				MIN(price) OVER (PARTITION BY cpu, ram_size, is_ecc, hdd_arr,
										nvme_size, nvme_drives,
										sata_size, sata_drives,
										hdd_size, hdd_drives,
										with_gpu, with_inic, with_hwr, with_rps
				) AS min_price
			FROM
				server
      WHERE `;
    configurations_query.append(configurations_filter_query);
    configurations_query.append(`
		)
		SELECT
			cpu,
			ram_size, is_ecc, hdd_arr::JSON as hdd_arr,
			nvme_size, nvme_drives::JSON as nvme_drives,
			sata_size, sata_drives::JSON as sata_drives,
			hdd_size, hdd_drives::JSON as hdd_drives,
			with_gpu, with_inic, with_hwr, with_rps,
			MAX(min_price) as min_price,
			MAX(last_price) AS price,
			extract('epoch' from MAX(last_seen)) AS last_seen,
			-- calculate the markup percentage
			round((MAX(last_price) - MAX(min_price)) / MAX(min_price) * 100, 0) AS markup_percentage
		FROM
			subquery
		GROUP BY
			cpu, ram_size, is_ecc, hdd_arr,
			nvme_size, nvme_drives,
			sata_size, sata_drives,
			hdd_size, hdd_drives,
			with_gpu, with_inic, with_hwr, with_rps
		ORDER BY
			price ASC
        LIMIT 101`); // if we get more than 100 results, we limit on the ui

    const data = await getData<ServerConfiguration>(conn, configurations_query);
    return data.map((d: ServerConfiguration) => {
        d.hdd_arr = JSON.parse(d.hdd_arr as unknown as string);
        d.nvme_drives = JSON.parse(d.nvme_drives as unknown as string);
        d.sata_drives = JSON.parse(d.sata_drives as unknown as string);
        d.hdd_drives = JSON.parse(d.hdd_drives as unknown as string);
        return d;
    });
}

export type ServerDetail = {
    information: string;
    last_seen: number;
};

export async function getServerDetails(
    conn: AsyncDuckDBConnection,
    config: ServerConfiguration,
): Promise<ServerDetail[]> {
    const query = SQL`
		SELECT
			distinct
			information::json as information,
			last_seen
		FROM
			(
				select distinct
						information, cpu, ram, ram_size, is_ecc,
						hdd_arr,
						nvme_size,
						nvme_drives,
						sata_size,
						sata_drives,
						hdd_size,
						hdd_drives,
						with_gpu, with_inic, with_hwr, with_rps,
						max(seen) as last_seen
				FROM
					server
				WHERE
					cpu = ${config.cpu}
					AND ram_size = ${config.ram_size}
					AND is_ecc = ${config.is_ecc}
					AND hdd_arr::json = ${JSON.stringify(config.hdd_arr)}
					AND coalesce(nvme_size, 0) = coalesce(${config.nvme_size ?? 0}, 0)
					AND coalesce(sata_size, 0) = coalesce(${config.sata_size ?? 0}, 0)
					AND coalesce(hdd_size, 0) = coalesce(${config.hdd_size ?? 0}, 0)
					AND with_gpu = ${config.with_gpu}
					AND with_inic = ${config.with_inic}
					AND with_hwr = ${config.with_hwr}
					AND with_rps = ${config.with_rps}
				GROUP BY
					information, cpu, ram, ram_size, is_ecc,
					hdd_arr,
					nvme_size,
					nvme_drives,
					sata_size,
					sata_drives,
					hdd_size,
					hdd_drives,
					with_gpu, with_inic, with_hwr, with_rps
			)
	`;
    const data = await getData<ServerDetail>(conn, query);
    return data.map((d: ServerDetail) => {
        d.information = JSON.parse(d.information as unknown as string);
        return d;
    });
}

export async function getServerDetailPrices(
    conn: AsyncDuckDBConnection,
    config: ServerConfiguration,
): Promise<ServerPriceStat[]> {
    const query = SQL`
		SELECT
			min(price) as min_price,
			max(price) as max_price,
			count(distinct id)::int as count,
			round(mean(price))::int as mean_price,
			EXTRACT(epoch FROM date_trunc('d', seen))::int as seen
		FROM
			server
		WHERE
			cpu = ${config.cpu}
			AND ram_size = ${config.ram_size}
			AND is_ecc = ${config.is_ecc}
			AND hdd_arr::json = ${JSON.stringify(config.hdd_arr)}
			AND coalesce(nvme_size, 0) = coalesce(${config.nvme_size ?? 0}, 0)
			AND coalesce(sata_size, 0) = coalesce(${config.sata_size ?? 0}, 0)
			AND coalesce(hdd_size, 0) = coalesce(${config.hdd_size ?? 0}, 0)
			AND with_gpu = ${config.with_gpu}
			AND with_inic = ${config.with_inic}
			AND with_hwr = ${config.with_hwr}
			AND with_rps = ${config.with_rps}
		GROUP BY
			EXTRACT(epoch FROM date_trunc('d', seen))::int
        ORDER BY
			EXTRACT(epoch FROM date_trunc('d', seen))::int
	`;
    return getData<ServerPriceStat>(conn, query);
}
