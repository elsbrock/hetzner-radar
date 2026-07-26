/**
 * Price filtering, sorting and grouping for the analyze page's result list.
 *
 * Extracted from `+page.svelte`, where it was a ~190-line `$effect` that copied
 * seven reactive values into locals, set a `processingList` flag, and ran the
 * whole pipeline inside `setTimeout(…, 10)` before assigning `groupedDisplayList`.
 * That is derivation expressed as a deferred side effect: the rendered list was
 * always at least a frame behind its inputs, and none of it was testable.
 *
 * As plain functions it is a `$derived` at the call site, and the sort/group rules
 * become assertable. Same pattern as `cloud-status/insights.ts` and
 * `configurations/insights.ts`.
 */

import type { ServerConfiguration } from "$lib/api/frontend/filter";

export type SortField =
  "price" | "ram" | "storage" | "cpu_score" | "cpu_multicore_score";

export type SortDirection = "asc" | "desc";

export type GroupByField = "none" | "cpu_vendor" | "cpu_model" | "best_price";

export interface ServerGroup {
  groupName: string;
  servers: ServerConfiguration[];
}

export type GroupedServerList = ServerGroup[];

const UNKNOWN_VENDOR_NAME = "Unknown Vendor";
const UNKNOWN_MODEL_NAME = "Unknown Model";
const BEST_PRICE_GROUP = "Best Price";
const ABOVE_BEST_PRICE_GROUP = "Above Best Price";

/**
 * Converts a VAT-inclusive price bound to the net value stored on auctions.
 *
 * Returns null when no bound is set, meaning "unconstrained".
 */
export function toNetPrice(
  grossPrice: number | undefined,
  vatRate: number,
): number | null {
  if (grossPrice === undefined) return null;
  return Math.round((grossPrice / (1 + vatRate)) * 100) / 100;
}

/**
 * Filters by net price range.
 *
 * A server with no price is excluded whenever any bound is set — it cannot be
 * shown to satisfy the constraint.
 */
export function filterByPrice(
  servers: ServerConfiguration[],
  minNet: number | null,
  maxNet: number | null,
): ServerConfiguration[] {
  if (minNet === null && maxNet === null) return servers;

  return servers.filter((server) => {
    const price = server.price ?? null;
    if (price === null) return false;
    return (
      (minNet === null || price >= minNet) &&
      (maxNet === null || price <= maxNet)
    );
  });
}

function sortValue(server: ServerConfiguration, field: SortField): number {
  switch (field) {
    case "price":
      return server.price ?? Infinity;
    case "ram":
      return server.ram_size ?? 0;
    case "storage":
      return (
        (server.nvme_size ?? 0) +
        (server.sata_size ?? 0) +
        (server.hdd_size ?? 0)
      );
    case "cpu_score":
      return server.cpu_score ?? 0;
    case "cpu_multicore_score":
      return server.cpu_multicore_score ?? 0;
  }
}

/**
 * Sorts a copy of `servers`.
 *
 * Missing values are substituted in `sortValue`: a missing price becomes
 * `Infinity` (so it is last ascending, first descending — it is the largest
 * value), and the other fields fall back to 0.
 *
 * The original comparator carried four extra branches, two special-casing
 * `Infinity` and two special-casing a 0 for ram / storage / cpu_score /
 * cpu_multicore_score. Every one of them computed exactly what the general
 * comparison below computes — for `valA = Infinity, valB = 30` the special branch
 * and the general path both give `asc: +1, desc: -1`, and likewise for
 * `valA = 0, valB = 32`. They are dropped rather than reproduced; ordering is
 * unchanged, which `insights.test.ts` pins in both directions.
 */
export function sortServers(
  servers: ServerConfiguration[],
  field: SortField,
  direction: SortDirection,
): ServerConfiguration[] {
  const sign = direction === "asc" ? 1 : -1;

  return [...servers].sort((a, b) => {
    const valA = sortValue(a, field);
    const valB = sortValue(b, field);

    if (valA === valB) return 0;
    return (valA < valB ? -1 : 1) * sign;
  });
}

/** Intel/AMD from the first word of the CPU string, or null if neither. */
function cpuVendor(server: ServerConfiguration): string | null {
  const vendor = server.cpu?.split(" ")[0];
  return vendor === "Intel" || vendor === "AMD" ? vendor : null;
}

/**
 * Groups an already-sorted list.
 *
 * Group order is deterministic: named groups sort alphabetically with the
 * "Unknown …" bucket forced last, and `best_price` puts the exact-best group
 * first. Empty groups are dropped.
 */
export function groupServers(
  servers: ServerConfiguration[],
  groupBy: GroupByField,
): GroupedServerList {
  if (groupBy === "none") {
    return [{ groupName: "All Servers", servers }];
  }

  if (groupBy === "best_price") {
    // markup_percentage is a float, so "is the best price" is a tolerance test.
    const epsilon = 0.001;
    const best: ServerConfiguration[] = [];
    const above: ServerConfiguration[] = [];

    for (const server of servers) {
      const isBest =
        server.markup_percentage !== null &&
        Math.abs(server.markup_percentage) < epsilon;
      (isBest ? best : above).push(server);
    }

    return [
      { groupName: BEST_PRICE_GROUP, servers: best },
      { groupName: ABOVE_BEST_PRICE_GROUP, servers: above },
    ].filter((group) => group.servers.length > 0);
  }

  const unknownName =
    groupBy === "cpu_vendor" ? UNKNOWN_VENDOR_NAME : UNKNOWN_MODEL_NAME;
  const groups = new Map<string, ServerGroup>();

  for (const server of servers) {
    const name =
      groupBy === "cpu_vendor"
        ? (cpuVendor(server) ?? unknownName)
        : (server.cpu ?? unknownName);

    let group = groups.get(name);
    if (!group) {
      group = { groupName: name, servers: [] };
      groups.set(name, group);
    }
    group.servers.push(server);
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.groupName === unknownName) return 1;
    if (b.groupName === unknownName) return -1;
    return a.groupName.localeCompare(b.groupName);
  });
}

export interface BuildDisplayListOptions {
  servers: ServerConfiguration[];
  /** VAT-inclusive bounds as entered by the user; undefined means unbounded. */
  priceMin: number | undefined;
  priceMax: number | undefined;
  /** VAT rate as a fraction, e.g. 0.19. */
  vatRate: number;
  sortField: SortField;
  sortDirection: SortDirection;
  groupBy: GroupByField;
}

/** Filter → sort → group, in that order. */
export function buildDisplayList({
  servers,
  priceMin,
  priceMax,
  vatRate,
  sortField,
  sortDirection,
  groupBy,
}: BuildDisplayListOptions): GroupedServerList {
  const filtered = filterByPrice(
    servers,
    toNetPrice(priceMin, vatRate),
    toNetPrice(priceMax, vatRate),
  );
  return groupServers(sortServers(filtered, sortField, sortDirection), groupBy);
}

/** Total servers across all groups. */
export function countServers(groups: GroupedServerList): number {
  return groups.reduce((sum, group) => sum + group.servers.length, 0);
}

/** Non-null prices across all groups, for the summary statistics. */
export function collectPrices(groups: GroupedServerList): number[] {
  return groups
    .flatMap((group) => group.servers)
    .map((server) => server.price)
    .filter((price): price is number => price !== null && price !== undefined);
}
