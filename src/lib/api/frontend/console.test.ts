import { describe, it, expect } from "vitest";
import {
  validateSingleReadOnly,
  applyAutoLimit,
  normalizeValue,
  isReadStatement,
  buildViewStatements,
  buildCoercedQuery,
  CONSOLE_VIEWS,
  ConsoleQueryError,
} from "./console";

describe("validateSingleReadOnly", () => {
  it("accepts SELECT", () => {
    expect(validateSingleReadOnly("SELECT 1")).toBe("SELECT 1");
  });

  it("accepts WITH", () => {
    const sql = "WITH t AS (SELECT 1) SELECT * FROM t";
    expect(validateSingleReadOnly(sql)).toBe(sql);
  });

  it("accepts DESCRIBE", () => {
    expect(validateSingleReadOnly("DESCRIBE server")).toBe("DESCRIBE server");
  });

  it("accepts EXPLAIN, SHOW, SUMMARIZE, PIVOT, FROM, VALUES, TABLE", () => {
    expect(() => validateSingleReadOnly("EXPLAIN SELECT 1")).not.toThrow();
    expect(() => validateSingleReadOnly("SHOW TABLES")).not.toThrow();
    expect(() => validateSingleReadOnly("SUMMARIZE server")).not.toThrow();
    expect(() => validateSingleReadOnly("PIVOT server ON x")).not.toThrow();
    expect(() => validateSingleReadOnly("FROM server")).not.toThrow();
    expect(() => validateSingleReadOnly("VALUES (1), (2)")).not.toThrow();
    expect(() => validateSingleReadOnly("TABLE server")).not.toThrow();
  });

  it("is case-insensitive on the leading keyword", () => {
    expect(validateSingleReadOnly("select 1")).toBe("select 1");
    expect(validateSingleReadOnly("sElEcT 1")).toBe("sElEcT 1");
  });

  it("strips a single trailing semicolon", () => {
    expect(validateSingleReadOnly("SELECT 1;")).toBe("SELECT 1");
    expect(validateSingleReadOnly("SELECT 1;  ")).toBe("SELECT 1");
  });

  it("tolerates leading comments and whitespace", () => {
    expect(validateSingleReadOnly("  -- a comment\n  SELECT 1")).toBe(
      "-- a comment\n  SELECT 1",
    );
    expect(validateSingleReadOnly("/* block */ SELECT 1")).toBe(
      "/* block */ SELECT 1",
    );
  });

  it("rejects write/DDL statements", () => {
    for (const sql of [
      "INSERT INTO server VALUES (1)",
      "UPDATE server SET id = 1",
      "DELETE FROM server",
      "DROP TABLE server",
      "CREATE TABLE x (a INT)",
      "ATTACH 'foo.db'",
      "PRAGMA database_list",
    ]) {
      expect(() => validateSingleReadOnly(sql)).toThrow(ConsoleQueryError);
    }
  });

  it("uses the friendly read-only message", () => {
    expect(() => validateSingleReadOnly("DROP TABLE server")).toThrow(
      "Only read-only queries are allowed (SELECT, WITH, DESCRIBE, …).",
    );
  });

  it("rejects two statements", () => {
    expect(() => validateSingleReadOnly("SELECT 1; SELECT 2")).toThrow(
      ConsoleQueryError,
    );
    expect(() => validateSingleReadOnly("SELECT 1; SELECT 2")).toThrow(
      "Only one statement at a time is supported.",
    );
  });

  it("allows a semicolon inside a comment", () => {
    expect(() =>
      validateSingleReadOnly("SELECT 1 -- ; not a statement"),
    ).not.toThrow();
  });
});

describe("isReadStatement", () => {
  it("is true for read leading keywords", () => {
    expect(isReadStatement("SELECT 1")).toBe(true);
    expect(isReadStatement("WITH t AS (SELECT 1) SELECT * FROM t")).toBe(true);
    expect(isReadStatement("FROM server")).toBe(true);
    expect(isReadStatement("TABLE server")).toBe(true);
    expect(isReadStatement("VALUES (1)")).toBe(true);
  });

  it("is false for describe/show/explain/etc", () => {
    expect(isReadStatement("DESCRIBE server")).toBe(false);
    expect(isReadStatement("SHOW TABLES")).toBe(false);
    expect(isReadStatement("EXPLAIN SELECT 1")).toBe(false);
  });
});

describe("applyAutoLimit", () => {
  it("appends LIMIT when absent on a read statement", () => {
    expect(applyAutoLimit("SELECT * FROM server", 1000)).toEqual({
      sql: "SELECT * FROM server LIMIT 1000",
      limited: true,
    });
  });

  it("leaves the SQL alone when a LIMIT is already present", () => {
    expect(applyAutoLimit("SELECT * FROM server LIMIT 10", 1000)).toEqual({
      sql: "SELECT * FROM server LIMIT 10",
      limited: false,
    });
  });

  it("is case-insensitive on the existing limit keyword", () => {
    expect(applyAutoLimit("select * from server limit 10", 1000)).toEqual({
      sql: "select * from server limit 10",
      limited: false,
    });
  });

  it("does not append for non-read statements", () => {
    expect(applyAutoLimit("DESCRIBE server", 1000)).toEqual({
      sql: "DESCRIBE server",
      limited: false,
    });
    expect(applyAutoLimit("SHOW TABLES", 1000)).toEqual({
      sql: "SHOW TABLES",
      limited: false,
    });
  });
});

describe("normalizeValue", () => {
  it("converts BigInt to string", () => {
    expect(normalizeValue(123n)).toBe("123");
  });

  it("converts a nested array of BigInt", () => {
    expect(normalizeValue([1n, [2n, 3n]])).toEqual(["1", ["2", "3"]]);
  });

  it("converts Date to ISO string", () => {
    const d = new Date("2026-06-17T00:00:00.000Z");
    expect(normalizeValue(d)).toBe("2026-06-17T00:00:00.000Z");
  });

  it("recurses into plain objects", () => {
    expect(normalizeValue({ id: 1n, name: "x", nested: { v: 2n } })).toEqual({
      id: "1",
      name: "x",
      nested: { v: "2" },
    });
  });

  it("passes primitives through unchanged", () => {
    expect(normalizeValue("foo")).toBe("foo");
    expect(normalizeValue(42)).toBe(42);
    expect(normalizeValue(null)).toBe(null);
    expect(normalizeValue(true)).toBe(true);
  });

  it("normalizes typed arrays", () => {
    expect(normalizeValue(new Int32Array([1, 2, 3]))).toEqual([1, 2, 3]);
    expect(normalizeValue(new BigInt64Array([1n, 2n]))).toEqual(["1", "2"]);
  });
});

describe("buildViewStatements", () => {
  const de = {
    vatRate: 0.19,
    currency: "EUR",
    exchangeRate: 1,
    ipv4CostCents: 170,
  };

  it("creates the available and server_history views", () => {
    const [available, history] = buildViewStatements(de);
    expect(available).toContain(
      "CREATE OR REPLACE TEMPORARY VIEW available AS",
    );
    expect(history).toContain(
      "CREATE OR REPLACE TEMPORARY VIEW server_history AS",
    );
    expect(CONSOLE_VIEWS).toEqual(["available", "server_history"]);
  });

  it("anchors `available` to the latest snapshot and dedupes by id", () => {
    const [available] = buildViewStatements(de);
    expect(available).toContain(
      "seen > (SELECT max(seen) FROM server) - INTERVAL '70 minutes'",
    );
    expect(available).toContain(
      "QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY seen DESC) = 1",
    );
  });

  it("bakes IPv4 cost, VAT and exchange rate into the price columns", () => {
    const [available] = buildViewStatements({
      vatRate: 0.19,
      currency: "USD",
      exchangeRate: 1.1,
      ipv4CostCents: 170,
    });
    // base = list price only; excl_vat adds IPv4; price adds IPv4 + VAT.
    // Cast to DOUBLE so results aren't Decimal128 limb-arrays.
    expect(available).toContain("ROUND(price * 1.1, 2)::DOUBLE AS price_base");
    expect(available).toContain(
      "ROUND((price + 1.7) * 1.1, 2)::DOUBLE AS price_excl_vat",
    );
    expect(available).toContain(
      "ROUND((price + 1.7) * 1.19 * 1.1, 2)::DOUBLE AS price",
    );
    expect(available).toContain("'USD' AS currency");
    expect(available).toContain("0.19 AS vat_rate");
  });

  it("includes an order link only in `available`", () => {
    const [available, history] = buildViewStatements(de);
    expect(available).toContain("AS link");
    expect(available).toContain("hetzner.com/sb/");
    expect(available).toContain("hetzner.com/dedicated-rootserver");
    expect(history).not.toContain("AS link");
  });

  it("treats a zero VAT / net config as pass-through multipliers", () => {
    const [available] = buildViewStatements({
      vatRate: 0,
      currency: "EUR",
      exchangeRate: 1,
      ipv4CostCents: 0,
    });
    expect(available).toContain(
      "ROUND((price + 0) * 1 * 1, 2)::DOUBLE AS price",
    );
  });

  it("produces views the read-only guard accepts querying", () => {
    expect(() =>
      validateSingleReadOnly("SELECT * FROM available"),
    ).not.toThrow();
    expect(() =>
      validateSingleReadOnly("SELECT * FROM server_history"),
    ).not.toThrow();
  });
});

describe("buildCoercedQuery", () => {
  it("casts DECIMAL and HUGEINT columns to DOUBLE", () => {
    const out = buildCoercedQuery("SELECT 1", [
      { name: "cheapest", type: "DECIMAL(18,2)" },
      { name: "total", type: "HUGEINT" },
    ]);
    expect(out).toContain('CAST("cheapest" AS DOUBLE) AS "cheapest"');
    expect(out).toContain('CAST("total" AS DOUBLE) AS "total"');
    expect(out).toContain("FROM (SELECT 1) AS _console");
  });

  it("formats TIMESTAMP columns as ISO-8601 and DATE as VARCHAR", () => {
    const out = buildCoercedQuery("SELECT 1", [
      { name: "seen", type: "TIMESTAMP" },
      { name: "day", type: "DATE" },
    ]);
    expect(out).toContain(
      `strftime(CAST("seen" AS TIMESTAMP), '%Y-%m-%dT%H:%M:%S') AS "seen"`,
    );
    expect(out).toContain('CAST("day" AS VARCHAR) AS "day"');
  });

  it("returns null when nothing needs coercion", () => {
    expect(
      buildCoercedQuery("SELECT 1", [
        { name: "cpu", type: "VARCHAR" },
        { name: "ram_gb", type: "INTEGER" },
      ]),
    ).toBeNull();
  });

  it("returns null for empty or duplicate column names (unsafe to wrap)", () => {
    expect(buildCoercedQuery("SELECT 1", [])).toBeNull();
    expect(
      buildCoercedQuery("SELECT 1", [
        { name: "x", type: "DECIMAL(10,2)" },
        { name: "x", type: "DECIMAL(10,2)" },
      ]),
    ).toBeNull();
  });

  it("escapes embedded double-quotes in column names", () => {
    const out = buildCoercedQuery("SELECT 1", [
      { name: 'we"ird', type: "DECIMAL(10,2)" },
    ]);
    expect(out).toContain('CAST("we""ird" AS DOUBLE) AS "we""ird"');
  });
});
