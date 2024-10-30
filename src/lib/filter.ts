import LZString from 'lz-string';
import type { ServerConfiguration } from './dbapi';
import { computeFilterRange, getInverseMemoryExp } from './disksize';

export type ServerFilter = {
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
  recentlySeen: false,

  locationGermany: true,
  locationFinland: true,

  cpuCount: 1,
  cpuIntel: true,
  cpuAMD: true,

  ramInternalSize: [4, 6],

  ssdNvmeCount: [0, 0],
  ssdNvmeInternalSize: [1, 12],

  ssdSataCount: [0, 0],
  ssdSataInternalSize: [1, 4],

  hddCount: [0, 2],
  hddInternalSize: [4, 16],

  selectedDatacenters: [],
  selectedCpuModels: [],

  extrasECC: null,
  extrasINIC: null,
  extrasHWR: false,
  extrasGPU: false,
  extrasRPS: false,
};

export function getFilterString(filter: ServerFilter) {
  const filterString = LZString.compressToEncodedURIComponent(JSON.stringify(filter));
  return filterString;
}

export function getFilterFromURL(): ServerFilter | null {
  const hash = window.location.hash.substring(1); // Remove the leading '#'

  const filterRegex = /^filter\.v(\d+):(.+)$/;
  const match = hash.match(filterRegex);

  if (!match) {
    // The hash does not start with the expected "filter.vN:" pattern
    return null;
  }

  const [, versionNumber, filterString] = match;
  const version = `v${versionNumber}`; // e.g., "v1"

  const decodedFilter = LZString.decompressFromEncodedURIComponent(filterString);
  const deserializedFilter = JSON.parse(decodedFilter) as ServerFilter;

  // TODO: Add validation for deserializedFilter if necessary

  return deserializedFilter;
}

export function convertServerConfigurationToFilter(serverConfiguration: ServerConfiguration): ServerFilter {
  console.log(serverConfiguration);
  return {
    cpuCount: 1,
    cpuIntel: true,
    cpuAMD: true,

    ramInternalSize: [
      getInverseMemoryExp(serverConfiguration.ram_size),
      getInverseMemoryExp(serverConfiguration.ram_size),
    ],

    ssdNvmeCount: Array(2).fill(serverConfiguration.nvme_drives.length).flat().slice(0, 2),
    ssdNvmeInternalSize: computeFilterRange(serverConfiguration.nvme_drives.toArray(), 250),

    ssdSataCount: Array(2).fill(serverConfiguration.sata_drives.length).flat().slice(0, 2),
    ssdSataInternalSize: computeFilterRange(serverConfiguration.sata_drives.toArray(), 250),

    hddCount: Array(2).fill(serverConfiguration.hdd_drives.length).flat().slice(0, 2),
    hddInternalSize: computeFilterRange(serverConfiguration.hdd_drives.toArray(), 1000),

    selectedCpuModels: [serverConfiguration.cpu],

    extrasECC: serverConfiguration.is_ecc,
    extrasINIC: serverConfiguration.with_inic,
    extrasHWR: serverConfiguration.with_hwr,
    extrasGPU: serverConfiguration.with_gpu,
    extrasRPS: serverConfiguration.with_rps,

    recentlySeen: false,

    locationGermany: true,
    locationFinland: true,

    selectedDatacenters: [],
  };
}