import { initDB } from '$lib/dbapi';
import { createDB } from '$lib/duckdb';
import { AsyncDuckDB } from '@duckdb/duckdb-wasm';
import { writable, get } from 'svelte/store';

export const db = writable<null | AsyncDuckDB>();
export const dbInitProgress = writable<number>(0);

export async function initializeDB() {
	let idb;
	db.subscribe((value) => {
		idb = value;
	});

	if (idb) {
		return db;
	}

	idb = await createDB();
	await initDB(idb, (loaded, total) => {
		const progress = Math.round((loaded / total) * 100);
		dbInitProgress.set(progress);
		console.log(`Initialization Progress: ${progress}%`);
	});

	db.set(idb);
	return db;
}

export async function tearDownDB() {
	const idb = get(db);

	if (idb) {
		await tearDownDB();
	}

	db.set(null);
	dbInitProgress.set(0);
}
