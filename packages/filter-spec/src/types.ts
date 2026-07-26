/**
 * The stored filter format.
 *
 * Lives here rather than in `src/lib/` because the Cloudflare worker matches
 * alerts against this exact shape and cannot import from the SvelteKit app.
 * `$lib/filter` re-exports both symbols, so existing imports keep working.
 */

export type SizeMode = "per-disk" | "total";
export type DiskMode = "and" | "or";

export type ServerFilter = {
  version: number;

  recentlySeen: boolean;

  locationGermany: boolean;
  locationFinland: boolean;

  showAuction: boolean;
  showStandard: boolean;

  cpuCount: number;
  cpuIntel: boolean;
  cpuAMD: boolean;

  cpuCores: [number, number];
  cpuThreads: [number, number];

  ramInternalSize: [number, number];

  ssdNvmeCount: [number, number];
  ssdNvmeInternalSize: [number, number];

  ssdSataCount: [number, number];
  ssdSataInternalSize: [number, number];

  hddCount: [number, number];
  hddInternalSize: [number, number];

  // Size filter mode: 'per-disk' filters individual disk sizes, 'total' filters sum of all disks
  ssdNvmeSizeMode: SizeMode;
  ssdSataSizeMode: SizeMode;
  hddSizeMode: SizeMode;

  // Disk type combination mode: 'and' requires all disk type constraints, 'or' matches any
  diskMode: DiskMode;

  selectedDatacenters: string[];
  selectedCpuModels: string[];

  extrasECC: boolean | null;
  extrasINIC: boolean | null;
  extrasHWR: boolean | null;
  extrasGPU: boolean | null;
  extrasRPS: boolean | null;
};

export const defaultFilter: ServerFilter = {
  version: 1,

  recentlySeen: true,

  locationGermany: true,
  locationFinland: true,

  showAuction: true,
  showStandard: false, // Default false for backwards compat with existing alerts

  cpuCount: 1,
  cpuIntel: true,
  cpuAMD: true,

  cpuCores: [0, 128],
  cpuThreads: [0, 256],

  ramInternalSize: [4, 10],

  ssdNvmeCount: [0, 8],
  ssdNvmeInternalSize: [0, 18],

  ssdSataCount: [0, 4],
  ssdSataInternalSize: [0, 14],

  hddCount: [0, 15],
  hddInternalSize: [4, 44],

  ssdNvmeSizeMode: "per-disk",
  ssdSataSizeMode: "per-disk",
  hddSizeMode: "per-disk",

  diskMode: "and",

  selectedDatacenters: [],
  selectedCpuModels: [],

  extrasECC: null,
  extrasINIC: null,
  extrasHWR: null,
  extrasGPU: null,
  extrasRPS: null,
};
