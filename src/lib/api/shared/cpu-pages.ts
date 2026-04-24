import { HETZNER_IPV4_COST_CENTS } from "$lib/constants";

export type CpuVendor = "AMD" | "Intel" | "Other";

export function slugifyCpu(cpu: string): string {
  let s = cpu;
  s = s.replace(/®|™|\(R\)|\(TM\)/gi, "");
  s = s.replace(/^\s*2\s*x\s+/i, "");
  s = s.replace(/^\s*Intel(?:\s|$)/i, "");
  s = s.replace(/^\s*AMD(?:\s|$)/i, "");
  s = s.toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, "-");
  s = s.replace(/^-+|-+$/g, "");
  return s;
}

export function vendorOf(cpu: string): CpuVendor {
  if (/^\s*(?:2x\s+)?Intel/i.test(cpu)) return "Intel";
  if (/^\s*(?:2x\s+)?AMD/i.test(cpu)) return "AMD";
  return "Other";
}

export function displayCpuName(cpu: string): string {
  return cpu
    .replace(/®|™|\(R\)|\(TM\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export interface EligibleCpu {
  slug: string;
  vendor: CpuVendor;
  displayName: string;
  cpus: string[];
  cores: number | null;
  threads: number | null;
  generation: string | null;
  score: number | null;
  multicoreScore: number | null;
  listingCount: number;
}

interface RawEligibleRow {
  cpu: string;
  cpu_cores: number | null;
  cpu_threads: number | null;
  cpu_generation: string | null;
  cpu_score: number | null;
  cpu_multicore_score: number | null;
  listing_count: number;
}

interface D1Like {
  prepare: (sql: string) => {
    bind: (...values: unknown[]) => {
      all: <T>() => Promise<{ results?: T[] }>;
      first: <T>() => Promise<T | null>;
    };
    all: <T>() => Promise<{ results?: T[] }>;
    first: <T>() => Promise<T | null>;
  };
}

export async function loadEligibleCpus(db: D1Like): Promise<EligibleCpu[]> {
  const rows = await db
    .prepare(
      `SELECT
         cpu,
         cpu_cores,
         cpu_threads,
         cpu_generation,
         cpu_score,
         cpu_multicore_score,
         COUNT(*) AS listing_count
       FROM current_auctions
       WHERE cpu_multicore_score IS NOT NULL
       GROUP BY cpu, cpu_cores, cpu_threads, cpu_generation, cpu_score, cpu_multicore_score`,
    )
    .all<RawEligibleRow>();

  const bySlug = new Map<string, EligibleCpu>();
  for (const row of rows.results ?? []) {
    const slug = slugifyCpu(row.cpu);
    if (!slug) continue;
    const vendor = vendorOf(row.cpu);
    const display = displayCpuName(row.cpu).replace(/^\s*2\s*x\s+/i, "");
    const existing = bySlug.get(slug);
    if (existing) {
      existing.cpus.push(row.cpu);
      existing.listingCount += row.listing_count;
      if (
        row.cpu_multicore_score &&
        (!existing.multicoreScore ||
          row.cpu_multicore_score > existing.multicoreScore)
      ) {
        existing.multicoreScore = row.cpu_multicore_score;
        existing.cores = row.cpu_cores;
        existing.threads = row.cpu_threads;
        existing.score = row.cpu_score;
        existing.generation = row.cpu_generation;
      }
    } else {
      bySlug.set(slug, {
        slug,
        vendor,
        displayName: display,
        cpus: [row.cpu],
        cores: row.cpu_cores,
        threads: row.cpu_threads,
        generation: row.cpu_generation,
        score: row.cpu_score,
        multicoreScore: row.cpu_multicore_score,
        listingCount: row.listing_count,
      });
    }
  }

  return [...bySlug.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
}

export interface CpuVariant {
  ramSize: number;
  isEcc: boolean;
  nvmeSize: number | null;
  sataSize: number | null;
  hddSize: number | null;
  cheapestPrice: number;
  listingCount: number;
}

export interface CpuPriceHistoryPoint {
  day: string;
  minPrice: number;
  maxPrice: number;
  listingCount: number;
}

export interface CheapestListing {
  cpu: string;
  ram: string[];
  ramSize: number;
  isEcc: boolean;
  nvmeSize: number | null;
  sataSize: number | null;
  hddSize: number | null;
  withGpu: boolean;
  withInic: boolean;
  withHwr: boolean;
  withRps: boolean;
  price: number;
  datacenter: string | null;
  seenAt: number | null;
}

export interface CpuPageData {
  cpu: EligibleCpu;
  cheapest: CheapestListing | null;
  priceMin: number | null;
  priceMax: number | null;
  variants: CpuVariant[];
  priceHistory: CpuPriceHistoryPoint[];
  related: EligibleCpu[];
}

interface CheapestRow {
  cpu: string;
  ram: string;
  ram_size: number;
  is_ecc: number;
  nvme_size: number | null;
  sata_size: number | null;
  hdd_size: number | null;
  with_gpu: number | null;
  with_inic: number | null;
  with_hwr: number | null;
  with_rps: number | null;
  price: number;
  datacenter: string | null;
  seen: string | null;
}

interface VariantRow {
  ram_size: number;
  is_ecc: number;
  nvme_size: number | null;
  sata_size: number | null;
  hdd_size: number | null;
  cheapest_price: number;
  listing_count: number;
}

interface HistoryRow {
  day: string;
  min_price: number;
  max_price: number;
  listing_count: number;
}

interface PriceRangeRow {
  min_price: number | null;
  max_price: number | null;
}

function ipv4(): number {
  return HETZNER_IPV4_COST_CENTS / 100;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(",");
}

export async function loadCpuPageData(
  db: D1Like,
  slug: string,
): Promise<CpuPageData | null> {
  const eligible = await loadEligibleCpus(db);
  const cpu = eligible.find((c) => c.slug === slug);
  if (!cpu) return null;

  const cpuList = cpu.cpus;
  const cpuPlaceholders = placeholders(cpuList.length);

  const cheapest = await db
    .prepare(
      `SELECT cpu, ram, ram_size, is_ecc,
              nvme_size, sata_size, hdd_size,
              with_gpu, with_inic, with_hwr, with_rps,
              price, datacenter, seen
       FROM current_auctions
       WHERE cpu IN (${cpuPlaceholders})
       ORDER BY price ASC
       LIMIT 1`,
    )
    .bind(...cpuList)
    .first<CheapestRow>();

  const range = await db
    .prepare(
      `SELECT MIN(price) AS min_price, MAX(price) AS max_price
       FROM current_auctions
       WHERE cpu IN (${cpuPlaceholders})`,
    )
    .bind(...cpuList)
    .first<PriceRangeRow>();

  const variantRows = await db
    .prepare(
      `SELECT ram_size, is_ecc, nvme_size, sata_size, hdd_size,
              MIN(price) AS cheapest_price,
              COUNT(*) AS listing_count
       FROM current_auctions
       WHERE cpu IN (${cpuPlaceholders})
       GROUP BY ram_size, is_ecc, nvme_size, sata_size, hdd_size
       ORDER BY listing_count DESC, cheapest_price ASC
       LIMIT 5`,
    )
    .bind(...cpuList)
    .all<VariantRow>();

  const historyRows = await db
    .prepare(
      `SELECT date(seen) AS day,
              MIN(price) / 100.0 AS min_price,
              MAX(price) / 100.0 AS max_price,
              COUNT(*) AS listing_count
       FROM auctions
       WHERE cpu IN (${cpuPlaceholders})
         AND seen >= date('now', '-90 days')
       GROUP BY date(seen)
       ORDER BY day ASC`,
    )
    .bind(...cpuList)
    .all<HistoryRow>();

  const related = pickRelated(eligible, cpu);

  const cheapestListing: CheapestListing | null = cheapest
    ? {
        cpu: cheapest.cpu,
        ram: parseStringArray(cheapest.ram),
        ramSize: cheapest.ram_size,
        isEcc: Boolean(cheapest.is_ecc),
        nvmeSize: cheapest.nvme_size || null,
        sataSize: cheapest.sata_size || null,
        hddSize: cheapest.hdd_size || null,
        withGpu: Boolean(cheapest.with_gpu),
        withInic: Boolean(cheapest.with_inic),
        withHwr: Boolean(cheapest.with_hwr),
        withRps: Boolean(cheapest.with_rps),
        price: cheapest.price + ipv4(),
        datacenter: cheapest.datacenter ?? null,
        seenAt: cheapest.seen
          ? Math.floor(new Date(cheapest.seen).getTime() / 1000)
          : null,
      }
    : null;

  return {
    cpu,
    cheapest: cheapestListing,
    priceMin: range?.min_price != null ? range.min_price + ipv4() : null,
    priceMax: range?.max_price != null ? range.max_price + ipv4() : null,
    variants: (variantRows.results ?? []).map((row) => ({
      ramSize: row.ram_size,
      isEcc: Boolean(row.is_ecc),
      nvmeSize: row.nvme_size || null,
      sataSize: row.sata_size || null,
      hddSize: row.hdd_size || null,
      cheapestPrice: row.cheapest_price + ipv4(),
      listingCount: row.listing_count,
    })),
    priceHistory: (historyRows.results ?? []).map((row) => ({
      day: row.day,
      minPrice: row.min_price + ipv4(),
      maxPrice: row.max_price + ipv4(),
      listingCount: row.listing_count,
    })),
    related,
  };
}

function pickRelated(all: EligibleCpu[], current: EligibleCpu): EligibleCpu[] {
  const candidates = all.filter(
    (c) => c.slug !== current.slug && c.vendor === current.vendor,
  );
  if (current.multicoreScore == null) {
    return candidates.slice(0, 4);
  }
  return candidates
    .map((c) => ({
      cpu: c,
      delta: Math.abs((c.multicoreScore ?? 0) - (current.multicoreScore ?? 0)),
    }))
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 4)
    .map((entry) => entry.cpu);
}

function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}
