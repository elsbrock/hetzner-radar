import type {
	AsyncDuckDB,
	AsyncDuckDBConnection,
	AsyncPreparedStatement
} from '@duckdb/duckdb-wasm';
import SQL, { type SQLStatement } from 'sql-template-strings';

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

async function initDB(db: AsyncDuckDB, progress?: ProgressFn) {
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
	let stmt: null|AsyncPreparedStatement = null;
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

	ramInternalSize: [number, number];

	ssdNvmeCount: [number, number];
	ssdNvmeInternalSize: [number, number];

	ssdSataCount: [number, number];
	ssdSataInternalSize: [number, number];

	hddCount: [number, number];
	hddInternalSize: [number, number];

	selectedDatacenters: string[];
	selectedCpuModels: string[];

	extrasECC: boolean | null;
	extrasINIC: boolean | null;
	extrasHWR: boolean | null;
	extrasGPU: boolean | null;
	extrasRPS: boolean | null;
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

	return query;
}

type LastUpdate = {
	last_updated: number;
}

function getLastUpdated(conn: AsyncDuckDBConnection): Promise<LastUpdate[]> {
	return getData<LastUpdate>(conn, SQL`select extract('epoch' from seen)::int as last_updated from server order by last_updated desc limit 1`);
}

/*
 * Server Price and Configurations
 */

type ServerPriceStat = {
	min_price: number;
	max_price: number;
	count: number;
	mean_price: number;
	seen: number;
};

async function getPrices(conn: AsyncDuckDBConnection, filter: ServerFilter): Promise<ServerPriceStat[]> {
	let prices_filter_query = generateFilterQuery(filter, true, true);
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

type ServerConfiguration = {
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
			with_gpu, with_inic, with_hwr, with_rps,
			min(price) as min_price,
			count(*) as count,
			extract('epoch' from max(seen)) as last_seen
        from
        	server
        where`;
	configurations_query.append(configurations_filter_query).append(SQL`
		group by
            cpu, ram_size, is_ecc, hdd_arr,
			nvme_size, nvme_drives, sata_size, sata_drives, hdd_size, hdd_drives,
			with_gpu, with_inic, with_hwr, with_rps
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
						with_gpu, with_inic, with_hwr, with_rps,
						max(seen) as last_seen
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
	return getData<ServerDetail>(conn, query);
}

async function getServerDetailPrices(conn: AsyncDuckDBConnection, config: ServerConfiguration): Promise<ServerPriceStat[]> {
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
			AND hdd_arr::json = ${config.hdd_arr}
			AND coalesce(nvme_size, 0) = coalesce(${config.nvme_size}, 0)
			AND coalesce(sata_size, 0) = coalesce(${config.sata_size}, 0)
			AND coalesce(hdd_size, 0) = coalesce(${config.hdd_size}, 0)
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
				seen
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
				AND with_rps = ${config.with_rps}
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

async function getRamPriceStats(conn: AsyncDuckDBConnection, withECC?: boolean, country?: string): Promise<TemporalStat[]> {
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

async function getGPUPriceStats(conn: AsyncDuckDBConnection): Promise<TemporalStat[]> {
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

async function getCPUVendorPriceStats(conn: AsyncDuckDBConnection, vendor: string, country?: string): Promise<TemporalStat[]> {
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

async function getVolumeStats(conn: AsyncDuckDBConnection, country?: string): Promise<TemporalStat[]> {
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

	export {
		initDB,
		withDbConnections,

		getPrices,
		getConfigurations,

		getLastUpdated,

		getServerDetails,
		getServerDetailPrices,
		getLowestServerDetailPrices,

		getDatacenters,
		getCPUModels,

		getRamPriceStats,
		getDiskPriceStats,
		getGPUPriceStats,
		getCPUVendorPriceStats,
		getVolumeStats,

		type LastUpdate,
		type NameValuePair,
		type TemporalStat,
		type ServerConfiguration,
		type ServerLowestPriceStat,
		type ServerPriceStat,
		type ServerFilter,
		type ServerDetail,
	};
