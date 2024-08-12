import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
    mvp: {
        mainModule: duckdb_wasm,
        mainWorker: mvp_worker,
    },
    eh: {
        mainModule: duckdb_wasm_eh,
        mainWorker: eh_worker,
    },
};

import type { AsyncDuckDB } from '@duckdb/duckdb-wasm';

let db: AsyncDuckDB | null = null;
let worker: Worker | null = null;

export async function createDB() {
	if (db) {
		return db;
	}

	// // Select a bundle based on browser checks
    // const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);

    // const worker_url = URL.createObjectURL(
    //     new Blob([`importScripts("${bundle.mainWorker!}");`], {
    //         type: 'text/javascript',
    //     })
    // );
	const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
	const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
	const worker_url = URL.createObjectURL(
	  new Blob([`importScripts("${bundle.mainWorker!}");`], {
		type: "text/javascript",
	  })
	);

    // Instantiate the asynchronus version of DuckDB-Wasm
    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(worker_url);

	return db;
}

export async function tearDownDB() {
	if (db) {
		await db.terminate();
		db = null;
	}

	if (worker) {
		worker.terminate();
		worker = null;
	}
}
