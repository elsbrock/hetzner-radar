import { describe, expect, it } from "vitest";
import { defaultFilter } from "$lib/filter";
import {
  buildServerFilter,
  netEurToStoredPrice,
  serializeFilter,
} from "./filter";

/**
 * The encodings asserted here come from `worker/src/alert-service.ts`
 * MATCH_ALERTS_SQL, which is what actually matches alerts:
 *   ramInternalSize[0] <= ln(ram_size)/ln(2) <= ramInternalSize[1]
 *   nvme_size >= ssdNvmeInternalSize[0] * 500
 * Getting these wrong produces alerts that silently never fire, or fire for
 * everything.
 */
describe("buildServerFilter", () => {
  it("encodes minimum RAM as log2 of gigabytes", () => {
    expect(buildServerFilter({ min_ram_gb: 64 }).ramInternalSize[0]).toBe(6);
    expect(buildServerFilter({ min_ram_gb: 32 }).ramInternalSize[0]).toBe(5);
    expect(buildServerFilter({ min_ram_gb: 1024 }).ramInternalSize[0]).toBe(10);
  });

  it("encodes disk capacity in units of 500 GB", () => {
    expect(
      buildServerFilter({ min_nvme_size_gb: 1000 }).ssdNvmeInternalSize[0],
    ).toBe(2);
    expect(
      buildServerFilter({ min_sata_size_gb: 500 }).ssdSataInternalSize[0],
    ).toBe(1);
    expect(
      buildServerFilter({ min_hdd_size_gb: 8000 }).hddInternalSize[0],
    ).toBe(16);
  });

  it("interprets capacity as a total, matching the query schema", () => {
    const filter = buildServerFilter({ min_nvme_size_gb: 1000 });
    expect(filter.ssdNvmeSizeMode).toBe("total");
    expect(filter.ssdSataSizeMode).toBe("total");
    expect(filter.hddSizeMode).toBe("total");
  });

  /**
   * A minimum above the UI's default ceiling used to produce an inverted range
   * such as hddInternalSize [128, 44]. MATCH_ALERTS_SQL then evaluates
   * `hdd_size >= 64000 AND hdd_size <= 22000`, which is never true, so the
   * alert silently never fires.
   */
  describe("ranges are never inverted", () => {
    it("raises the ceiling when a disk minimum exceeds the default max", () => {
      const filter = buildServerFilter({ min_hdd_size_gb: 64000 });
      const [lo, hi] = filter.hddInternalSize;
      expect(lo).toBe(128);
      expect(hi).toBeGreaterThanOrEqual(lo);
    });

    it("raises the ceiling when a RAM minimum exceeds the default max", () => {
      // 4 TB of RAM is log2 = 12, above the default ceiling of 10.
      const [lo, hi] = buildServerFilter({ min_ram_gb: 4096 }).ramInternalSize;
      expect(lo).toBe(12);
      expect(hi).toBeGreaterThanOrEqual(lo);
    });

    it("raises the ceiling when a count minimum exceeds the default max", () => {
      const [lo, hi] = buildServerFilter({ min_hdd_count: 40 }).hddCount;
      expect(lo).toBe(40);
      expect(hi).toBeGreaterThanOrEqual(lo);
    });

    it("still honours an explicit maximum above the minimum", () => {
      const [lo, hi] = buildServerFilter({
        min_hdd_size_gb: 2000,
        max_hdd_size_gb: 8000,
      }).hddInternalSize;
      expect(lo).toBe(4);
      expect(hi).toBe(16);
    });
  });

  it("leaves upper bounds at the defaults", () => {
    const filter = buildServerFilter({ min_ram_gb: 64 });
    expect(filter.ramInternalSize[1]).toBe(defaultFilter.ramInternalSize[1]);
  });

  it("allows both countries when no location is given", () => {
    const filter = buildServerFilter({});
    expect(filter.locationGermany).toBe(true);
    expect(filter.locationFinland).toBe(true);
  });

  it("restricts to one country when asked", () => {
    const fi = buildServerFilter({ location: "Finland" });
    expect(fi.locationFinland).toBe(true);
    expect(fi.locationGermany).toBe(false);
  });

  it("allows both vendors when none is given, and restricts when one is", () => {
    const both = buildServerFilter({});
    expect(both.cpuIntel).toBe(true);
    expect(both.cpuAMD).toBe(true);

    const amd = buildServerFilter({ cpu_vendor: "AMD" });
    expect(amd.cpuAMD).toBe(true);
    expect(amd.cpuIntel).toBe(false);
  });

  it("keeps extras tri-state: null when unspecified", () => {
    const filter = buildServerFilter({ ecc: true, gpu: false });
    expect(filter.extrasECC).toBe(true);
    expect(filter.extrasGPU).toBe(false);
    // Not mentioned means "don't care", not "must not have".
    expect(filter.extrasINIC).toBeNull();
    expect(filter.extrasHWR).toBeNull();
    expect(filter.extrasRPS).toBeNull();
  });

  it("passes a city prefix through uppercased", () => {
    expect(
      buildServerFilter({ datacenters: ["fsn"] }).selectedDatacenters,
    ).toEqual(["FSN"]);
  });

  it("keeps an exact datacenter as given", () => {
    expect(
      buildServerFilter({ datacenters: ["FSN1-DC14"] }).selectedDatacenters,
    ).toEqual(["FSN1-DC14"]);
  });

  it("only ever targets auction listings", () => {
    const filter = buildServerFilter({});
    expect(filter.showAuction).toBe(true);
    expect(filter.showStandard).toBe(false);
  });

  /**
   * idx_price_alert_user_id_filter is UNIQUE on the serialised string, so key
   * order is load-bearing: the same criteria must always produce byte-identical
   * JSON or duplicates slip past the index.
   */
  describe("serialisation stability", () => {
    it("produces identical JSON for identical criteria", () => {
      const a = serializeFilter(
        buildServerFilter({ min_ram_gb: 64, ecc: true }),
      );
      const b = serializeFilter(
        buildServerFilter({ ecc: true, min_ram_gb: 64 }),
      );
      expect(a).toBe(b);
    });

    it("emits keys in the same order as defaultFilter", () => {
      expect(Object.keys(buildServerFilter({}))).toEqual(
        Object.keys(defaultFilter),
      );
    });

    it("produces different JSON for different criteria", () => {
      const a = serializeFilter(buildServerFilter({ min_ram_gb: 64 }));
      const b = serializeFilter(buildServerFilter({ min_ram_gb: 128 }));
      expect(a).not.toBe(b);
    });
  });
});

/**
 * MATCH_ALERTS_SQL compares the stored price against
 * (auction + ipv4) * (1 + vat_rate/100), so the stored value is gross whole
 * euros and vat_rate is a percentage. Verified against production data:
 * price_alert.price ranges 20-250 and vat_rate 0-25.
 */
describe("netEurToStoredPrice", () => {
  it("adds VAT expressed as a percentage", () => {
    expect(netEurToStoredPrice(40, 19)).toBe(48); // 47.6 -> 48
    expect(netEurToStoredPrice(100, 25)).toBe(125);
  });

  it("passes the net figure through when VAT is zero", () => {
    expect(netEurToStoredPrice(40, 0)).toBe(40);
  });

  it("treats the rate as a percentage, not a decimal", () => {
    // 0.19 would mean 0.19%, which must not be read as 19%.
    expect(netEurToStoredPrice(100, 0.19)).toBe(100);
    expect(netEurToStoredPrice(100, 19)).toBe(119);
  });

  it("returns whole euros, matching the column and the existing UI", () => {
    expect(Number.isInteger(netEurToStoredPrice(33.33, 19))).toBe(true);
  });
});
