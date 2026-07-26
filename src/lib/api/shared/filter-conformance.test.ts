/**
 * Filter conformance harness.
 *
 * The same question — "does this server match this filter?" — is answered by
 * three independent implementations on three different substrates:
 *
 *   1. DuckDB SQL   `generateFilterQuery`  (browser: Analyze page, alert preview)
 *   2. SQLite SQL   `MATCH_ALERTS_SQL`     (D1: what actually fires alerts)
 *   3. TypeScript   `matchesQuery`         (MCP: search_auctions)
 *
 * They are kept in agreement by hand. They have drifted before and shipped
 * user-visible bugs — see docs/specs/alert-disk-matching-fix-2026-06.md, where
 * a 250-vs-500 GB multiplier split silently halved every NVMe alert threshold
 * for six months.
 *
 * This harness runs a cross-product of servers × filters through the matchers
 * and asserts they agree. Any disagreement not in KNOWN_DIVERGENCES fails; any
 * KNOWN_DIVERGENCE that stops reproducing also fails, so the list cannot go
 * stale. See docs/specs/filter-semantics-harmonization-2026-07.md.
 */

import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import path from "node:path";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { defaultFilter, type ServerFilter } from "$lib/filter";
import { generateFilterQuery } from "$lib/api/shared/filter-query";
import { MATCH_ALERTS_SQL } from "../../../../worker/src/alert-matching-sql";
import { buildServerFilter } from "$lib/server/mcp/filter";
import { matchesQuery, type AuctionQuery } from "$lib/server/mcp/search";
import type { SnapshotAuction } from "$lib/server/mcp/snapshot";

/* ------------------------------------------------------------------ fixtures */

interface ServerSpec {
  name: string;
  location: string;
  datacenter: string;
  cpu: string;
  cpu_vendor: string;
  cpu_count: number;
  cpu_cores: number | null;
  cpu_threads: number | null;
  ram_size: number;
  is_ecc: boolean;
  with_inic: boolean;
  with_hwr: boolean;
  with_gpu: boolean;
  with_rps: boolean;
  nvme: number[];
  sata: number[];
  hdd: number[];
}

function server(name: string, over: Partial<ServerSpec> = {}): ServerSpec {
  return {
    name,
    location: "Germany",
    datacenter: "FSN1-DC14",
    cpu: "Intel Xeon E5-1650V3",
    cpu_vendor: "Intel",
    cpu_count: 1,
    cpu_cores: 6,
    cpu_threads: 12,
    ram_size: 64,
    is_ecc: true,
    with_inic: false,
    with_hwr: false,
    with_gpu: false,
    with_rps: false,
    nvme: [],
    sata: [],
    hdd: [],
    ...over,
  };
}

const SERVERS: ServerSpec[] = [
  server("bare-intel"),
  server("bare-amd", {
    cpu_vendor: "AMD",
    cpu: "AMD Ryzen 9 3900",
    cpu_cores: 12,
    cpu_threads: 24,
  }),
  server("finland", { location: "Finland", datacenter: "HEL1-DC2" }),
  server("nbg", { datacenter: "NBG1-DC3" }),
  server("dual-cpu", { cpu_count: 2 }),
  server("no-ecc", { is_ecc: false }),
  server("big-ram", { ram_size: 1024 }),
  server("small-ram", { ram_size: 8 }),
  // CPU enrichment missing — the divergence-A probe.
  server("unknown-cpu", {
    cpu: "Intel Xeon Unlisted",
    cpu_cores: null,
    cpu_threads: null,
  }),
  server("many-cores", { cpu_cores: 130, cpu_threads: 260 }),
  // Disk shapes.
  server("nvme-2x1920", { nvme: [1920, 1920] }),
  server("nvme-2x4000", { nvme: [4000, 4000] }),
  server("nvme-mixed", { nvme: [512, 4000] }),
  server("sata-2x512", { sata: [512, 512] }),
  server("hdd-4x10000", { hdd: [10000, 10000, 10000, 10000] }),
  server("hdd-2x2000", { hdd: [2000, 2000] }),
  server("mixed-all", { nvme: [1920], sata: [512, 512], hdd: [4000, 4000] }),
  server("extras-all", {
    with_inic: true,
    with_hwr: true,
    with_gpu: true,
    with_rps: true,
  }),
  // Above the UI sliders' expressible ceiling (nvme 18×500=9000, hdd 44×500=22000).
  // Probes whether an open-ended MCP minimum survives encoding into ServerFilter.
  server("nvme-12tb", { nvme: [12000] }),
  server("hdd-30tb", { hdd: [30000] }),
];

function filter(
  name: string,
  over: Partial<ServerFilter>,
): [string, ServerFilter] {
  return [name, { ...defaultFilter, ...over }];
}

/**
 * `hddInternalSize` defaults to [4,44] (2000-22000 GB), which excludes
 * diskless servers under `total` mode. Most cases want a permissive baseline.
 */
const OPEN_DISKS: Partial<ServerFilter> = {
  hddInternalSize: [0, 44],
  ssdNvmeInternalSize: [0, 18],
  ssdSataInternalSize: [0, 14],
  ramInternalSize: [0, 20],
};

const FILTERS: [string, ServerFilter][] = [
  filter("default", {}),
  filter("open", OPEN_DISKS),
  // Location
  filter("germany-only", { ...OPEN_DISKS, locationFinland: false }),
  filter("finland-only", { ...OPEN_DISKS, locationGermany: false }),
  filter("no-location", {
    ...OPEN_DISKS,
    locationGermany: false,
    locationFinland: false,
  }),
  // CPU
  filter("intel-only", { ...OPEN_DISKS, cpuAMD: false }),
  filter("amd-only", { ...OPEN_DISKS, cpuIntel: false }),
  filter("dual-cpu", { ...OPEN_DISKS, cpuCount: 2 }),
  filter("cores-8-plus", { ...OPEN_DISKS, cpuCores: [8, 128] }),
  filter("cores-full-range", { ...OPEN_DISKS, cpuCores: [0, 128] }),
  filter("threads-16-plus", { ...OPEN_DISKS, cpuThreads: [16, 256] }),
  filter("cpu-model", {
    ...OPEN_DISKS,
    selectedCpuModels: ["Intel Xeon E5-1650V3"],
  }),
  // RAM (log2)
  filter("ram-64-plus", { ...OPEN_DISKS, ramInternalSize: [6, 20] }),
  filter("ram-upto-32", { ...OPEN_DISKS, ramInternalSize: [0, 5] }),
  // Datacenter
  filter("dc-exact", { ...OPEN_DISKS, selectedDatacenters: ["FSN1-DC14"] }),
  filter("dc-city-prefix", { ...OPEN_DISKS, selectedDatacenters: ["FSN"] }),
  filter("dc-mixed", {
    ...OPEN_DISKS,
    selectedDatacenters: ["HEL", "NBG1-DC3"],
  }),
  // Extras (tri-state)
  filter("ecc-required", { ...OPEN_DISKS, extrasECC: true }),
  filter("ecc-forbidden", { ...OPEN_DISKS, extrasECC: false }),
  filter("inic-required", { ...OPEN_DISKS, extrasINIC: true }),
  filter("gpu-required", { ...OPEN_DISKS, extrasGPU: true }),
  filter("rps-hwr-required", {
    ...OPEN_DISKS,
    extrasRPS: true,
    extrasHWR: true,
  }),
  // Disks — per-disk mode
  filter("nvme-per-disk-3.5tb", {
    ...OPEN_DISKS,
    ssdNvmeInternalSize: [7, 18],
    ssdNvmeSizeMode: "per-disk",
  }),
  filter("nvme-count-2", { ...OPEN_DISKS, ssdNvmeCount: [2, 2] }),
  // Disks — total mode (the report-#2 shape)
  filter("hdd-total-39tb", {
    ...OPEN_DISKS,
    hddInternalSize: [78, 660],
    hddSizeMode: "total",
  }),
  filter("nvme-total-4tb", {
    ...OPEN_DISKS,
    ssdNvmeInternalSize: [8, 18],
    ssdNvmeSizeMode: "total",
  }),
  // Disks — OR mode
  filter("or-nvme-or-hdd", {
    ...OPEN_DISKS,
    diskMode: "or",
    ssdNvmeCount: [1, 8],
    hddCount: [1, 15],
  }),
  filter("or-nothing-active", { ...OPEN_DISKS, diskMode: "or" }),
  filter("sata-count-2", { ...OPEN_DISKS, ssdSataCount: [2, 4] }),
];

/* ------------------------------------------------------- known divergences */

/**
 * Deliberate, documented disagreements between the DuckDB and SQLite matchers.
 *
 * Empty, and worth keeping that way. Each entry must reproduce: a divergence
 * that stops firing fails the suite, so a fix cannot leave a stale entry behind.
 * Add one only for a disagreement that is genuinely intended, with the reason —
 * anything else is drift and should be fixed instead.
 *
 * Divergences A (NULL cpu enrichment) and B (full-range gating) lived here until
 * the worker was aligned with generateFilterQuery. See
 * docs/specs/filter-semantics-harmonization-2026-07.md.
 */
const KNOWN_DIVERGENCES: {
  id: string;
  why: string;
  applies: (s: ServerSpec, f: ServerFilter) => boolean;
}[] = [];

function knownDivergence(s: ServerSpec, f: ServerFilter): string | null {
  return KNOWN_DIVERGENCES.find((d) => d.applies(s, f))?.id ?? null;
}

/* ------------------------------------------------------------ duckdb runner */

const require_ = createRequire(import.meta.url);
// package.json is not an exported subpath; resolve via the dist entry that is.
const DUCKDB_NODE_ENTRY = require_.resolve(
  "@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs",
);
const DUCKDB_DIST = path.dirname(DUCKDB_NODE_ENTRY);

interface DuckConn {
  query(sql: string): { toArray(): { toJSON(): Record<string, unknown> }[] };
  close(): void;
}

let duck: DuckConn;

/** Inlines `?` placeholders. generateFilterQuery only ever binds numbers and booleans. */
function inline(sql: string, values: unknown[]): string {
  let i = 0;
  return sql.replace(/\?/g, () => {
    const v = values[i++];
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "true" : "false";
    throw new Error(`unexpected bound value ${typeof v}: ${String(v)}`);
  });
}

const arr = (a: number[]) => `[${a.join(", ")}]`;
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

/** The slice of duckdb-wasm's Node build this harness uses. */
interface DuckDbNodeModule {
  createDuckDB(
    bundles: unknown,
    logger: unknown,
    runtime: unknown,
  ): Promise<{ instantiate(): Promise<void>; connect(): DuckConn }>;
  VoidLogger: new () => unknown;
  NODE_RUNTIME: unknown;
}

async function initDuck(): Promise<void> {
  const duckdb = require_(DUCKDB_NODE_ENTRY) as DuckDbNodeModule;
  const bundles = {
    mvp: {
      mainModule: path.join(DUCKDB_DIST, "duckdb-mvp.wasm"),
      mainWorker: null,
    },
    eh: {
      mainModule: path.join(DUCKDB_DIST, "duckdb-eh.wasm"),
      mainWorker: null,
    },
  };
  const db = await duckdb.createDuckDB(
    bundles,
    new duckdb.VoidLogger(),
    duckdb.NODE_RUNTIME,
  );
  await db.instantiate();
  duck = db.connect();

  duck.query(`
    CREATE TABLE server (
      name TEXT, location TEXT, datacenter TEXT,
      cpu TEXT, cpu_vendor TEXT, cpu_count INTEGER,
      cpu_cores INTEGER, cpu_threads INTEGER,
      ram_size INTEGER, is_ecc BOOLEAN,
      with_inic BOOLEAN, with_hwr BOOLEAN, with_gpu BOOLEAN, with_rps BOOLEAN,
      nvme_count INTEGER, nvme_size INTEGER, nvme_drives INTEGER[],
      sata_count INTEGER, sata_size INTEGER, sata_drives INTEGER[],
      hdd_count INTEGER, hdd_size INTEGER, hdd_drives INTEGER[]
    )`);

  for (const s of SERVERS) {
    duck.query(`INSERT INTO server VALUES (
      '${s.name}', '${s.location}', '${s.datacenter}',
      '${s.cpu}', '${s.cpu_vendor}', ${s.cpu_count},
      ${s.cpu_cores ?? "NULL"}, ${s.cpu_threads ?? "NULL"},
      ${s.ram_size}, ${s.is_ecc},
      ${s.with_inic}, ${s.with_hwr}, ${s.with_gpu}, ${s.with_rps},
      ${s.nvme.length}, ${sum(s.nvme)}, ${arr(s.nvme)},
      ${s.sata.length}, ${sum(s.sata)}, ${arr(s.sata)},
      ${s.hdd.length}, ${sum(s.hdd)}, ${arr(s.hdd)}
    )`);
  }
}

/** Names of the servers the DuckDB matcher accepts for this filter. */
function duckMatches(f: ServerFilter): Set<string> {
  // recentlySeen=false and hasServerTypeColumn=false: neither dimension exists
  // server-side (current_auctions has no server_type column and is current by
  // construction), so excluding them keeps the comparison apples-to-apples.
  const stmt = generateFilterQuery(f, true, true, false, false);
  const sql = `SELECT name FROM server WHERE ${inline(stmt.sql, stmt.values)}`;
  return new Set(
    duck
      .query(sql)
      .toArray()
      .map((r) => r.toJSON().name as string),
  );
}

/* ------------------------------------------------------------ sqlite runner */

let sqlite: DatabaseSync;

function initSqlite(): void {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE current_auctions (
      id INTEGER PRIMARY KEY, information TEXT,
      price REAL, location TEXT, datacenter TEXT,
      cpu TEXT, cpu_vendor TEXT, cpu_count INTEGER, cpu_cores INTEGER, cpu_threads INTEGER,
      ram_size INTEGER, is_ecc INTEGER,
      with_inic INTEGER, with_hwr INTEGER, with_gpu INTEGER, with_rps INTEGER,
      nvme_count INTEGER, nvme_size INTEGER, nvme_drives TEXT,
      sata_count INTEGER, sata_size INTEGER, sata_drives TEXT,
      hdd_count INTEGER, hdd_size INTEGER, hdd_drives TEXT,
      seen TEXT
    );
    CREATE TABLE price_alert (
      id INTEGER PRIMARY KEY, name TEXT, filter TEXT, price REAL, vat_rate REAL,
      user_id TEXT, includes_ipv4_cost INTEGER,
      email_notifications INTEGER, discord_notifications INTEGER,
      webhook_notifications INTEGER DEFAULT 0, created_at TEXT
    );
    CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT, discord_webhook_url TEXT, webhook_url TEXT);
    INSERT INTO user VALUES ('u1', 'u@example.com', NULL, NULL);
  `);

  const ins = sqlite.prepare(`INSERT INTO current_auctions (
    id, information, price, location, datacenter, cpu, cpu_vendor, cpu_count, cpu_cores, cpu_threads,
    ram_size, is_ecc, with_inic, with_hwr, with_gpu, with_rps,
    nvme_count, nvme_size, nvme_drives, sata_count, sata_size, sata_drives,
    hdd_count, hdd_size, hdd_drives, seen
  ) VALUES (?, '[]', 50, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-07-26T00:00:00Z')`);

  SERVERS.forEach((s, i) => {
    ins.run(
      i + 1,
      s.location,
      s.datacenter,
      s.cpu,
      s.cpu_vendor,
      s.cpu_count,
      s.cpu_cores,
      s.cpu_threads,
      s.ram_size,
      s.is_ecc ? 1 : 0,
      s.with_inic ? 1 : 0,
      s.with_hwr ? 1 : 0,
      s.with_gpu ? 1 : 0,
      s.with_rps ? 1 : 0,
      s.nvme.length,
      sum(s.nvme),
      JSON.stringify(s.nvme),
      s.sata.length,
      sum(s.sata),
      JSON.stringify(s.sata),
      s.hdd.length,
      sum(s.hdd),
      JSON.stringify(s.hdd),
    );
  });
}

/** Names of the servers the worker's alert SQL accepts for this filter. */
function sqliteMatches(f: ServerFilter): Set<string> {
  sqlite.exec("DELETE FROM price_alert");
  // price 99999 / vat 0 / no IPv4 surcharge: the price dimension never filters,
  // so only the ServerFilter predicates decide the outcome.
  sqlite
    .prepare(
      `INSERT INTO price_alert VALUES (1, 'conformance', ?, 99999, 0, 'u1', 0, 1, 0, 0, '2026-07-26T00:00:00Z')`,
    )
    .run(JSON.stringify(f));

  const rows = sqlite.prepare(MATCH_ALERTS_SQL).all() as {
    auction_id: number;
  }[];
  return new Set(rows.map((r) => SERVERS[r.auction_id - 1].name));
}

/* -------------------------------------------------------------------- suite */

// One DuckDB instance and one SQLite database for the whole file: both describe
// blocks share them, so tearing down per-describe would leave the second block
// querying a closed connection.
beforeAll(async () => {
  await initDuck();
  initSqlite();
}, 60_000);

afterAll(() => {
  duck?.close();
  sqlite?.close();
});

describe("filter conformance: DuckDB (frontend) vs SQLite (alert worker)", () => {
  it("agrees on every server × filter combination", () => {
    const unexpected: string[] = [];
    const reproduced = new Set<string>();

    for (const [fname, f] of FILTERS) {
      const d = duckMatches(f);
      const s = sqliteMatches(f);

      for (const srv of SERVERS) {
        const inDuck = d.has(srv.name);
        const inSqlite = s.has(srv.name);
        if (inDuck === inSqlite) continue;

        const known = knownDivergence(srv, f);
        if (known) {
          reproduced.add(known);
        } else {
          unexpected.push(
            `${fname} × ${srv.name}: duckdb=${inDuck} sqlite=${inSqlite}`,
          );
        }
      }
    }

    expect(unexpected).toEqual([]);

    // A divergence that no longer reproduces means it was fixed — delete the
    // entry (and the workaround it documents) rather than leaving it here.
    const stale = KNOWN_DIVERGENCES.filter((k) => !reproduced.has(k.id)).map(
      (k) => k.id,
    );
    expect(stale).toEqual([]);
  });

  it("covers a meaningful search space", () => {
    // Guards against the suite silently shrinking to triviality.
    expect(SERVERS.length * FILTERS.length).toBeGreaterThan(400);
  });
});

/* ------------------------------------------------------- MCP conformance */

/**
 * The MCP surface has its own input schema (`AuctionQuery`), so it cannot be
 * compared to the others directly. Instead we compare the two paths a single
 * user request can take:
 *
 *   search_auctions  → matchesQuery(auction, query)
 *   create_alert     → buildServerFilter(query) → the alert matcher
 *
 * A user who searches, likes the results, and turns that same query into an
 * alert must get alerts for the servers the search returned. Any disagreement
 * means the encoder and the matcher read the query differently — the bug class
 * fixed in 06caab2c (inverted filter ranges).
 *
 * Queries use only ALERT_QUERY_PROPERTIES keys. `SEARCH_ONLY_KEYS` (cpu,
 * min_drive_count, price, multicore score) are deliberately absent from the
 * create_alert schema because ServerFilter cannot express them, so comparing
 * them here would flag an intentional design decision as drift.
 */
const MCP_QUERIES: [string, AuctionQuery][] = [
  ["empty", {}],
  ["germany", { location: "Germany" }],
  ["finland", { location: "Finland" }],
  ["intel", { cpu_vendor: "Intel" }],
  ["amd", { cpu_vendor: "AMD" }],
  ["dual-cpu", { cpu_count: 2 }],
  ["cores-8-plus", { min_cpu_cores: 8 }],
  ["threads-16-plus", { min_cpu_threads: 16 }],
  ["cpu-models", { cpu_models: ["Intel Xeon E5-1650V3"] }],
  ["ram-64-plus", { min_ram_gb: 64 }],
  ["ram-max-32", { max_ram_gb: 32 }],
  ["dc-exact", { datacenters: ["FSN1-DC14"] }],
  ["dc-prefix", { datacenters: ["FSN"] }],
  ["dc-mixed", { datacenters: ["HEL", "NBG1-DC3"] }],
  ["ecc", { ecc: true }],
  ["no-ecc", { ecc: false }],
  ["inic", { inic: true }],
  ["gpu", { gpu: true }],
  ["rps-hwr", { rps: true, hwr: true }],
  ["nvme-count-2", { min_nvme_count: 2 }],
  [
    "nvme-per-disk-3500",
    { min_nvme_size_gb: 3500, nvme_size_mode: "per-disk" },
  ],
  ["nvme-total-4000", { min_nvme_size_gb: 4000, nvme_size_mode: "total" }],
  ["hdd-total-39000", { min_hdd_size_gb: 39000, hdd_size_mode: "total" }],
  ["sata-count-2", { min_sata_count: 2 }],
  ["or-nvme-or-hdd", { disk_mode: "or", min_nvme_count: 1, min_hdd_count: 1 }],
];

/** A SnapshotAuction shaped from a fixture, for the in-memory matcher. */
function toSnapshotAuction(s: ServerSpec, id: number): SnapshotAuction {
  return {
    id,
    datacenter: s.datacenter,
    location: s.location,
    cpu: s.cpu,
    cpu_vendor: s.cpu_vendor,
    cpu_count: s.cpu_count,
    cpu_cores: s.cpu_cores,
    cpu_threads: s.cpu_threads,
    cpu_generation: null,
    cpu_score: null,
    cpu_multicore_score: null,
    is_highio: false,
    ram_size: s.ram_size,
    is_ecc: s.is_ecc,
    nvme_count: s.nvme.length,
    nvme_drives: s.nvme,
    nvme_size: sum(s.nvme),
    sata_count: s.sata.length,
    sata_drives: s.sata,
    sata_size: sum(s.sata),
    hdd_count: s.hdd.length,
    hdd_drives: s.hdd,
    hdd_size: sum(s.hdd),
    with_inic: s.with_inic,
    with_hwr: s.with_hwr,
    with_gpu: s.with_gpu,
    with_rps: s.with_rps,
    traffic: "unlimited",
    bandwidth: 1000,
    information: [],
    seen: "2026-07-26T00:00:00Z",
    pricing: {
      currency: "EUR",
      monthly_net: 50,
      ipv4_monthly: 1.19,
      setup_net: 0,
      total_monthly_net: 51.19,
      vat_included: false,
      fixed_price: false,
      next_reduce_at: null,
    },
  };
}

describe("filter conformance: MCP search vs MCP alert encoding", () => {
  it("returns the same servers whether searched or encoded into an alert", () => {
    const mismatches: string[] = [];

    for (const [qname, query] of MCP_QUERIES) {
      const searched = new Set(
        SERVERS.filter((s, i) =>
          matchesQuery(toSnapshotAuction(s, i + 1), query),
        ).map((s) => s.name),
      );
      const alerted = duckMatches(buildServerFilter(query));

      for (const s of SERVERS) {
        const inSearch = searched.has(s.name);
        const inAlert = alerted.has(s.name);
        if (inSearch !== inAlert) {
          mismatches.push(
            `${qname} × ${s.name}: search=${inSearch} alert=${inAlert}`,
          );
        }
      }
    }

    expect(mismatches).toEqual([]);
  });
});
