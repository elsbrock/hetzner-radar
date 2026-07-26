/**
 * The alert-matching query, extracted from `AlertService` so it can be imported
 * without constructing the service (the conformance harness in
 * `src/lib/api/shared/filter-conformance.test.ts` runs this exact SQL against
 * in-memory SQLite alongside the DuckDB frontend matcher).
 *
 * Deliberately dependency-free: keep it that way so both sides of the workspace
 * can import it.
 */

/** €1.19 in cents — the mandatory Hetzner IPv4 surcharge. */
export const HETZNER_IPV4_COST_CENTS = 119;

export function buildMatchAlertsSql(ipv4CostCents: number = HETZNER_IPV4_COST_CENTS): string {
	return `
		WITH ConfigWithDriveStats AS (
			SELECT
				c.*,
				-- Compute min and max for HDD drives
				(SELECT MIN(value) FROM json_each(c.hdd_drives)) AS min_hdd_drive,
				(SELECT MAX(value) FROM json_each(c.hdd_drives)) AS max_hdd_drive,

				-- Compute min and max for NVMe drives
				(SELECT MIN(value) FROM json_each(c.nvme_drives)) AS min_nvme_drive,
				(SELECT MAX(value) FROM json_each(c.nvme_drives)) AS max_nvme_drive,

				-- Compute min and max for SATA drives
				(SELECT MIN(value) FROM json_each(c.sata_drives)) AS min_sata_drive,
				(SELECT MAX(value) FROM json_each(c.sata_drives)) AS max_sata_drive
			FROM
				current_auctions c
			WHERE
				1=1
		)

		SELECT 
			pa.id AS alert_id,
			pa.name,
			pa.price,
			pa.vat_rate,
			pa.user_id,
			pa.includes_ipv4_cost,
			pa.email_notifications,
			pa.discord_notifications,
			pa.webhook_notifications,
			user.email,
			user.discord_webhook_url,
			user.webhook_url,
			pa.created_at,
			pa.filter,
			c.id AS auction_id,
			c.price AS auction_price,
			c.seen
		FROM
			price_alert pa
		JOIN
			ConfigWithDriveStats c
		ON
			1 = 1  -- Cross join; all filtering is handled in WHERE
		INNER JOIN
			user
		ON
			pa.user_id = user.id
		WHERE
			-- Price Conditions
			pa.price >= (c.price + (CASE WHEN pa.includes_ipv4_cost = 1 THEN ${ipv4CostCents / 100} ELSE 0 END)) * (1 + pa.vat_rate / 100.0)

			-- Location Conditions: ORed appropriately
			AND (
				(
					json_extract(pa.filter, '$.locationGermany') = 1
					AND c.location = 'Germany'
				)
				OR
				(
					json_extract(pa.filter, '$.locationFinland') = 1
					AND c.location = 'Finland'
				)
			)

			-- CPU Count
			AND c.cpu_count >= json_extract(pa.filter, '$.cpuCount')

			-- CPU Vendor Conditions: ORed appropriately
			AND (
				(
					json_extract(pa.filter, '$.cpuIntel') = 1
					AND c.cpu_vendor = 'Intel'
				)
				OR
				(
					json_extract(pa.filter, '$.cpuAMD') = 1
					AND c.cpu_vendor = 'AMD'
				)
			)

			-- RAM Internal Size (log2 transformation)
			AND (
				json_extract(pa.filter, '$.ramInternalSize[0]') <= (ln(c.ram_size) / ln(2))
				AND (ln(c.ram_size) / ln(2)) <= json_extract(pa.filter, '$.ramInternalSize[1]')
			)

			-- Disk type filters (NVMe / SATA / HDD). Mirrors generateFilterQuery() in
			-- src/lib/api/frontend/filter.ts EXACTLY — keep the two in sync.
			--   unit       : 500 GB per slider step (getFormattedDiskSize(v, 500) in the UI)
			--   total mode : <type>_size BETWEEN lo*500 AND hi*500
			--   per-disk   : <type>_count = 0 (empty array passes, like the frontend's
			--               array_filter == array_length) OR every drive within [lo*500, hi*500]
			--   missing sizeMode/diskMode (pre-2026 alerts) -> 'per-disk' / 'and'
			AND (
				CASE
					WHEN COALESCE(json_extract(pa.filter, '$.diskMode'), 'and') = 'or' THEN
						-- OR mode: only types whose count range differs from the default
						-- ([0,8]/[0,4]/[0,15]) contribute; if none is active this is a no-op.
						(NOT (json_extract(pa.filter, '$.ssdNvmeCount[0]') != 0 OR json_extract(pa.filter, '$.ssdNvmeCount[1]') != 8) AND NOT (json_extract(pa.filter, '$.ssdSataCount[0]') != 0 OR json_extract(pa.filter, '$.ssdSataCount[1]') != 4) AND NOT (json_extract(pa.filter, '$.hddCount[0]') != 0 OR json_extract(pa.filter, '$.hddCount[1]') != 15))
						OR ((json_extract(pa.filter, '$.ssdNvmeCount[0]') != 0 OR json_extract(pa.filter, '$.ssdNvmeCount[1]') != 8) AND
								(
									c.nvme_count BETWEEN json_extract(pa.filter, '$.ssdNvmeCount[0]') AND json_extract(pa.filter, '$.ssdNvmeCount[1]')
									AND (
										CASE WHEN COALESCE(json_extract(pa.filter, '$.ssdNvmeSizeMode'), 'per-disk') = 'total' THEN
											(c.nvme_size >= json_extract(pa.filter, '$.ssdNvmeInternalSize[0]') * 500 AND c.nvme_size <= json_extract(pa.filter, '$.ssdNvmeInternalSize[1]') * 500)
										ELSE
											(c.nvme_count = 0 OR (c.min_nvme_drive >= json_extract(pa.filter, '$.ssdNvmeInternalSize[0]') * 500 AND c.max_nvme_drive <= json_extract(pa.filter, '$.ssdNvmeInternalSize[1]') * 500))
										END
									)
								)
						)
						OR ((json_extract(pa.filter, '$.ssdSataCount[0]') != 0 OR json_extract(pa.filter, '$.ssdSataCount[1]') != 4) AND
								(
									c.sata_count BETWEEN json_extract(pa.filter, '$.ssdSataCount[0]') AND json_extract(pa.filter, '$.ssdSataCount[1]')
									AND (
										CASE WHEN COALESCE(json_extract(pa.filter, '$.ssdSataSizeMode'), 'per-disk') = 'total' THEN
											(c.sata_size >= json_extract(pa.filter, '$.ssdSataInternalSize[0]') * 500 AND c.sata_size <= json_extract(pa.filter, '$.ssdSataInternalSize[1]') * 500)
										ELSE
											(c.sata_count = 0 OR (c.min_sata_drive >= json_extract(pa.filter, '$.ssdSataInternalSize[0]') * 500 AND c.max_sata_drive <= json_extract(pa.filter, '$.ssdSataInternalSize[1]') * 500))
										END
									)
								)
						)
						OR ((json_extract(pa.filter, '$.hddCount[0]') != 0 OR json_extract(pa.filter, '$.hddCount[1]') != 15) AND
								(
									c.hdd_count BETWEEN json_extract(pa.filter, '$.hddCount[0]') AND json_extract(pa.filter, '$.hddCount[1]')
									AND (
										CASE WHEN COALESCE(json_extract(pa.filter, '$.hddSizeMode'), 'per-disk') = 'total' THEN
											(c.hdd_size >= json_extract(pa.filter, '$.hddInternalSize[0]') * 500 AND c.hdd_size <= json_extract(pa.filter, '$.hddInternalSize[1]') * 500)
										ELSE
											(c.hdd_count = 0 OR (c.min_hdd_drive >= json_extract(pa.filter, '$.hddInternalSize[0]') * 500 AND c.max_hdd_drive <= json_extract(pa.filter, '$.hddInternalSize[1]') * 500))
										END
									)
								)
						)
					ELSE
						-- AND mode (default; also covers old alerts without diskMode)
							(
								c.nvme_count BETWEEN json_extract(pa.filter, '$.ssdNvmeCount[0]') AND json_extract(pa.filter, '$.ssdNvmeCount[1]')
								AND (
									CASE WHEN COALESCE(json_extract(pa.filter, '$.ssdNvmeSizeMode'), 'per-disk') = 'total' THEN
										(c.nvme_size >= json_extract(pa.filter, '$.ssdNvmeInternalSize[0]') * 500 AND c.nvme_size <= json_extract(pa.filter, '$.ssdNvmeInternalSize[1]') * 500)
									ELSE
										(c.nvme_count = 0 OR (c.min_nvme_drive >= json_extract(pa.filter, '$.ssdNvmeInternalSize[0]') * 500 AND c.max_nvme_drive <= json_extract(pa.filter, '$.ssdNvmeInternalSize[1]') * 500))
									END
								)
							)
						AND
							(
								c.sata_count BETWEEN json_extract(pa.filter, '$.ssdSataCount[0]') AND json_extract(pa.filter, '$.ssdSataCount[1]')
								AND (
									CASE WHEN COALESCE(json_extract(pa.filter, '$.ssdSataSizeMode'), 'per-disk') = 'total' THEN
										(c.sata_size >= json_extract(pa.filter, '$.ssdSataInternalSize[0]') * 500 AND c.sata_size <= json_extract(pa.filter, '$.ssdSataInternalSize[1]') * 500)
									ELSE
										(c.sata_count = 0 OR (c.min_sata_drive >= json_extract(pa.filter, '$.ssdSataInternalSize[0]') * 500 AND c.max_sata_drive <= json_extract(pa.filter, '$.ssdSataInternalSize[1]') * 500))
									END
								)
							)
						AND
							(
								c.hdd_count BETWEEN json_extract(pa.filter, '$.hddCount[0]') AND json_extract(pa.filter, '$.hddCount[1]')
								AND (
									CASE WHEN COALESCE(json_extract(pa.filter, '$.hddSizeMode'), 'per-disk') = 'total' THEN
										(c.hdd_size >= json_extract(pa.filter, '$.hddInternalSize[0]') * 500 AND c.hdd_size <= json_extract(pa.filter, '$.hddInternalSize[1]') * 500)
									ELSE
										(c.hdd_count = 0 OR (c.min_hdd_drive >= json_extract(pa.filter, '$.hddInternalSize[0]') * 500 AND c.max_hdd_drive <= json_extract(pa.filter, '$.hddInternalSize[1]') * 500))
									END
								)
							)
				END
			)

			-- Selected Datacenters. Mirrors generateFilterQuery: a selection is either a
			-- specific datacenter (exact match, e.g. 'FSN1-DC14') or a city prefix
			-- ('FSN'/'NBG'/'HEL', matched with LIKE 'FSN%'). Exact IN would never match a
			-- city prefix, so city-level alerts would silently never fire.
			AND (
				json_extract(pa.filter, '$.selectedDatacenters') IS NULL
				OR json_array_length(json_extract(pa.filter, '$.selectedDatacenters')) = 0
				OR EXISTS (
					SELECT 1 FROM json_each(pa.filter, '$.selectedDatacenters') AS dc
					WHERE c.datacenter = dc.value
						OR (dc.value IN ('FSN', 'NBG', 'HEL') AND c.datacenter LIKE dc.value || '%')
				)
			)

			-- Selected CPU Models
			AND (
				json_extract(pa.filter, '$.selectedCpuModels') IS NULL
				OR json_array_length(json_extract(pa.filter, '$.selectedCpuModels')) = 0
				OR c.cpu IN (
					SELECT value FROM json_each(pa.filter, '$.selectedCpuModels')
				)
			)

			-- Extras: ECC
			AND (
				json_extract(pa.filter, '$.extrasECC') IS NULL
				OR json_extract(pa.filter, '$.extrasECC') = c.is_ecc
			)

			-- Extras: INIC
			AND (
				json_extract(pa.filter, '$.extrasINIC') IS NULL
				OR json_extract(pa.filter, '$.extrasINIC') = c.with_inic
			)

			-- Extras: HWR
			AND (
				json_extract(pa.filter, '$.extrasHWR') IS NULL
				OR json_extract(pa.filter, '$.extrasHWR') = c.with_hwr
			)

			-- Extras: GPU
			AND (
				json_extract(pa.filter, '$.extrasGPU') IS NULL
				OR json_extract(pa.filter, '$.extrasGPU') = c.with_gpu
			)

			-- Extras: RPS
			AND (
				json_extract(pa.filter, '$.extrasRPS') IS NULL
				OR json_extract(pa.filter, '$.extrasRPS') = c.with_rps
			)

			-- CPU Cores. Mirrors generateFilterQuery on two points that used to differ:
			--   1. A full range means "no opinion" and the clause is skipped entirely.
			--      Applying it regardless excluded servers reporting more cores than the
			--      slider's ceiling.
			--   2. Unenriched CPUs (cpu_cores IS NULL) do NOT satisfy a stated range.
			--      SQL NULL comparison drops them frontend-side, and MCP rejects them
			--      explicitly; passing them through here fired alerts for servers whose
			--      core count nobody knows.
			AND (
				json_extract(pa.filter, '$.cpuCores') IS NULL
				OR (
					json_extract(pa.filter, '$.cpuCores[0]') = 0
					AND json_extract(pa.filter, '$.cpuCores[1]') >= 128
				)
				OR (
					c.cpu_cores IS NOT NULL
					AND c.cpu_cores >= json_extract(pa.filter, '$.cpuCores[0]')
					AND c.cpu_cores <= json_extract(pa.filter, '$.cpuCores[1]')
				)
			)

			-- CPU Threads. Same two rules as CPU Cores above; the full-range ceiling is 256.
			AND (
				json_extract(pa.filter, '$.cpuThreads') IS NULL
				OR (
					json_extract(pa.filter, '$.cpuThreads[0]') = 0
					AND json_extract(pa.filter, '$.cpuThreads[1]') >= 256
				)
				OR (
					c.cpu_threads IS NOT NULL
					AND c.cpu_threads >= json_extract(pa.filter, '$.cpuThreads[0]')
					AND c.cpu_threads <= json_extract(pa.filter, '$.cpuThreads[1]')
				)
			)
	`;
}

/** The production query, with the standard IPv4 surcharge. */
export const MATCH_ALERTS_SQL = buildMatchAlertsSql();
