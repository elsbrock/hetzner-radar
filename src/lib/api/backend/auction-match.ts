/**
 * Request parsing and query construction for `POST /api/auctions`.
 *
 * Lives outside the route because SvelteKit restricts `+server.ts` exports to
 * HTTP verbs, and these need to be importable by `auction-match.test.ts` without
 * a D1 binding — the same reason `api/shared/filter-query.ts` and
 * `worker/src/alert-matching-sql.ts` were extracted from their callers.
 */

import { CITY_PREFIXES } from "@server-radar/filter-spec/constants";

export interface MatchRequest {
  cpu: string;
  ram_size: number;
  is_ecc: boolean;
  nvme_drives: number[];
  sata_drives: number[];
  hdd_drives: number[];
  with_inic: boolean | null;
  with_gpu: boolean | null;
  with_hwr: boolean | null;
  with_rps: boolean | null;
  // Optional filters
  locationGermany?: boolean;
  locationFinland?: boolean;
  selectedDatacenters?: string[];
}

/**
 * Most datacenters a single request may name.
 *
 * Every entry becomes a bound parameter, and D1 caps the number of parameters
 * per statement. Hetzner lists a few dozen datacenters, so this is far above any
 * legitimate request while keeping the statement well inside that limit.
 */
const MAX_DATACENTERS = 64;

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/** Absent or non-boolean means "no opinion", matching the `boolean | null` type. */
function asFlag(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/**
 * Validates the request body at runtime.
 *
 * This used to be a bare `as MatchRequest` cast. Nothing downstream re-checked
 * it, so `selectedDatacenters` reached the query builder as arbitrary strings —
 * and that builder interpolated them into SQL rather than binding them. The
 * interpolation is fixed below; this function makes the shape a fact rather than
 * an assumption, and turns a malformed body into a 400 instead of a 500 thrown
 * from the spread on `nvme_drives`.
 */
export function parseMatchRequest(raw: unknown): MatchRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.cpu !== "string" || r.cpu.length === 0) return null;
  if (typeof r.ram_size !== "number" || !Number.isFinite(r.ram_size))
    return null;
  if (typeof r.is_ecc !== "boolean") return null;
  if (!isNumberArray(r.nvme_drives)) return null;
  if (!isNumberArray(r.sata_drives)) return null;
  if (!isNumberArray(r.hdd_drives)) return null;

  let selectedDatacenters: string[] | undefined;
  if (r.selectedDatacenters !== undefined) {
    if (
      !Array.isArray(r.selectedDatacenters) ||
      !r.selectedDatacenters.every((d) => typeof d === "string") ||
      r.selectedDatacenters.length > MAX_DATACENTERS
    ) {
      return null;
    }
    selectedDatacenters = r.selectedDatacenters as string[];
  }

  return {
    cpu: r.cpu,
    ram_size: r.ram_size,
    is_ecc: r.is_ecc,
    nvme_drives: r.nvme_drives,
    sata_drives: r.sata_drives,
    hdd_drives: r.hdd_drives,
    with_inic: asFlag(r.with_inic),
    with_gpu: asFlag(r.with_gpu),
    with_hwr: asFlag(r.with_hwr),
    with_rps: asFlag(r.with_rps),
    // `undefined` means "include", so only an explicit `false` narrows.
    locationGermany:
      typeof r.locationGermany === "boolean" ? r.locationGermany : undefined,
    locationFinland:
      typeof r.locationFinland === "boolean" ? r.locationFinland : undefined,
    selectedDatacenters,
  };
}

/**
 * Builds the exact-configuration lookup against `current_auctions`.
 *
 * Exported so `+server.test.ts` can assert the emitted SQL and its parameters
 * without a D1 binding — the same reason `filter-query.ts` and
 * `alert-matching-sql.ts` were extracted from their callers.
 *
 * Note this is a *lookup*, not a filter: hardware identity is matched exactly
 * (drive arrays compared as JSON strings), which is why it is not one of the
 * range matchers the conformance harness covers. The location, extras and
 * datacenter clauses are narrowing filters layered on top.
 */
export function buildAuctionMatchQuery(body: MatchRequest): {
  query: string;
  params: (string | number | boolean)[];
} {
  // Sort drives for comparison
  const sortedNvme = [...body.nvme_drives].sort((a, b) => a - b);
  const sortedSata = [...body.sata_drives].sort((a, b) => a - b);
  const sortedHdd = [...body.hdd_drives].sort((a, b) => a - b);

  let query = `
      SELECT id, price, seen, datacenter, location
      FROM current_auctions
      WHERE cpu = ?
        AND ram_size = ?
        AND is_ecc = ?
        AND nvme_count = ?
        AND sata_count = ?
        AND hdd_count = ?
    `;

  const params: (string | number | boolean)[] = [
    body.cpu,
    body.ram_size,
    body.is_ecc ? 1 : 0,
    body.nvme_drives.length,
    body.sata_drives.length,
    body.hdd_drives.length,
  ];

  // Add feature flags
  if (body.with_inic !== null) {
    query += ` AND with_inic = ?`;
    params.push(body.with_inic ? 1 : 0);
  }
  if (body.with_gpu !== null) {
    query += ` AND with_gpu = ?`;
    params.push(body.with_gpu ? 1 : 0);
  }
  if (body.with_hwr !== null) {
    query += ` AND with_hwr = ?`;
    params.push(body.with_hwr ? 1 : 0);
  }
  if (body.with_rps !== null) {
    query += ` AND with_rps = ?`;
    params.push(body.with_rps ? 1 : 0);
  }

  // Location filtering. These are fixed literals, not request values.
  const locationConditions: string[] = [];
  if (body.locationGermany !== false) {
    locationConditions.push("location = 'Germany'");
  }
  if (body.locationFinland !== false) {
    locationConditions.push("location = 'Finland'");
  }
  if (locationConditions.length > 0) {
    query += ` AND (${locationConditions.join(" OR ")})`;
  }

  // Datacenter filtering.
  //
  // City-level selections ("FSN") are prefix matches; anything else is an exact
  // datacenter ("FSN1-DC14"). Both forms bind their value — these strings come
  // straight from the request body, and this clause used to interpolate them into
  // the SQL while every other clause here bound with `?`.
  if (body.selectedDatacenters && body.selectedDatacenters.length > 0) {
    const dcConditions: string[] = [];

    for (const dc of body.selectedDatacenters) {
      if (CITY_PREFIXES.includes(dc)) {
        dcConditions.push(`datacenter LIKE ?`);
        params.push(`${dc}%`);
      } else {
        dcConditions.push(`datacenter = ?`);
        params.push(dc);
      }
    }

    if (dcConditions.length > 0) {
      query += ` AND (${dcConditions.join(" OR ")})`;
    }
  }

  // Add drive matching - D1 stores these as JSON strings
  query += ` AND nvme_drives = ?`;
  params.push(JSON.stringify(sortedNvme));

  query += ` AND sata_drives = ?`;
  params.push(JSON.stringify(sortedSata));

  query += ` AND hdd_drives = ?`;
  params.push(JSON.stringify(sortedHdd));

  query += ` ORDER BY price ASC LIMIT 6`;

  return { query, params };
}
