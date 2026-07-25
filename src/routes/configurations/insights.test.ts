import { describe, expect, it } from "vitest";
import { buildConfigurationInsights } from "./insights";
import type { ConfigurationServer } from "./+page.server";

function server(
  overrides: Partial<ConfigurationServer> = {},
): ConfigurationServer {
  return {
    cpu: "Intel Xeon E3-1275v5",
    ram: ["2x16GB"],
    ram_size: 32,
    is_ecc: true,
    hdd_arr: [],
    nvme_size: 512,
    nvme_drives: [512],
    sata_size: null,
    sata_drives: [],
    hdd_size: null,
    hdd_drives: [],
    with_inic: false,
    with_hwr: false,
    with_gpu: false,
    with_rps: false,
    price: 40,
    min_price: 40,
    last_price: 40,
    markup_percentage: 0,
    last_seen: 1_784_000_000,
    count: 1,
    cpu_cores: 4,
    cpu_threads: 8,
    cpu_generation: "Skylake",
    cpu_score: 5000,
    cpu_multicore_score: 12000,
    ...overrides,
  } as ConfigurationServer;
}

describe("buildConfigurationInsights", () => {
  it("returns nothing without usable rows", () => {
    expect(buildConfigurationInsights(null, 0)).toEqual([]);
    expect(buildConfigurationInsights({}, 0)).toEqual([]);
    expect(
      buildConfigurationInsights({ a: [server({ price: null })] }, 0),
    ).toEqual([]);
  });

  it("reports the cheapest configuration with its spec", () => {
    const insights = buildConfigurationInsights(
      {
        affordable: [
          server({ price: 31 }),
          server({ price: 55, cpu: "AMD Ryzen 5" }),
        ],
      },
      0,
    );
    expect(insights[0]).toContain("€31");
    expect(insights[0]).toContain("Intel Xeon E3-1275v5");
  });

  it("computes best value per core", () => {
    const insights = buildConfigurationInsights(
      { "per-core": [server({ price: 40, cpu_cores: 8 })] },
      0,
    );
    // 40 / 8 = 5
    expect(
      insights.some((s) => s.includes("Per core") && s.includes("€5")),
    ).toBe(true);
  });

  it("only reports a per-TB floor when a machine has at least a TB", () => {
    const small = buildConfigurationInsights(
      { a: [server({ nvme_size: 512 })] },
      0,
    );
    expect(small.some((s) => s.includes("per TB"))).toBe(false);

    const bulk = buildConfigurationInsights(
      { a: [server({ nvme_size: null, hdd_size: 4000, price: 60 })] },
      0,
    );
    expect(bulk.some((s) => s.includes("per TB"))).toBe(true);
  });

  it("deduplicates rows repeated across categories", () => {
    const one = server();
    const insights = buildConfigurationInsights(
      { a: [one], b: [one], c: [one] },
      0,
    );
    // 100% ECC either way, but the share must not be computed off duplicates
    expect(
      insights.some((s) => s.includes("100% of these configurations")),
    ).toBe(true);
  });

  it("mentions GPUs only when some exist", () => {
    expect(
      buildConfigurationInsights({ a: [server()] }, 0).some((s) =>
        s.includes("GPU"),
      ),
    ).toBe(false);
    expect(
      buildConfigurationInsights({ a: [server()] }, 3).some((s) =>
        s.includes("3 servers"),
      ),
    ).toBe(true);
  });

  it("never exceeds four statements", () => {
    expect(
      buildConfigurationInsights(
        { a: [server(), server({ hdd_size: 8000, price: 70 })] },
        2,
      ).length,
    ).toBeLessThanOrEqual(4);
  });
});
