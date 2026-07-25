/**
 * Builds a normalised `ServerFilter` from the MCP query schema.
 *
 * Two reasons this exists rather than letting a model emit a ServerFilter
 * directly:
 *
 * 1. `ServerFilter` encodes its ranges — RAM as log2 of GB, disk sizes in units
 *    of 500 GB — and uses tri-state booleans. A model asked to produce one
 *    directly gets it wrong routinely. The MCP schema speaks plain GB and the
 *    encoding happens here.
 * 2. `idx_price_alert_user_id_filter` is UNIQUE on the raw filter *string*, so
 *    two semantically identical filters with different key order become two
 *    rows instead of a conflict. Building here, in a fixed key order, makes that
 *    index behave.
 *
 * Encodings are taken from the code that actually matches alerts —
 * `worker/src/alert-service.ts` `MATCH_ALERTS_SQL` — cross-checked against the
 * UI's query builder in `src/lib/api/frontend/filter.ts`.
 */

import { defaultFilter, type ServerFilter } from "$lib/filter";
import { CITY_PREFIXES, type AuctionQuery } from "./search";

/** Disk size ranges in ServerFilter are expressed in units of 500 GB. */
const DISK_UNIT_GB = 500;

/**
 * Permissive bounds, used whenever the caller did not constrain a dimension.
 *
 * Deliberately NOT `defaultFilter`'s values: those encode the UI's opinionated
 * starting position (e.g. `hddInternalSize` starts at 4, i.e. 2000 GB), which
 * would silently exclude servers the caller never asked to exclude. Upper bounds
 * do come from `defaultFilter` so the ranges stay inside what the UI sliders can
 * express.
 */
const OPEN = {
  cpuCores: [0, defaultFilter.cpuCores[1]] as [number, number],
  cpuThreads: [0, defaultFilter.cpuThreads[1]] as [number, number],
  ram: [0, defaultFilter.ramInternalSize[1]] as [number, number],
  nvmeCount: [0, defaultFilter.ssdNvmeCount[1]] as [number, number],
  nvmeSize: [0, defaultFilter.ssdNvmeInternalSize[1]] as [number, number],
  sataCount: [0, defaultFilter.ssdSataCount[1]] as [number, number],
  sataSize: [0, defaultFilter.ssdSataInternalSize[1]] as [number, number],
  hddCount: [0, defaultFilter.hddCount[1]] as [number, number],
  hddSize: [0, defaultFilter.hddInternalSize[1]] as [number, number],
};

const gbToDiskUnits = (gb: number): number => gb / DISK_UNIT_GB;

/** RAM range is log2 of gigabytes: `ramInternalSize[0] <= log2(ram_size)`. */
const gbToLog2 = (gb: number): number => (gb > 0 ? Math.log2(gb) : 0);

function range(
  min: number | undefined,
  max: number | undefined,
  open: [number, number],
  encode: (v: number) => number = (v) => v,
): [number, number] {
  return [
    min !== undefined ? encode(min) : open[0],
    max !== undefined ? encode(max) : open[1],
  ];
}

/**
 * Constructs the filter with keys in exactly the order `defaultFilter` declares
 * them, so `JSON.stringify` is stable across calls. Do not reorder.
 */
export function buildServerFilter(query: AuctionQuery): ServerFilter {
  const locations = query.locations?.length
    ? query.locations.map((l) => l.toLowerCase())
    : query.location
      ? [query.location.toLowerCase()]
      : null;

  // No location constraint means "either", matching search behaviour.
  const wantsGermany = !locations || locations.includes("germany");
  const wantsFinland = !locations || locations.includes("finland");

  const vendor = query.cpu_vendor?.toLowerCase();
  const wantsIntel = !vendor || vendor === "intel";
  const wantsAmd = !vendor || vendor === "amd";

  const datacenters = (query.datacenters ?? []).map((d) => {
    const upper = d.toUpperCase();
    return CITY_PREFIXES.includes(upper) ? upper : d;
  });

  return {
    version: defaultFilter.version,

    recentlySeen: true,

    locationGermany: wantsGermany,
    locationFinland: wantsFinland,

    showAuction: true,
    showStandard: false,

    cpuCount: query.cpu_count ?? defaultFilter.cpuCount,
    cpuIntel: wantsIntel,
    cpuAMD: wantsAmd,

    cpuCores: range(query.min_cpu_cores, query.max_cpu_cores, OPEN.cpuCores),
    cpuThreads: range(
      query.min_cpu_threads,
      query.max_cpu_threads,
      OPEN.cpuThreads,
    ),

    ramInternalSize: range(
      query.min_ram_gb,
      query.max_ram_gb,
      OPEN.ram,
      gbToLog2,
    ),

    ssdNvmeCount: range(
      query.min_nvme_count,
      query.max_nvme_count,
      OPEN.nvmeCount,
    ),
    ssdNvmeInternalSize: range(
      query.min_nvme_size_gb,
      query.max_nvme_size_gb,
      OPEN.nvmeSize,
      gbToDiskUnits,
    ),

    ssdSataCount: range(
      query.min_sata_count,
      query.max_sata_count,
      OPEN.sataCount,
    ),
    ssdSataInternalSize: range(
      query.min_sata_size_gb,
      query.max_sata_size_gb,
      OPEN.sataSize,
      gbToDiskUnits,
    ),

    hddCount: range(query.min_hdd_count, query.max_hdd_count, OPEN.hddCount),
    hddInternalSize: range(
      query.min_hdd_size_gb,
      query.max_hdd_size_gb,
      OPEN.hddSize,
      gbToDiskUnits,
    ),

    ssdNvmeSizeMode: query.nvme_size_mode ?? "total",
    ssdSataSizeMode: query.sata_size_mode ?? "total",
    hddSizeMode: query.hdd_size_mode ?? "total",

    diskMode: query.disk_mode ?? "and",

    selectedDatacenters: datacenters,
    selectedCpuModels: query.cpu_models ?? [],

    extrasECC: query.ecc ?? null,
    extrasINIC: query.inic ?? null,
    extrasHWR: query.hwr ?? null,
    extrasGPU: query.gpu ?? null,
    extrasRPS: query.rps ?? null,
  };
}

/** Canonical serialisation used for the UNIQUE (user_id, filter) index. */
export function serializeFilter(filter: ServerFilter): string {
  return JSON.stringify(filter);
}

/**
 * Converts a net monthly target (server + IPv4, before VAT — the same basis as
 * `search_auctions.max_price_eur`) into what `price_alert.price` stores.
 *
 * MATCH_ALERTS_SQL compares:
 *   pa.price >= (c.price + ipv4) * (1 + pa.vat_rate / 100.0)
 *
 * so the stored value is a GROSS figure in whole EUR, and `vat_rate` is a
 * percentage (verified against production: prices 20-250, vat_rate 0-25).
 * Rounding matches the existing UI, which also rounds to whole EUR.
 */
export function netEurToStoredPrice(
  netEur: number,
  vatRatePercent: number,
): number {
  return Math.round(netEur * (1 + vatRatePercent / 100));
}
