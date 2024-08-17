import type {
	AsyncDuckDB,
	AsyncDuckDBConnection,
	AsyncPreparedStatement
} from '@duckdb/duckdb-wasm';
import SQL, { SQLStatement } from 'sql-template-strings';

async function fetchWithProgress(
	url: string,
	onProgress: (loaded: number, total: number) => void = (loaded, total) => {
		if (total) {
			console.log(`Progress: ${((loaded / total) * 100).toFixed(2)}%`);
		} else {
			console.log(`Progress: ${loaded} bytes loaded`);
		}
	}
): Promise<Response> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();

		xhr.open('GET', url, true);
		xhr.responseType = 'arraybuffer';

		xhr.onprogress = function (event) {
			onProgress(event.loaded, event.total);
		};

		xhr.onload = function () {
			if (xhr.status >= 200 && xhr.status < 300) {
				const headers = new Headers();
				xhr
					.getAllResponseHeaders()
					.trim()
					.split(/[\r\n]+/)
					.forEach((line) => {
						const parts = line.split(': ');
						const header = parts.shift();
						const value = parts.join(': ');
						if (header) headers.append(header, value);
					});

				const response = new Response(xhr.response, {
					status: xhr.status,
					statusText: xhr.statusText,
					headers: headers
				});
				resolve(response);
			} else {
				reject(new Error(`HTTP error! status: ${xhr.status}`));
			}
		};

		xhr.onerror = function () {
			reject(new Error('Network error'));
		};

		xhr.send();
	});
}

type ProgressFn = (loaded: number, total: number) => void;

async function initDB(db: AsyncDuckDB, progress: undefined | ProgressFn) {
	const { hostname, port, protocol } = window.location;
	const url = `${protocol}//${hostname}:${port}/sb.duckdb.wasm`;
	const res = await fetchWithProgress(url, progress);
	const buffer = await res.arrayBuffer();
	await db.registerFileBuffer('sb.duckdb', new Uint8Array(buffer));
	await db.open({
		path: 'sb.duckdb'
	});
}

async function withDbConnections(
	db: AsyncDuckDB,
	callback: (...connections: AsyncDuckDBConnection[]) => Promise<void>
) {
	const maxConnections = callback.length; // Determines how many connections are needed based on the number of parameters in the callback
	const connections = await Promise.all(
		Array(maxConnections)
			.fill()
			.map(() => db.connect())
	);

	try {
		// Spread the connections array as arguments to the callback function
		await callback(...connections);
	} catch (error) {
		console.error('Error during database operations:', error);
	} finally {
		// Ensure all connections are closed
		await Promise.all(connections.map((conn) => conn.close()));
	}
}

function getRawQuery(query: SQLStatement): string {
	let index = 0;
	const sqlWithValues = query.sql.replace(/\?/g, () => {
		const value = query.values[index++];
		if (typeof value === 'string') {
			return `'${value.replace(/'/g, "''")}'`; // Escaping single quotes in strings
		} else if (value === null) {
			return 'NULL';
		} else {
			return value;
		}
	});
	return sqlWithValues;
}

async function getData<T>(conn: AsyncDuckDBConnection, query: SQLStatement): Promise<T[]> {
	console.debug(getRawQuery(query));
	let stmt: AsyncPreparedStatement;
	let results: T[] = [];
	try {
		const startTime = performance.now();

		stmt = await conn.prepare(query.sql);
		const arrowResult = await stmt.query(...query.values);
		results = arrowResult.toArray().map((row: any) => row.toJSON());

		const endTime = performance.now();
		const timing = (endTime - startTime) / 1000;

		console.debug(`${results.length} results in ${timing.toFixed(4)}s`);
	} catch (e) {
		console.error('error executing query', e);
	} finally {
		stmt?.close();
	}
	return results;
}

type ServerFilter = {
	locationGermany: boolean;
	locationFinland: boolean;

	cpuCount: number;
	cpuIntel: boolean;
	cpuAMD: boolean;

	ramInternalSizeLower: number;
	ramInternalSizeUpper: number;

	ssdNvmeCountLower: number;
	ssdNvmeCountUpper: number;
	ssdNvmeInternalSizeLower: number;
	ssdNvmeInternalSizeUpper: number;

	ssdSataCountLower: number;
	ssdSataCountUpper: number;
	ssdSataInternalSizeLower: number;
	ssdSataInternalSizeUpper: number;

	hddCountLower: number;
	hddCountUpper: number;
	hddInternalSizeLower: number;
	hddInternalSizeUpper: number;

	selectedDatacenters: string[];
	selectedCpuModels: string[];

	extrasECC: boolean | null;
	extrasINIC: boolean | null;
	extrasHWR: boolean | null;
	extrasGPU: boolean | null;
};

function generateFilterQuery(
	filter: ServerFilter,
	withCPU: boolean,
	withDatacenters: boolean
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

	query.append(SQL` and ram_size >= ${Math.pow(2, filter.ramInternalSizeLower)}`);
	query.append(SQL` and ram_size <= ${Math.pow(2, filter.ramInternalSizeUpper)}`);

	// disk data
	query.append(SQL` and nvme_count >= ${filter.ssdNvmeCountLower}`);
	query.append(SQL` and nvme_count <= ${filter.ssdNvmeCountUpper}`);
	query.append(SQL` and sata_count >= ${filter.ssdSataCountLower}`);
	query.append(SQL` and sata_count <= ${filter.ssdSataCountUpper}`);
	query.append(SQL` and hdd_count >= ${filter.hddCountLower}`);
	query.append(SQL` and hdd_count <= ${filter.hddCountUpper}`);
	query.append(
		SQL` and array_length(array_filter(nvme_drives, x -> x >= ${Math.pow(2, filter.ssdNvmeInternalSizeLower)} AND x <= ${Math.pow(2, filter.ssdNvmeInternalSizeUpper)})) = array_length(nvme_drives)`
	);
	query.append(
		SQL` and array_length(array_filter(sata_drives, x -> x >= ${Math.pow(2, filter.ssdSataInternalSizeLower)} AND x <= ${Math.pow(2, filter.ssdSataInternalSizeUpper)})) = array_length(sata_drives)`
	);
	query.append(
		SQL` and array_length(array_filter(hdd_drives, x -> x >= ${Math.pow(2, filter.hddInternalSizeLower)} AND x <= ${Math.pow(2, filter.hddInternalSizeUpper)})) = array_length(hdd_drives)`
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

	return query;
}

/*
 * Server Price and Configurations
 */

type ServerPriceStat = {
	min_price: number;
	max_price: number;
	count: number;
	mean_price: number;
	next_reduce_timestamp: number;
};

async function getPrices(conn: AsyncDuckDBConnection, filter: ServerFilter): Promise<ServerPriceStat[]> {
	let prices_filter_query = generateFilterQuery(filter, true, true);
	let prices_query = SQL`
        select
			min(price) as min_price,
			max(price) as max_price,
			count(distinct id)::int as count,
			round(mean(price))::int as mean_price,
			(next_reduce_timestamp // (3600*24)) * (3600*24) as next_reduce_timestamp
        from
        	server
        where`;
	prices_query.append(prices_filter_query)
		.append(SQL` group by (next_reduce_timestamp // (3600*24)) * (3600*24)
            order by next_reduce_timestamp`);
	return getData<ServerPriceStat>(conn, prices_query);
}

type ServerConfiguration = {
	with_hwr: any;
	with_gpu: any;
	with_inic: any;
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
};

async function getConfigurations(
	conn: AsyncDuckDBConnection,
	filter: ServerFilter
): Promise<ServerConfiguration[]> {
	let configurations_filter_query = generateFilterQuery(filter, true, true);
	let configurations_query = SQL`
        select
			cpu, ram_size, is_ecc,
			hdd_arr::JSON as hdd_arr,
			nvme_size,
			nvme_drives::JSON as nvme_drives,
			sata_size,
			sata_drives::JSON as sata_drives,
			hdd_size,
			hdd_drives::JSON as sata_drives,
			with_gpu, with_inic, with_hwr,
			min(price) as min_price,
			count(*) as count,
			max(next_reduce_timestamp) as last_seen
        from
        	server
        where`;
	configurations_query.append(configurations_filter_query).append(SQL`
		group by
            cpu, ram_size, is_ecc, hdd_arr,
			nvme_size, nvme_drives, sata_size, sata_drives, hdd_size, hdd_drives,
			with_gpu, with_inic, with_hwr
        order by min(price)`);
	return getData<ServerConfiguration>(conn, configurations_query);
}

type ServerDetail = {
	information: string;
	last_seen: number;
};

async function getServerDetails(conn: AsyncDuckDBConnection, config: ServerConfiguration): Promise<ServerDetail[]> {
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
						with_gpu, with_inic, with_hwr,
						max(next_reduce_timestamp) as last_seen
				FROM
					server
				WHERE
					cpu = ${config.cpu}
					AND ram_size = ${config.ram_size}
					AND is_ecc = ${config.is_ecc}
					AND hdd_arr::json = ${config.hdd_arr}
					AND coalesce(nvme_size, 0) = coalesce(${config.nvme_size}, 0)
					AND coalesce(sata_size, 0) = coalesce(${config.sata_size}, 0)
					AND coalesce(hdd_size, 0) = coalesce(${config.hdd_size}, 0)
					AND with_gpu = ${config.with_gpu}
					AND with_inic = ${config.with_inic}
					AND with_hwr = ${config.with_hwr}
				GROUP BY
					information, cpu, ram, ram_size, is_ecc,
					hdd_arr,
					nvme_size,
					nvme_drives,
					sata_size,
					sata_drives,
					hdd_size,
					hdd_drives,
					with_gpu, with_inic, with_hwr
			)
	`;
	return getData<ServerDetail>(conn, query);
}

async function getServerDetailPrices(conn: AsyncDuckDBConnection, config: ServerConfiguration): Promise<ServerPriceStat[]> {
	const query = SQL`
		SELECT
			min(price) as min_price,
			max(price) as max_price,
			count(distinct id)::int as count,
			round(mean(price))::int as mean_price,
			(next_reduce_timestamp // (3600*24)) * (3600*24) as next_reduce_timestamp
		FROM
			server
		WHERE
			cpu = ${config.cpu}
			AND ram_size = ${config.ram_size}
			AND is_ecc = ${config.is_ecc}
			AND hdd_arr::json = ${config.hdd_arr}
			AND coalesce(nvme_size, 0) = coalesce(${config.nvme_size}, 0)
			AND coalesce(sata_size, 0) = coalesce(${config.sata_size}, 0)
			AND coalesce(hdd_size, 0) = coalesce(${config.hdd_size}, 0)
			AND with_gpu = ${config.with_gpu}
			AND with_inic = ${config.with_inic}
			AND with_hwr = ${config.with_hwr}
		GROUP BY
			(next_reduce_timestamp // (3600*24)) * (3600*24)
        ORDER BY
			next_reduce_timestamp
	`;
	return getData<ServerPriceStat>(conn, query);
}

type ServerLowestPriceStat = {
	id: number;
	seen: number;
	price: number;
};

async function getLowestServerDetailPrices(conn: AsyncDuckDBConnection, config: ServerConfiguration): Promise<ServerLowestPriceStat[]> {
	const query = SQL`
		  WITH price_data AS (
			SELECT 
				price,
				to_timestamp(next_reduce_timestamp)::timestamp as seen
			FROM server
			WHERE
				cpu = ${config.cpu}
				AND ram_size = ${config.ram_size}
				AND is_ecc = ${config.is_ecc}
				AND hdd_arr::json = ${config.hdd_arr}
				AND coalesce(nvme_size, 0) = coalesce(${config.nvme_size}, 0)
				AND coalesce(sata_size, 0) = coalesce(${config.sata_size}, 0)
				AND coalesce(hdd_size, 0) = coalesce(${config.hdd_size}, 0)
				AND with_gpu = ${config.with_gpu}
				AND with_inic = ${config.with_inic}
				AND with_hwr = ${config.with_hwr}
			ORDER BY seen
		),
		
		moving_averages AS (
			SELECT 
				seen,
				price,
				AVG(price) OVER (ORDER BY seen RANGE BETWEEN INTERVAL '3 days' PRECEDING AND CURRENT ROW) AS short_term_avg,
				AVG(price) OVER (ORDER BY seen RANGE BETWEEN INTERVAL '14 days' PRECEDING AND CURRENT ROW) AS long_term_avg
			FROM price_data
		),
		
		interesting_points AS (
			SELECT 
				seen,
				price,
				short_term_avg,
				long_term_avg,
				LAG(price) OVER (ORDER BY seen) AS prev_price,
				LAG(short_term_avg) OVER (ORDER BY seen) AS prev_short_term_avg,
				LAG(long_term_avg) OVER (ORDER BY seen) AS prev_long_term_avg
			FROM moving_averages
		),
		
		filtered_interesting_points AS (
			SELECT
				seen,
				price,
				ROW_NUMBER() OVER (ORDER BY seen) AS rn,
				LAG(seen) OVER (ORDER BY seen) AS prev_seen
			FROM interesting_points
			WHERE 
				(price > short_term_avg AND prev_price < prev_short_term_avg) OR  -- Price rises above short-term average
				(price < short_term_avg AND prev_price > prev_short_term_avg) OR  -- Price drops below short-term average
				(short_term_avg > long_term_avg AND prev_short_term_avg <= prev_long_term_avg) OR  -- Short-term MA crosses above long-term MA
				(short_term_avg < long_term_avg AND prev_short_term_avg >= prev_long_term_avg)  -- Short-term MA crosses below long-term MA
		),
		
		distinct_dates AS (
			SELECT 
				epoch(seen) as seen,
				price,
				rn
			FROM filtered_interesting_points
			WHERE prev_seen IS NULL OR seen >= prev_seen + INTERVAL '7 days'
		)
		
		SELECT seen, price
		FROM distinct_dates
		ORDER BY seen
		LIMIT 5;		
	`;
	return getData<ServerLowestPriceStat>(conn, query);
}

/*
 * Statistics
 */

type NameValuePair = {
	name: string;
	value: string;
};

async function getDatacenters(conn: AsyncDuckDBConnection, filter: ServerFilter): Promise<NameValuePair[]> {
	let datacenter_filter_query = generateFilterQuery(filter, true, false);
	let datacenters_query =
		SQL`select distinct datacenter as name, datacenter as value from server where`
			.append(datacenter_filter_query)
			.append(SQL` order by datacenter`);
	return getData<NameValuePair>(conn, datacenters_query);
}

async function getCPUModels(conn: AsyncDuckDBConnection, filter: ServerFilter): Promise<NameValuePair[]> {
	let cpumodel_filter_query = generateFilterQuery(filter, false, true);
	let cpumodel_query = SQL`select distinct cpu as name, cpu as value from server where`
		.append(cpumodel_filter_query)
		.append(SQL` order by cpu`);
	return getData<NameValuePair>(conn, cpumodel_query);
}

type TemporalStat = {
	x: number;
	y: number;
};

async function getRamPriceStats(conn: AsyncDuckDBConnection): Promise<TemporalStat[]> {
	const query = SQL`
		select
			x, min(price_per_gb) as y
		from (
			select
				(next_reduce_timestamp // (3600*24)) * (3600*24) as x,
				price / ram_size as price_per_gb
			from
				server
		)
		group by
			x
		order by
			x
	`;
	return getData<TemporalStat>(conn, query);
}

async function getDiskPriceStats(
	conn: AsyncDuckDBConnection,
	diskType: string
): Promise<TemporalStat[]> {
	const query = {
		sql: `
			select
				x, min(price_per_tb) as y
			from (
				select
					(next_reduce_timestamp // (3600*24)) * (3600*24) as x,
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

async function getGPUPriceStats(conn: AsyncDuckDBConnection): Promise<TemporalStat[]> {
	const query = SQL`
		select
			x, min(price) as y
		from (
			select
				(next_reduce_timestamp // (3600*24)) * (3600*24) as x,
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

export type {
	ServerFilter,
	ServerPriceStat,
	ServerConfiguration,
	ServerDetail,
	NameValuePair,
	TemporalStat,
	ServerLowestPriceStat,
};

export {
	initDB,
	withDbConnections,
	
	getPrices,
	getConfigurations,

	getServerDetails,
	getServerDetailPrices,
	getLowestServerDetailPrices,

	getDatacenters,
	getCPUModels,
	
	getRamPriceStats,
	getDiskPriceStats,
	getGPUPriceStats
};
