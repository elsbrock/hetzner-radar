/**
 * Builds a normalised `ServerFilter` from the flat MCP query schema.
 *
 * Two reasons this exists rather than letting a model emit a ServerFilter
 * directly:
 *
 * 1. `ServerFilter` has 30 fields with encoded units (RAM is log2 of GB, disk
 *    sizes are in units of 500 GB) and tri-state booleans. A model asked to
 *    produce one directly gets it wrong routinely.
 * 2. `idx_price_alert_user_id_filter` is UNIQUE on the raw filter *string*, so
 *    two semantically identical filters with different key order become two
 *    rows instead of a conflict. Building here, in a fixed key order, makes
 *    that index behave.
 *
 * The encodings below are taken from the code that actually matches alerts —
 * `worker/src/alert-service.ts` `MATCH_ALERTS_SQL` — not from the UI.
 */

import { defaultFilter, type ServerFilter } from "$lib/filter";
import type { AuctionQuery } from "./search";

/** Disk size ranges in ServerFilter are expressed in units of 500 GB. */
const DISK_UNIT_GB = 500;

/** Datacenter city prefixes the filter understands. */
const CITY_PREFIXES = ["FSN", "NBG", "HEL"];

function gbToDiskUnits(gb: number): number {
  return gb / DISK_UNIT_GB;
}

/** RAM range is log2 of gigabytes: `ramInternalSize[0] <= log2(ram_size)`. */
function gbToLog2(gb: number): number {
  return Math.log2(gb);
}

/**
 * Constructs the filter with keys in exactly the order `defaultFilter` declares
 * them, so `JSON.stringify` is stable across calls. Do not reorder.
 */
export function buildServerFilter(query: AuctionQuery): ServerFilter {
  const d = defaultFilter;

  // Absent location means "either"; naming one restricts to it.
  const wantsGermany = !query.location || query.location === "Germany";
  const wantsFinland = !query.location || query.location === "Finland";

  const vendor = query.cpu_vendor?.toLowerCase();
  const wantsIntel = !vendor || vendor === "intel";
  const wantsAmd = !vendor || vendor === "amd";

  const datacenters: string[] = [];
  if (query.datacenter) {
    const dc = query.datacenter.toUpperCase();
    datacenters.push(CITY_PREFIXES.includes(dc) ? dc : query.datacenter);
  }

  return {
    version: d.version,

    recentlySeen: true,

    locationGermany: wantsGermany,
    locationFinland: wantsFinland,

    showAuction: true,
    showStandard: false,

    cpuCount: d.cpuCount,
    cpuIntel: wantsIntel,
    cpuAMD: wantsAmd,

    cpuCores: [query.min_cpu_cores ?? d.cpuCores[0], d.cpuCores[1]],
    cpuThreads: [query.min_cpu_threads ?? d.cpuThreads[0], d.cpuThreads[1]],

    ramInternalSize: [
      query.min_ram_gb !== undefined
        ? gbToLog2(query.min_ram_gb)
        : d.ramInternalSize[0],
      d.ramInternalSize[1],
    ],

    ssdNvmeCount: [
      query.min_nvme_count ?? d.ssdNvmeCount[0],
      d.ssdNvmeCount[1],
    ],
    ssdNvmeInternalSize: [
      query.min_nvme_total_gb !== undefined
        ? gbToDiskUnits(query.min_nvme_total_gb)
        : d.ssdNvmeInternalSize[0],
      d.ssdNvmeInternalSize[1],
    ],

    ssdSataCount: [
      query.min_sata_count ?? d.ssdSataCount[0],
      d.ssdSataCount[1],
    ],
    ssdSataInternalSize: [
      query.min_sata_total_gb !== undefined
        ? gbToDiskUnits(query.min_sata_total_gb)
        : d.ssdSataInternalSize[0],
      d.ssdSataInternalSize[1],
    ],

    hddCount: [query.min_hdd_count ?? d.hddCount[0], d.hddCount[1]],
    hddInternalSize: [
      query.min_hdd_total_gb !== undefined
        ? gbToDiskUnits(query.min_hdd_total_gb)
        : d.hddInternalSize[0],
      d.hddInternalSize[1],
    ],

    // The MCP query expresses capacity as a total across drives, so the filter
    // must interpret the ranges the same way rather than per-disk.
    ssdNvmeSizeMode: "total",
    ssdSataSizeMode: "total",
    hddSizeMode: "total",

    diskMode: "and",

    selectedDatacenters: datacenters,
    selectedCpuModels: [],

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
