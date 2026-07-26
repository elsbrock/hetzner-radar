/**
 * DuckDB predicate builder for `ServerFilter`.
 *
 * Extracted from `$lib/api/frontend/filter.ts` so it can be imported without
 * pulling in the DuckDB connection helpers — the conformance harness
 * (`filter-conformance.test.ts`) needs this function in a plain Node context,
 * and `$lib/api/frontend/dbapi` is not loadable there.
 *
 * Deliberately dependency-free apart from `sql-template-strings` and a type-only
 * import: keep it that way.
 */

import type { ServerFilter } from "../../filter";
import SQL, { SQLStatement } from "sql-template-strings";

export function generateFilterQuery(
  filter: ServerFilter,
  withCPU: boolean,
  withDatacenters: boolean,
  recentlySeen: boolean = true,
  hasServerTypeColumn: boolean = true,
): SQLStatement {
  const query = SQL` cpu_count >= ${filter.cpuCount}`;

  // server type filtering - only filter when column exists AND user disabled one type
  if (hasServerTypeColumn && (!filter.showAuction || !filter.showStandard)) {
    query.append(SQL` and (`);
    if (filter.showAuction) {
      query.append(SQL` server_type = 'auction'`);
    } else {
      query.append(SQL` 1=2`);
    }
    if (filter.showStandard) {
      query.append(SQL` or server_type = 'standard'`);
    } else {
      query.append(SQL` or 1=2`);
    }
    query.append(SQL` )`);
  }

  query.append(SQL` and (`);

  // location filtering
  if (filter.locationGermany) {
    query.append(SQL` location = 'Germany'`);
  } else {
    query.append(SQL` 1=2`);
  }

  if (filter.locationFinland) {
    query.append(SQL` or location = 'Finland'`);
  } else {
    query.append(SQL` or 1=2`);
  }

  query.append(SQL` )`);

  // datacenter filtering
  if (withDatacenters && filter.selectedDatacenters.length > 0) {
    // Separate city prefixes from specific datacenters
    const cityPrefixes = ["FSN", "NBG", "HEL"];
    const selectedPrefixes = filter.selectedDatacenters.filter((d) =>
      cityPrefixes.includes(d),
    );
    const selectedSpecific = filter.selectedDatacenters.filter(
      (d) => !cityPrefixes.includes(d),
    );

    const conditions: string[] = [];

    // Add LIKE conditions for city prefixes
    for (const prefix of selectedPrefixes) {
      conditions.push(`datacenter LIKE '${prefix}%'`);
    }

    // Add IN condition for specific datacenters
    if (selectedSpecific.length > 0) {
      conditions.push(
        `datacenter in (${selectedSpecific.map((d) => `'${d}'`).join(", ")})`,
      );
    }

    if (conditions.length > 0) {
      query
        .append(SQL` and (`)
        .append(conditions.join(" or "))
        .append(SQL`)`);
    }
  }

  query.append(SQL` and (`);

  // CPU vendor filtering
  if (filter.cpuIntel) {
    query.append(SQL` cpu_vendor = 'Intel'`);
  } else {
    query.append(SQL` 1=2`);
  }

  if (filter.cpuAMD) {
    query.append(SQL` or cpu_vendor = 'AMD'`);
  } else {
    query.append(SQL` or 1=2`);
  }

  query.append(SQL` )`);

  if (withCPU && filter.selectedCpuModels.length > 0) {
    query
      .append(SQL` and cpu in (`)
      .append(filter.selectedCpuModels.map((d) => `'${d}'`).join(", "))
      .append(SQL` )`);
  }

  // CPU cores/threads filtering (only when not at default full range)
  if (filter.cpuCores && (filter.cpuCores[0] > 0 || filter.cpuCores[1] < 128)) {
    query.append(
      SQL` and cpu_cores >= ${filter.cpuCores[0]} and cpu_cores <= ${filter.cpuCores[1]}`,
    );
  }
  if (
    filter.cpuThreads &&
    (filter.cpuThreads[0] > 0 || filter.cpuThreads[1] < 256)
  ) {
    query.append(
      SQL` and cpu_threads >= ${filter.cpuThreads[0]} and cpu_threads <= ${filter.cpuThreads[1]}`,
    );
  }

  // RAM settings
  if (filter.extrasECC !== null) {
    query.append(SQL` and is_ecc = ${filter.extrasECC}`);
  }

  query.append(SQL` and ram_size >= ${Math.pow(2, filter.ramInternalSize[0])}`);
  query.append(SQL` and ram_size <= ${Math.pow(2, filter.ramInternalSize[1])}`);

  // disk data — build per-type clauses, then join with AND or OR
  const useOr = filter.diskMode === "or";
  const diskClauses: SQLStatement[] = [];

  // NVMe clause
  const nvmeActive =
    !useOr || filter.ssdNvmeCount[0] !== 0 || filter.ssdNvmeCount[1] !== 8;
  if (nvmeActive) {
    const clause = SQL`(nvme_count >= ${filter.ssdNvmeCount[0]} and nvme_count <= ${filter.ssdNvmeCount[1]}`;
    if (filter.ssdNvmeSizeMode === "total") {
      clause.append(
        SQL` and nvme_size >= ${filter.ssdNvmeInternalSize[0] * 500} and nvme_size <= ${filter.ssdNvmeInternalSize[1] * 500}`,
      );
    } else {
      // "per-disk"
      clause.append(
        SQL` and array_length(array_filter(nvme_drives, x -> x >= ${filter.ssdNvmeInternalSize[0] * 500} AND x <= ${filter.ssdNvmeInternalSize[1] * 500})) = array_length(nvme_drives)`,
      );
    }
    clause.append(SQL`)`);
    diskClauses.push(clause);
  }

  // SATA clause
  const sataActive =
    !useOr || filter.ssdSataCount[0] !== 0 || filter.ssdSataCount[1] !== 4;
  if (sataActive) {
    const clause = SQL`(sata_count >= ${filter.ssdSataCount[0]} and sata_count <= ${filter.ssdSataCount[1]}`;
    if (filter.ssdSataSizeMode === "total") {
      clause.append(
        SQL` and sata_size >= ${filter.ssdSataInternalSize[0] * 500} and sata_size <= ${filter.ssdSataInternalSize[1] * 500}`,
      );
    } else {
      clause.append(
        SQL` and array_length(array_filter(sata_drives, x -> x >= ${filter.ssdSataInternalSize[0] * 500} AND x <= ${filter.ssdSataInternalSize[1] * 500})) = array_length(sata_drives)`,
      );
    }
    clause.append(SQL`)`);
    diskClauses.push(clause);
  }

  // HDD clause
  const hddActive =
    !useOr || filter.hddCount[0] !== 0 || filter.hddCount[1] !== 15;
  if (hddActive) {
    const clause = SQL`(hdd_count >= ${filter.hddCount[0]} and hdd_count <= ${filter.hddCount[1]}`;
    if (filter.hddSizeMode === "total") {
      clause.append(
        SQL` and hdd_size >= ${filter.hddInternalSize[0] * 500} and hdd_size <= ${filter.hddInternalSize[1] * 500}`,
      );
    } else {
      clause.append(
        SQL` and array_length(array_filter(hdd_drives, x -> x >= ${filter.hddInternalSize[0] * 500} AND x <= ${filter.hddInternalSize[1] * 500})) = array_length(hdd_drives)`,
      );
    }
    clause.append(SQL`)`);
    diskClauses.push(clause);
  }

  // Join clauses: AND mode appends each, OR mode wraps in (... or ...)
  const joiner = useOr ? SQL` or ` : SQL` and `;
  if (diskClauses.length > 0) {
    query.append(SQL` and (`);
    diskClauses.forEach((clause, i) => {
      if (i > 0) query.append(joiner);
      query.append(clause);
    });
    query.append(SQL`)`);
  }

  // // extras
  if (filter.extrasINIC !== null) {
    query.append(SQL` and with_inic = ${filter.extrasINIC}`);
  }
  if (filter.extrasGPU !== null) {
    query.append(SQL` and with_gpu = ${filter.extrasGPU}`);
  }
  if (filter.extrasHWR !== null) {
    query.append(SQL` and with_hwr = ${filter.extrasHWR}`);
  }
  if (filter.extrasRPS !== null) {
    query.append(SQL` and with_rps = ${filter.extrasRPS}`);
  }

  // recently seen
  // "Recently seen" means "present in the latest data snapshot". Anchor the window
  // to the dataset's own newest `seen` value, NOT wall-clock `now()`. The import
  // cadence is irregular (often 80-120 min apart, not hourly), so a now()-relative
  // window would be empty whenever the last import landed more than 70 min ago,
  // making the page show no results until the next import. Anchoring to max(seen)
  // always returns the latest snapshot and is timezone-independent.
  if (recentlySeen && filter.recentlySeen) {
    query.append(
      SQL` and seen > (SELECT max(seen) FROM server) - interval '70 minute'`,
    );
  }

  return query;
}
