import type { ServerConfiguration } from "$lib/api/frontend/filter";
import LZString from "lz-string";
import { computeFilterRange, getInverseMemoryExp } from "./disksize";

export type ServerFilter = {
  version: number;

  recentlySeen: boolean;

  locationGermany: boolean;
  locationFinland: boolean;

  cpuCount: number;
  cpuIntel: boolean;
  cpuAMD: boolean;

  ramInternalSize: [number, number];

  ssdNvmeCount: [number, number];
  ssdNvmeInternalSize: [number, number];

  ssdSataCount: [number, number];
  ssdSataInternalSize: [number, number];

  hddCount: [number, number];
  hddInternalSize: [number, number];

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

  cpuCount: 1,
  cpuIntel: true,
  cpuAMD: true,

  ramInternalSize: [4, 10],

  ssdNvmeCount: [0, 8],
  ssdNvmeInternalSize: [0, 18],

  ssdSataCount: [0, 4],
  ssdSataInternalSize: [0, 14],

  hddCount: [0, 15],
  hddInternalSize: [4, 44],

  selectedDatacenters: [],
  selectedCpuModels: [],

  extrasECC: null,
  extrasINIC: null,
  extrasHWR: null,
  extrasGPU: null,
  extrasRPS: null,
};

function cloneFilter(filter: ServerFilter): ServerFilter {
  return JSON.parse(JSON.stringify(filter)) as ServerFilter;
}

export function createDefaultFilter(): ServerFilter {
  return cloneFilter(defaultFilter);
}

function mergeWithDefaultFilter(
  partial: Partial<ServerFilter> | null | undefined,
): ServerFilter {
  const base = createDefaultFilter();
  if (!partial) {
    return base;
  }

  return Object.assign(base, partial);
}

function safeParseJSON(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error("Failed to parse JSON filter:", error);
    return null;
  }
}

function coerceServerFilter(value: unknown): ServerFilter | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return mergeWithDefaultFilter(value as Partial<ServerFilter>);
}

export function encodeFilter(filter: ServerFilter): string {
  const filterString = LZString.compressToEncodedURIComponent(
    JSON.stringify(filter),
  );
  return filterString;
}

export function decodeFilterString(filterString: string): ServerFilter | null {
  try {
    const decompressed =
      LZString.decompressFromEncodedURIComponent(filterString);
    if (!decompressed) {
      return null;
    }
    const parsed = safeParseJSON(decompressed);
    return coerceServerFilter(parsed);
  } catch (e) {
    console.error("Error decoding filter string:", e);
    return null;
  }
}

export function getFilterFromURL(params: URLSearchParams): ServerFilter | null {
  const filterParam = params.get("filter");
  if (filterParam) {
    try {
      return decodeFilterString(filterParam);
    } catch (e) {
      console.error("Failed to parse filter from URL:", e);
    }
  }
  return null;
}

export function parseStoredFilter(
  raw: string | null | undefined,
): ServerFilter | null {
  if (!raw) {
    return null;
  }

  const parsed = safeParseJSON(raw);
  return coerceServerFilter(parsed);
}

export function loadFilter(): ServerFilter | null {
  const storedFilter = localStorage.getItem("radar-filter");
  if (storedFilter) {
    const parsed = safeParseJSON(storedFilter);
    return coerceServerFilter(parsed);
  }
  return null;
}

export function clearFilter() {
  localStorage.removeItem("radar-filter");
}

export function saveFilter(filter: ServerFilter | null) {
  if (filter) {
    localStorage.setItem("radar-filter", JSON.stringify(filter));
  }
}

export function convertServerConfigurationToFilter(
  serverConfiguration: ServerConfiguration,
): ServerFilter {
  const base = createDefaultFilter();

  base.cpuCount = 1;
  base.cpuIntel = true;
  base.cpuAMD = true;

  const ramSize = getInverseMemoryExp(serverConfiguration.ram_size);
  base.ramInternalSize = [ramSize, ramSize];

  base.ssdNvmeCount = Array(2)
    .fill(serverConfiguration.nvme_drives.length)
    .flat()
    .slice(0, 2) as [number, number];
  base.ssdNvmeInternalSize = computeFilterRange(
    serverConfiguration.nvme_drives,
    250,
  );

  base.ssdSataCount = Array(2)
    .fill(serverConfiguration.sata_drives.length)
    .flat()
    .slice(0, 2) as [number, number];
  base.ssdSataInternalSize = computeFilterRange(
    serverConfiguration.sata_drives,
    250,
  );

  base.hddCount = Array(2)
    .fill(serverConfiguration.hdd_drives.length)
    .flat()
    .slice(0, 2) as [number, number];
  base.hddInternalSize = computeFilterRange(
    serverConfiguration.hdd_drives,
    500,
  );

  base.selectedCpuModels = [serverConfiguration.cpu];

  base.extrasECC = serverConfiguration.is_ecc;
  base.extrasINIC = serverConfiguration.with_inic;
  base.extrasHWR = serverConfiguration.with_hwr;
  base.extrasGPU = serverConfiguration.with_gpu;
  base.extrasRPS = serverConfiguration.with_rps;

  base.recentlySeen = false;
  base.locationGermany = true;
  base.locationFinland = true;
  base.selectedDatacenters = [];

  return base;
}

export function isIdenticalFilter(
  filter1: ServerFilter | null,
  filter2: ServerFilter | null,
): boolean {
  return JSON.stringify(filter1) === JSON.stringify(filter2);
}

export function getHetznerLink(device: ServerConfiguration) {
  const minDriveLength = Math.min(
    device.nvme_size ? device.nvme_size / device.nvme_drives.length : Infinity,
    device.sata_size ? device.sata_size / device.sata_drives.length : Infinity,
    device.hdd_size ? device.hdd_size / device.hdd_drives.length : Infinity,
  );
  const maxDriveLength = Math.max(
    device.nvme_size ? device.nvme_size / device.nvme_drives.length : 0,
    device.sata_size ? device.sata_size / device.sata_drives.length : 0,
    device.hdd_size ? device.hdd_size / device.hdd_drives.length : 0,
  );
  const specials = [];
  if (device.with_inic) {
    specials.push("iNIC");
  }
  if (device.with_hwr) {
    specials.push("HWR");
  }
  if (device.with_gpu) {
    specials.push("GPU");
  }
  if (device.with_rps) {
    specials.push("RPS");
  }

  const driveTypes = [];
  if (device.nvme_drives.length > 0) {
    driveTypes.push("nvme");
  }
  if (device.sata_drives.length > 0) {
    driveTypes.push("sata");
  }
  if (device.hdd_drives.length > 0) {
    driveTypes.push("hdd");
  }

  let cpuType = "";
  if (device.cpu.toLowerCase().includes("intel")) {
    cpuType = "Intel";
  } else if (device.cpu.toLowerCase().includes("amd")) {
    cpuType = "AMD";
  }

  const filterQ = [
    `search=${encodeURIComponent(device.cpu)}`,
    `ram_from=${device.ram_size}`,
    `ram_to=${device.ram_size}`,
    `drives_count_from=${device.nvme_drives.length + device.sata_drives.length + device.hdd_drives.length}`,
  ];

  if (minDriveLength < Infinity) {
    filterQ.push(`drives_size_from=${Math.floor(minDriveLength / 500) * 500}`);
  }
  if (maxDriveLength > 0) {
    filterQ.push(`drives_size_to=${Math.floor(maxDriveLength / 500) * 500}`);
  }
  if (driveTypes.length > 0) {
    filterQ.push(`driveType=${encodeURIComponent(driveTypes.join("+"))}`);
  }
  if (cpuType) {
    filterQ.push(`cpuType=${cpuType}`);
  }
  if (device.is_ecc) {
    filterQ.push("ecc=true");
  }
  if (specials.length > 0) {
    filterQ.push(`additional=${encodeURIComponent(specials.join("+"))}`);
  }

  return `https://www.hetzner.com/sb/#${filterQ.join("&")}`;
}
