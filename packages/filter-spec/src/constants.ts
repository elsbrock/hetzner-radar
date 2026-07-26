/**
 * Geometry of the disk/size filter encodings, shared by every matcher.
 *
 * These values were previously re-declared in each place that needed them —
 * `ServerFilter.svelte` for the sliders, `mcp/filter.ts` for the encoder, and as
 * bare literals inside the DuckDB and SQLite queries. That is exactly how the
 * 250-vs-500 GB multiplier split happened (see
 * docs/specs/alert-disk-matching-fix-2026-06.md). Import from here instead.
 */

/** Disk size ranges in `ServerFilter` are expressed in units of 500 GB. */
export const DISK_UNIT_GB = 500;

/**
 * Datacenter selections that name a city rather than a specific facility.
 * Matched as `datacenter LIKE 'FSN%'`; anything else matches exactly.
 */
export const CITY_PREFIXES: readonly string[] = ["FSN", "NBG", "HEL"];

/** Highest per-disk size, in 500 GB units, each slider can express. */
export const NVME_PER_DISK_MAX = 18;
export const SATA_PER_DISK_MAX = 14;
export const HDD_PER_DISK_MAX = 44;

/** Most drives of each type a single server is assumed to carry. */
export const NVME_MAX_DEVICES = 8;
export const SATA_MAX_DEVICES = 4;
export const HDD_MAX_DEVICES = 15;

/**
 * Highest value the size slider can express for a disk type, in 500 GB units.
 *
 * In `total` mode the slider covers the sum across every drive, so its ceiling
 * is correspondingly higher.
 */
export function diskSizeCeiling(
  mode: "per-disk" | "total",
  perDiskMax: number,
  maxDevices: number,
): number {
  return mode === "total" ? perDiskMax * maxDevices : perDiskMax;
}

/**
 * Upper bounds used when a caller states none.
 *
 * `ServerFilter` has no way to say "unbounded", so an absent maximum has to be
 * encoded as *some* number. Using a slider maximum for that is wrong: the slider
 * ceiling is a UI affordance, while the same value is also the stored predicate
 * the alert matcher evaluates — and the matcher has no notion of sliders. An
 * unconstrained MCP alert was capped at 9 TB NVMe / 7 TB SATA / 22 TB HDD /
 * 128 cores, so it silently never fired for larger servers.
 *
 * These sit far above any Hetzner hardware, so "no maximum stated" means what it
 * says. A filter carrying one still renders in the UI — the slider pins its
 * upper handle at the maximum, which reads correctly as "no upper limit".
 */
export const UNBOUNDED = {
  /** 500 GB units — ~2 PB. */
  diskSize: 4096,
  cores: 4096,
  threads: 8192,
  /** log2 of GB — 2^20 GB ≈ 1 PB. */
  ramLog2: 20,
} as const;
