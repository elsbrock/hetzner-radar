import type { AsyncDuckDB } from "@duckdb/duckdb-wasm";
import { writable, get } from "svelte/store";

export const db = writable<null | AsyncDuckDB>();
export const dbInitProgress = writable<number>(0);

let initPromise: Promise<typeof db> | null = null;

// DuckDB (the JS library and the WASM bundle) is loaded dynamically so pages
// that never query it don't carry it in their bundle. Multiple callers share
// one in-flight initialization.
export function initializeDB() {
  if (!initPromise) {
    initPromise = doInitializeDB().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

async function doInitializeDB() {
  if (get(db)) {
    return db;
  }

  const [{ createDB }, { initDB }] = await Promise.all([
    import("$lib/duckdb"),
    import("$lib/api/frontend/dbapi"),
  ]);

  const idb = await createDB();
  if (idb) {
    await initDB(idb, (loaded, total) => {
      const progress = Math.round((loaded / total) * 100);
      dbInitProgress.set(progress);
    });
  }

  db.set(idb);
  return db;
}

export async function tearDownDB() {
  const idb = get(db);

  if (idb) {
    const { tearDownDB: terminateDB } = await import("$lib/duckdb");
    await terminateDB();
  }

  initPromise = null;
  db.set(null);
  dbInitProgress.set(0);
}
