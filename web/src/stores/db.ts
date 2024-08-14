import { initDB } from '$lib/dbapi';
import { createDB } from '$lib/duckdb';
import { AsyncDuckDB } from '@duckdb/duckdb-wasm';
import { writable, get } from 'svelte/store';

export const dbStore = writable<null | AsyncDuckDB>(null);
export const initializedStore = writable(false);
export const progressStore = writable<number>(0);

export async function initializeDB() {
	let db;
	dbStore.subscribe((value) => {
		db = value;
	});

	if (db) {
		console.log('DB already initialized.');
		return db;
	}

	db = await createDB();
	await initDB(db, (loaded, total) => {
		const progress = Math.round((loaded / total) * 100);
		progressStore.set(progress); // Update progress in the store
		console.log(`Initialization Progress: ${progress}%`);
	});

	dbStore.set(db);
	initializedStore.set(true);
	return db;
}

export async function tearDownDB() {
	const db = get(dbStore);

	if (db) {
		await tearDownDB();
	}

	dbStore.set(null);
	initializedStore.set(false);
	progressStore.set(0);
}
