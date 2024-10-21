import queryString from "query-string";
import type { ServerFilter } from "$lib/dbapi";

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

export function getFilterFromURL(): ServerFilter | null {
  const hash = window.location.hash.substring(1); // Remove the leading '#'

  // Regular expression to match "filter.vN:..." where N is a version number
  const filterRegex = /^filter\.v(\d+):(.+)$/;
  const match = hash.match(filterRegex);

  if (!match) {
    // The hash does not start with the expected "filter.vN:" pattern
    return null;
  }

  const [, versionNumber, filterString] = match;
  const version = `v${versionNumber}`; // e.g., "v1"

  if (!filterString) {
    // No filter parameters found after the version
    return null;
  }

  // Parse the filter string using URLSearchParams
  const params = new URLSearchParams(filterString);

  if ([...params].length === 0) {
    // No valid query parameters found
    return null;
  }

  // Deserialize the filter using queryString.parse
  const deserializedFilter = queryString.parse(params.toString(), {
    arrayFormat: 'bracket',
    parseBooleans: true,
    parseNumbers: true,
  }) as ServerFilter;

  // TODO: Add validation for deserializedFilter if necessary

  return deserializedFilter;
}
