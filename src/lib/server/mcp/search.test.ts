import { describe, expect, it } from "vitest";
import { matchesQuery, searchAuctions, withVat, MAX_LIMIT } from "./search";
import type { SnapshotAuction } from "./snapshot";

function auction(overrides: Partial<SnapshotAuction> = {}): SnapshotAuction {
  return {
    id: 1,
    datacenter: "FSN1-DC14",
    location: "Germany",
    cpu: "AMD Ryzen 9 3900",
    cpu_vendor: "AMD",
    cpu_count: 1,
    cpu_cores: 12,
    cpu_threads: 24,
    cpu_generation: "Zen 2",
    cpu_score: 1300,
    cpu_multicore_score: 9000,
    is_highio: false,
    ram_size: 64,
    is_ecc: true,
    nvme_count: 2,
    nvme_drives: [512, 512],
    nvme_size: 1024,
    sata_count: 0,
    sata_drives: [],
    sata_size: 0,
    hdd_count: 0,
    hdd_drives: [],
    hdd_size: 0,
    with_inic: false,
    with_hwr: false,
    with_gpu: false,
    with_rps: false,
    traffic: "unlimited",
    bandwidth: 1000,
    information: [],
    seen: "2026-07-25T12:00:00.000Z",
    pricing: {
      currency: "EUR",
      monthly_net: 38,
      ipv4_monthly: 1.7,
      setup_net: 0,
      total_monthly_net: 39.7,
      vat_included: false,
      fixed_price: false,
      next_reduce_at: "2026-07-26T00:00:00.000Z",
    },
    ...overrides,
  };
}

describe("matchesQuery", () => {
  it("matches CPU as a case-insensitive substring", () => {
    expect(matchesQuery(auction(), { cpu: "ryzen" })).toBe(true);
    expect(matchesQuery(auction(), { cpu: "RYZEN 9" })).toBe(true);
    expect(matchesQuery(auction(), { cpu: "epyc" })).toBe(false);
  });

  it("filters price against the net total, which includes IPv4", () => {
    // total_monthly_net is 39.7; the bare server price is 38.
    expect(matchesQuery(auction(), { max_price_eur: 39.7 })).toBe(true);
    expect(matchesQuery(auction(), { max_price_eur: 39 })).toBe(false);
    expect(matchesQuery(auction(), { max_price_eur: 38 })).toBe(false);
  });

  it("treats unknown CPU enrichment as not meeting a minimum", () => {
    const unknown = auction({ cpu_cores: null, cpu_multicore_score: null });
    expect(matchesQuery(unknown, { min_cpu_cores: 4 })).toBe(false);
    expect(matchesQuery(unknown, { min_cpu_multicore_score: 1 })).toBe(false);
    // ...but does not exclude it when no such minimum was asked for.
    expect(matchesQuery(unknown, { min_ram_gb: 32 })).toBe(true);
  });

  it("matches a datacenter city prefix as well as an exact name", () => {
    expect(matchesQuery(auction(), { datacenter: "FSN" })).toBe(true);
    expect(matchesQuery(auction(), { datacenter: "fsn" })).toBe(true);
    expect(matchesQuery(auction(), { datacenter: "FSN1-DC14" })).toBe(true);
    expect(matchesQuery(auction(), { datacenter: "NBG" })).toBe(false);
    // An exact name must not match a different datacenter in the same city.
    expect(matchesQuery(auction(), { datacenter: "FSN1-DC15" })).toBe(false);
  });

  it("compares drive capacity as a total across drives", () => {
    expect(matchesQuery(auction(), { min_nvme_total_gb: 1024 })).toBe(true);
    expect(matchesQuery(auction(), { min_nvme_total_gb: 2048 })).toBe(false);
  });

  it("distinguishes largest single drive from total capacity", () => {
    // 2x512 totals 1024 but the largest drive is only 512.
    expect(matchesQuery(auction(), { min_largest_drive_gb: 512 })).toBe(true);
    expect(matchesQuery(auction(), { min_largest_drive_gb: 1024 })).toBe(false);
  });

  it("only filters booleans when a preference is expressed", () => {
    expect(matchesQuery(auction(), {})).toBe(true);
    expect(matchesQuery(auction(), { ecc: true })).toBe(true);
    expect(matchesQuery(auction(), { ecc: false })).toBe(false);
    expect(matchesQuery(auction(), { gpu: false })).toBe(true);
    expect(matchesQuery(auction(), { gpu: true })).toBe(false);
  });

  it("requires every supplied criterion to hold", () => {
    expect(matchesQuery(auction(), { cpu: "ryzen", min_ram_gb: 64 })).toBe(
      true,
    );
    expect(matchesQuery(auction(), { cpu: "ryzen", min_ram_gb: 128 })).toBe(
      false,
    );
  });
});

describe("searchAuctions", () => {
  const cheap = auction({
    id: 1,
    pricing: { ...auction().pricing, total_monthly_net: 20 },
  });
  const mid = auction({
    id: 2,
    pricing: { ...auction().pricing, total_monthly_net: 40 },
  });
  const dear = auction({
    id: 3,
    pricing: { ...auction().pricing, total_monthly_net: 60 },
  });

  it("sorts cheapest first by default", () => {
    const result = searchAuctions([dear, cheap, mid], {});
    expect(result.auctions.map((a) => a.id)).toEqual([1, 2, 3]);
  });

  it("reports total matches separately from the returned page", () => {
    const result = searchAuctions([cheap, mid, dear], {}, { limit: 2 });
    expect(result.total_matched).toBe(3);
    expect(result.returned).toBe(2);
    expect(result.truncated).toBe(true);
  });

  it("does not claim truncation when everything fits", () => {
    const result = searchAuctions([cheap, mid], {}, { limit: 10 });
    expect(result.truncated).toBe(false);
  });

  it("caps the limit regardless of what was requested", () => {
    const many = Array.from({ length: 80 }, (_, i) => auction({ id: i }));
    expect(searchAuctions(many, {}, { limit: 500 }).returned).toBe(MAX_LIMIT);
  });

  it("sorts unknown CPU scores last rather than treating them as zero", () => {
    const known = auction({ id: 1, cpu_multicore_score: 5000 });
    const unknown = auction({ id: 2, cpu_multicore_score: null });
    const result = searchAuctions([unknown, known], {}, { sort: "cpu_score" });
    expect(result.auctions.map((a) => a.id)).toEqual([1, 2]);
  });

  it("sorts servers that never drop in price last", () => {
    const soon = auction({
      id: 1,
      pricing: {
        ...auction().pricing,
        next_reduce_at: "2026-07-26T00:00:00.000Z",
      },
    });
    const never = auction({
      id: 2,
      pricing: {
        ...auction().pricing,
        fixed_price: true,
        next_reduce_at: null,
      },
    });
    const result = searchAuctions([never, soon], {}, { sort: "next_reduce" });
    expect(result.auctions.map((a) => a.id)).toEqual([1, 2]);
  });
});

describe("withVat", () => {
  it("leaves pricing untouched when no rate is given", () => {
    const priced = withVat(auction(), undefined);
    expect(priced.pricing.total_monthly_gross).toBeUndefined();
    expect(priced.pricing.vat_included).toBe(false);
  });

  it("adds a gross figure without claiming the net one includes VAT", () => {
    const priced = withVat(auction(), 0.19);
    expect(priced.pricing.total_monthly_gross).toBe(47.24);
    expect(priced.pricing.total_monthly_net).toBe(39.7);
    expect(priced.pricing.vat_included).toBe(false);
  });

  it("does not mutate the cached snapshot object", () => {
    const original = auction();
    withVat(original, 0.19);
    expect(
      (original.pricing as { total_monthly_gross?: number })
        .total_monthly_gross,
    ).toBeUndefined();
  });
});
