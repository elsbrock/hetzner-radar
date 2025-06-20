import * as duckdb from '@duckdb/duckdb-wasm';

let worker: Worker | null = null;
let db: duckdb.AsyncDuckDB | null = null;

export async function createDB() {
	if (db) {
		return db;
	}

	if (typeof window !== 'undefined') {
		const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

		// Select a bundle based on browser checks
		const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

		const worker_url = URL.createObjectURL(
			new Blob([`importScripts("${bundle.mainWorker!}");`], {
				type: 'text/javascript'
			})
		);

		// Instantiate the asynchronus version of DuckDB-wasm
		worker = new Worker(worker_url);
		const logger = new duckdb.ConsoleLogger();

		// Instantiate the asynchronus version of DuckDB-Wasm
		db = new duckdb.AsyncDuckDB(logger, worker);
		await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
		URL.revokeObjectURL(worker_url);
	}
	return db;
}

export async function tearDownDB() {
	if (db) {
		await db.terminate();
		db = null;
	}

	if (worker) {
		worker.terminate();
	}
}
