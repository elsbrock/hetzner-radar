import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";

export interface ConsoleColumn {
  name: string;
  type: string;
}

export interface ConsoleResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  timingMs: number;
  truncated: boolean; // true when auto-LIMIT cap was hit
}

export interface TableSchema {
  name: string;
  columns: ConsoleColumn[];
}

/** Thrown when the read-only / single-statement guards reject a query. */
export class ConsoleQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsoleQueryError";
  }
}

const DEFAULT_ROW_LIMIT = 1000;

// Keywords whose statements we allow to run at all.
const ALLOWED_LEADING_KEYWORDS = new Set([
  "select",
  "with",
  "describe",
  "explain",
  "show",
  "summarize",
  "pivot",
  "from",
  "values",
  "table",
]);

// Subset of allowed keywords where appending a LIMIT is meaningful/valid.
const READ_LEADING_KEYWORDS = new Set([
  "select",
  "with",
  "from",
  "table",
  "values",
]);

/**
 * Remove SQL comments (`-- line` and block) so the guards can reliably find the
 * leading keyword and detect a `limit`. Kept deliberately simple — it does not
 * try to respect string literals containing comment-like sequences.
 */
export function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ") // block comments
    .replace(/--[^\n]*/g, " "); // line comments
}

/** Returns the lowercased leading SQL keyword, ignoring comments/whitespace. */
function leadingKeyword(sql: string): string {
  const match = stripComments(sql)
    .trim()
    .match(/^([a-z_]+)/i);
  return match ? match[1].toLowerCase() : "";
}

/**
 * Validate that `sql` is a single, read-only statement.
 * - Trims and strips a single trailing `;`.
 * - Throws if another `;` (followed by non-whitespace) remains.
 * - Throws if the leading keyword is not in the allowlist.
 * Returns the cleaned single-statement SQL (trailing `;` removed).
 */
export function validateSingleReadOnly(sql: string): string {
  let cleaned = sql.trim();

  // Strip a single trailing semicolon (plus any trailing whitespace).
  cleaned = cleaned.replace(/;\s*$/, "");

  // Any remaining semicolon followed by actual content => multiple statements.
  // Check against the comment-stripped form so a `;` inside a comment is ignored.
  if (/;\s*\S/.test(stripComments(cleaned))) {
    throw new ConsoleQueryError("Only one statement at a time is supported.");
  }

  const keyword = leadingKeyword(cleaned);
  if (!ALLOWED_LEADING_KEYWORDS.has(keyword)) {
    throw new ConsoleQueryError(
      "Only read-only queries are allowed (SELECT, WITH, DESCRIBE, …).",
    );
  }

  return cleaned;
}

/** True when the statement is a read whose result set a LIMIT can apply to. */
export function isReadStatement(sql: string): boolean {
  return READ_LEADING_KEYWORDS.has(leadingKeyword(sql));
}

/**
 * Append ` LIMIT {limit}` to read statements that don't already specify a limit.
 *
 * Heuristic limitation: the presence check is a plain `\blimit\b` (case-
 * insensitive) over the comment-stripped SQL, so a `limit` appearing anywhere —
 * e.g. as a column alias or inside a string literal — suppresses the auto-limit.
 * This is an accepted trade-off to avoid bundling a full SQL parser.
 */
export function applyAutoLimit(
  sql: string,
  limit: number,
): { sql: string; limited: boolean } {
  if (!isReadStatement(sql)) {
    return { sql, limited: false };
  }
  if (/\blimit\b/i.test(stripComments(sql))) {
    return { sql, limited: false };
  }
  return { sql: `${sql} LIMIT ${limit}`, limited: true };
}

/**
 * Recursively convert a DuckDB/Arrow cell value into something JSON- and
 * render-safe. DuckDB returns `BigInt` for UBIGINT/BIGINT (e.g. `id`) and
 * typed arrays / structs for array columns — these break `JSON.stringify` or
 * Svelte rendering unless normalized.
 */
export function normalizeValue(v: unknown): unknown {
  if (typeof v === "bigint") {
    return v.toString();
  }
  if (v instanceof Date) {
    return v.toISOString();
  }
  if (Array.isArray(v)) {
    return v.map(normalizeValue);
  }
  if (ArrayBuffer.isView(v) && !(v instanceof DataView)) {
    // Typed arrays (Int32Array, Float64Array, BigInt64Array, …).
    return Array.from(v as unknown as Iterable<unknown>).map(normalizeValue);
  }
  if (v !== null && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(v)) {
      out[key] = normalizeValue(value);
    }
    return out;
  }
  return v;
}

/**
 * Wrap a read query so complex result types render as plain values:
 * `DECIMAL`/`HUGEINT` → `DOUBLE` (otherwise Arrow returns Decimal128 limb-arrays
 * that surface as e.g. `[5438,0,0,0]`), and `TIMESTAMP`/`DATE`/`TIME` →
 * ISO-8601 strings (instead of raw epoch numbers). The original query runs as a
 * subquery, so all SQL (date math, etc.) still operates on the real types.
 *
 * Returns the wrapped SQL, or `null` when no coercion is needed or it can't be
 * done safely (no columns, or duplicate column names that would be ambiguous).
 * `columns` comes from `DESCRIBE <innerSql>`.
 */
export function buildCoercedQuery(
  innerSql: string,
  columns: { name: string; type: string }[],
): string | null {
  if (columns.length === 0) return null;
  const names = columns.map((c) => c.name);
  if (new Set(names).size !== names.length) return null;

  let changed = false;
  const projections = columns.map((c) => {
    const q = `"${c.name.replace(/"/g, '""')}"`;
    const type = c.type.toUpperCase();
    if (
      type.startsWith("DECIMAL") ||
      type === "HUGEINT" ||
      type === "UHUGEINT"
    ) {
      changed = true;
      return `CAST(${q} AS DOUBLE) AS ${q}`;
    }
    if (type.includes("TIMESTAMP")) {
      changed = true;
      return `strftime(CAST(${q} AS TIMESTAMP), '%Y-%m-%dT%H:%M:%S') AS ${q}`;
    }
    if (type === "DATE" || type.startsWith("TIME")) {
      changed = true;
      return `CAST(${q} AS VARCHAR) AS ${q}`;
    }
    return q;
  });

  if (!changed) return null;
  return `SELECT ${projections.join(", ")} FROM (${innerSql}) AS _console`;
}

/**
 * Run a raw, user-supplied SQL statement against the in-browser DuckDB.
 *
 * Pipeline: validate (single + read-only) → auto-LIMIT → open connection →
 * time + run query → normalize rows → close connection. `ConsoleQueryError`
 * (guard violations) and DuckDB execution errors propagate to the caller so the
 * UI can surface them.
 */
export async function runConsoleQuery(
  db: AsyncDuckDB,
  rawSql: string,
  opts?: { rowLimit?: number; viewSettings?: ViewSettings },
): Promise<ConsoleResult> {
  const rowLimit = opts?.rowLimit ?? DEFAULT_ROW_LIMIT;

  const validated = validateSingleReadOnly(rawSql);
  const { sql: safeSql, limited } = applyAutoLimit(validated, rowLimit);

  const conn = await db.connect();
  try {
    // Recreate the (connection-scoped, temporary) views so the user's query can
    // reference `available` / `server_history` on this connection.
    if (opts?.viewSettings) {
      await setupConsoleViews(conn, opts.viewSettings);
    }

    // Coerce complex result types to plain values for display. Only for
    // SELECT/WITH, where wrapping the query in a subquery is valid.
    let execSql = safeSql;
    if (["select", "with"].includes(leadingKeyword(validated))) {
      try {
        const described = await conn.query(`DESCRIBE ${safeSql}`);
        const cols = described.toArray().map((row) => {
          const r = row.toJSON() as {
            column_name: string;
            column_type: string;
          };
          return { name: String(r.column_name), type: String(r.column_type) };
        });
        const wrapped = buildCoercedQuery(safeSql, cols);
        if (wrapped) execSql = wrapped;
      } catch {
        // DESCRIBE failed — fall back to the original query.
      }
    }

    const start = performance.now();
    let result: Awaited<ReturnType<typeof conn.query>>;
    try {
      result = await conn.query(execSql);
    } catch (error) {
      // A bad coercion wrapper must never break an otherwise-valid query.
      if (execSql !== safeSql) {
        result = await conn.query(safeSql);
      } else {
        throw error;
      }
    }
    const timingMs = performance.now() - start;

    const columns = result.schema.fields.map((f) => f.name);
    const rows = result
      .toArray()
      .map((row) => normalizeValue(row.toJSON()) as Record<string, unknown>);

    const rowCount = rows.length;

    return {
      columns,
      rows,
      rowCount,
      timingMs,
      truncated: limited && rowCount === rowLimit,
    };
  } finally {
    await conn.close();
  }
}

/**
 * Settings that parameterize the denormalized views. The source `price` is net
 * EUR (whole euros); these turn it into the figures the rest of the app shows
 * (adding IPv4 cost, VAT, and the currency conversion).
 */
export interface ViewSettings {
  /** VAT as a decimal, e.g. 0.19 for Germany. */
  vatRate: number;
  /** Display currency code, e.g. "EUR" or "USD". */
  currency: string;
  /** EUR → display-currency multiplier, e.g. 1 for EUR, 1.1 for USD. */
  exchangeRate: number;
  /** Primary IPv4 monthly cost, in net EUR cents (e.g. 170). */
  ipv4CostCents: number;
}

const LINK_BASE_AUCTION =
  "https://www.hetzner.com/sb/?utm_source=server-radar&utm_medium=referral&utm_campaign=sql-console#search=";
const LINK_BASE_STANDARD =
  "https://www.hetzner.com/dedicated-rootserver?utm_source=server-radar&utm_medium=referral&utm_campaign=sql-console#search=";

/** Names of the views created by {@link setupConsoleViews}. */
export const CONSOLE_VIEWS = ["available", "server_history"] as const;

/**
 * Build the `CREATE OR REPLACE TEMPORARY VIEW` statements for the denormalized,
 * power-user-friendly views. Pure (no DB) so it can be unit-tested.
 *
 * The views are TEMPORARY because the WASM database is opened read-only (it's a
 * buffer-backed file), which rejects regular `CREATE VIEW`. Temporary views live
 * in the always-writable temp schema — but they're connection-scoped, so they
 * must be (re)created on the same connection that runs the query (see
 * {@link setupConsoleViews}, {@link runConsoleQuery}, {@link getSchema}).
 *
 * - `available` — one row per server in the latest snapshot (anchored to
 *   `max(seen) - 70 min`, same window the rest of the app uses for "currently
 *   available"), with a ready-to-open Hetzner `link`.
 * - `server_history` — every observation over the full retained history, for
 *   exploring prices over time (no `link`, since older rows aren't orderable).
 *
 * Both expose friendly column names and pricing in the user's currency:
 * `price_base` (net, list), `price_excl_vat` (incl. IPv4, excl. VAT), and
 * `price` (incl. IPv4 + VAT — the headline figure), plus `setup_fee`,
 * `currency` and `vat_rate`.
 */
export function buildViewStatements(s: ViewSettings): string[] {
  const vat = Number.isFinite(s.vatRate) ? s.vatRate : 0;
  const rate =
    Number.isFinite(s.exchangeRate) && s.exchangeRate > 0 ? s.exchangeRate : 1;
  const ip = (Number.isFinite(s.ipv4CostCents) ? s.ipv4CostCents : 0) / 100;
  const currency =
    (s.currency || "EUR").replace(/[^A-Za-z]/g, "").toUpperCase() || "EUR";
  const vatMul = 1 + vat;

  // Price expressions, all in the selected display currency. `price` and
  // `setup_price` are stored in whole EUR; IPv4 cost is in cents, hence `ip`.
  // Cast to DOUBLE so the columns are plain numbers (not DECIMAL128) in results
  // and the schema browser.
  const priceBase = `ROUND(price * ${rate}, 2)::DOUBLE`;
  const priceExclVat = `ROUND((price + ${ip}) * ${rate}, 2)::DOUBLE`;
  const priceGross = `ROUND((price + ${ip}) * ${vatMul} * ${rate}, 2)::DOUBLE`;
  const setupFee = `ROUND(COALESCE(setup_price, 0) * ${vatMul} * ${rate}, 2)::DOUBLE`;

  const linkExpr = `CASE WHEN server_type = 'standard'
        THEN '${LINK_BASE_STANDARD}' || COALESCE(information[1], '')
        ELSE '${LINK_BASE_AUCTION}' || id::VARCHAR
      END`;

  const columns = (withLink: boolean) => `
      id,
      server_type AS type,
      COALESCE(information[1], '') AS name,
      cpu,
      cpu_vendor AS vendor,
      cpu_cores AS cores,
      cpu_threads AS threads,
      cpu_score,
      cpu_multicore_score,
      ram_size AS ram_gb,
      is_ecc AS ecc,
      nvme_count,
      nvme_size AS nvme_gb,
      sata_count,
      sata_size AS sata_gb,
      hdd_count,
      hdd_size AS hdd_gb,
      (COALESCE(nvme_size, 0) + COALESCE(sata_size, 0) + COALESCE(hdd_size, 0)) AS disk_gb,
      with_gpu AS gpu,
      with_inic AS inic,
      with_hwr AS hwr,
      with_rps AS rps,
      datacenter,
      location,
      bandwidth,
      traffic,
      ${priceBase} AS price_base,
      ${priceExclVat} AS price_excl_vat,
      ${priceGross} AS price,
      ${setupFee} AS setup_fee,
      '${currency}' AS currency,
      ${vat} AS vat_rate,${withLink ? `\n      ${linkExpr} AS link,` : ""}
      seen`;

  const available = `CREATE OR REPLACE TEMPORARY VIEW available AS
    SELECT${columns(true)}
    FROM server
    WHERE seen > (SELECT max(seen) FROM server) - INTERVAL '70 minutes'
    QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY seen DESC) = 1`;

  const history = `CREATE OR REPLACE TEMPORARY VIEW server_history AS
    SELECT${columns(false)}
    FROM server`;

  return [available, history];
}

/**
 * (Re)create the denormalized console views on a given connection from the
 * current user settings. App-issued DDL — deliberately bypasses the read-only
 * guard. Views are temporary and connection-scoped, so this must run on the same
 * connection that will query them. Individual view failures are logged but not
 * fatal, so the console still works on the raw `server` table (and any view that
 * did succeed).
 */
export async function setupConsoleViews(
  conn: AsyncDuckDBConnection,
  settings: ViewSettings,
): Promise<void> {
  const statements = buildViewStatements(settings);
  for (const statement of statements) {
    try {
      await conn.query(statement);
    } catch (error) {
      console.warn("Failed to create SQL console view:", error);
    }
  }
}

/**
 * List the tables/views in the database and their columns/types via
 * `SHOW TABLES` + `DESCRIBE`. The denormalized views (`available`,
 * `server_history`) are pinned first, then the raw `server` table, then the
 * rest alphabetically.
 */
export async function getSchema(
  db: AsyncDuckDB,
  viewSettings?: ViewSettings,
): Promise<TableSchema[]> {
  const conn = await db.connect();
  try {
    // Create the temporary views first so they show up in the schema browser
    // and autocomplete (they're scoped to this connection).
    if (viewSettings) {
      await setupConsoleViews(conn, viewSettings);
    }

    const tablesResult = await conn.query("SHOW TABLES");
    const names = new Set<string>(
      tablesResult
        .toArray()
        .map((row) => String((row.toJSON() as { name: string }).name)),
    );
    // Always probe the console views (SHOW TABLES may omit temp views).
    for (const view of CONSOLE_VIEWS) names.add(view);

    const schemas: TableSchema[] = [];
    for (const name of names) {
      try {
        const describeResult = await conn.query(`DESCRIBE "${name}"`);
        const columns: ConsoleColumn[] = describeResult.toArray().map((row) => {
          const r = row.toJSON() as {
            column_name: string;
            column_type: string;
          };
          return { name: String(r.column_name), type: String(r.column_type) };
        });
        schemas.push({ name, columns });
      } catch {
        // Table/view unavailable (e.g. view creation failed) — skip it.
      }
    }

    const priority = ["available", "server_history", "server"];
    schemas.sort((a, b) => {
      const ia = priority.indexOf(a.name);
      const ib = priority.indexOf(b.name);
      if (ia !== -1 || ib !== -1) {
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      }
      return a.name.localeCompare(b.name);
    });

    return schemas;
  } finally {
    await conn.close();
  }
}
