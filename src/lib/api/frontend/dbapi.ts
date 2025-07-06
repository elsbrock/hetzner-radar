import type {
  AsyncDuckDB,
  AsyncDuckDBConnection,
  AsyncPreparedStatement,
} from "@duckdb/duckdb-wasm";
import { type SQLStatement } from "sql-template-strings";

async function fetchWithProgress(
  url: string,
  onProgress: (loaded: number, total: number) => void = (loaded, total) => {
    if (total) {
      console.log(`Progress: ${((loaded / total) * 100).toFixed(2)}%`);
    } else {
      console.log(`Progress: ${loaded} bytes loaded`);
    }
  },
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";

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
            const parts = line.split(": ");
            const header = parts.shift();
            const value = parts.join(": ");
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
      reject(new Error("Network error"));
    };

    xhr.send();
  });
}

type ProgressFn = (loaded: number, total: number) => void;

async function initDB(db: AsyncDuckDB, progress?: ProgressFn) {
  const { hostname, port, protocol } = window.location;
  // const url = `${protocol}//${hostname}:${port}/sb.duckdb.wasm`;
  const url = `https://static.radar.iodev.org/sb.duckdb?cb=${Math.random()}*100}`;
  const res = await fetchWithProgress(url, progress);
  const buffer = await res.arrayBuffer();
  await db.registerFileBuffer("sb.duckdb", new Uint8Array(buffer));
  await db.open({
    path: "sb.duckdb",
  });
}

async function reloadDB(db: AsyncDuckDB) {
  db.dropFiles();
  return initDB(db);
}

async function withDbConnections(
  db: AsyncDuckDB,
  callback: (...connections: AsyncDuckDBConnection[]) => Promise<void>,
) {
  const maxConnections = callback.length; // Determines how many connections are needed based on the number of parameters in the callback
  const connections = await Promise.all(
    Array(maxConnections)
      .fill(null)
      .map(() => db.connect()),
  );

  try {
    // Spread the connections array as arguments to the callback function
    await callback(...connections);
  } catch (error) {
    console.error("Error during database operations:", error);
  } finally {
    // Ensure all connections are closed
    await Promise.all(connections.map((conn) => conn.close()));
  }
}

function getRawQuery(query: SQLStatement): string {
  let index = 0;
  const sqlWithValues = query.sql.replace(/\?/g, () => {
    const value = query.values[index++];
    if (typeof value === "string") {
      return `'${value.replace(/'/g, "''")}'`; // Escaping single quotes in strings
    } else if (value === null) {
      return "NULL";
    } else {
      return value;
    }
  });
  return sqlWithValues;
}

async function getData<T>(
  conn: AsyncDuckDBConnection,
  query: SQLStatement,
): Promise<T[]> {
  console.debug(getRawQuery(query));
  let stmt: null | AsyncPreparedStatement = null;
  let results: T[] = [];
  try {
    const startTime = performance.now();

    stmt = await conn.prepare(query.sql);
    const arrowResult = await stmt.query(...query.values);
    results = arrowResult.toArray().map((row: unknown) => row.toJSON());

    const endTime = performance.now();
    const timing = (endTime - startTime) / 1000;

    console.debug(`${results.length} results in ${timing.toFixed(4)}s`);
  } catch {
    console.error("error executing query", getRawQuery(query), e);
  } finally {
    stmt?.close();
  }
  return results;
}

export { getData, initDB, reloadDB, withDbConnections };
