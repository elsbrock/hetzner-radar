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
				xhr.getAllResponseHeaders()
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
					headers: headers,
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

async function getData(conn: AsyncDuckDBConnection, query: SQLStatement) {
	console.debug(query.sql, query.values);
	let stmt: AsyncPreparedStatement;
	try {
		const startTime = performance.now();

		stmt = await conn.prepare(query.sql);
		const arrowResult = await stmt.query(...query.values);
		const results = arrowResult.toArray().map((row: any) => row.toJSON());

		const endTime = performance.now();
		const timing = (endTime - startTime) / 1000;

		console.debug(`${results.length} results in ${timing.toFixed(4)}s`);
		return results;
	} catch (e) {
		console.error('error executing query', e);
	} finally {
		if (stmt) {
			stmt.close();
		}
	}
}

function generateFilterQuery(filter: any, withCPU: boolean, withDatacenters: boolean) {
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

async function getPrices(conn: AsyncDuckDBConnection, filter: any): Promise<any> {
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
	return getData(conn, prices_query);
}

async function getConfigurations(conn: AsyncDuckDBConnection, filter: any) {
	let configurations_filter_query = generateFilterQuery(filter, true, true);
	let configurations_query = SQL`
        select
			cpu, ram, ram_size, is_ecc,
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
            cpu, ram, ram_size, is_ecc, hdd_arr,
			nvme_size, nvme_drives, sata_size, sata_drives, hdd_size, hdd_drives,
			with_gpu, with_inic, with_hwr
        order by min(price)`);
	return getData(conn, configurations_query);
}

async function getDatacenters(conn: AsyncDuckDBConnection, filter: any): Promise<any> {
	let datacenter_filter_query = generateFilterQuery(filter, true, false);
	let datacenters_query =
		SQL`select distinct datacenter as name, datacenter as value from server where`
			.append(datacenter_filter_query)
			.append(SQL` order by datacenter`);
	return getData(conn, datacenters_query);
}

async function getCPUModels(conn: AsyncDuckDBConnection, filter: any): Promise<any> {
	let cpumodel_filter_query = generateFilterQuery(filter, false, true);
	let cpumodel_query = SQL`select distinct cpu as name, cpu as value from server where`
		.append(cpumodel_filter_query)
		.append(SQL` order by cpu`);
	return getData(conn, cpumodel_query);
}

async function getRamPriceStats(
	conn: AsyncDuckDBConnection,
	withECC?: boolean
): Promise<any> {
	const query = SQL`
		select
			x, min(price_per_gb) as y
		from (
			select
				(next_reduce_timestamp // (3600*24)) * (3600*24) as x,
				price / ram_size as price_per_gb
			from
				server`;
	if (withECC !== undefined) {
		query.append(SQL`
			where
				is_ecc = ${withECC}`);
	}
	query.append(SQL`
		) group by
			x
		order by
			x
	`);
	return getData(conn, query);
}

async function getDiskPriceStats(conn: AsyncDuckDBConnection, diskType: string): Promise<any> {
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
	return getData(conn, query as any);
}

async function getGPUPriceStats(conn: AsyncDuckDBConnection): Promise<any> {
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
	return getData(conn, query);
}

export {
	initDB,
	withDbConnections,
	getPrices,
	getConfigurations,
	getDatacenters,
	getCPUModels,
	getRamPriceStats,
	getDiskPriceStats,
	getGPUPriceStats
};
