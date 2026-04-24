import { describe, it, expect } from "vitest";
import { slugifyCpu, vendorOf, displayCpuName } from "./cpu-pages";

describe("slugifyCpu", () => {
  it.each([
    ["AMD Ryzen 5 3600", "ryzen-5-3600"],
    ["Intel Xeon E3-1245v2", "xeon-e3-1245v2"],
    ["Intel Xeon E5-2680 v4", "xeon-e5-2680-v4"],
    ["2x Intel Xeon E5-2680 v4", "xeon-e5-2680-v4"],
    ["2x AMD EPYC 7502", "epyc-7502"],
    ["AMD EPYC 7502P", "epyc-7502p"],
    ["Intel(R) Xeon(R) E3-1245v2", "xeon-e3-1245v2"],
    ["Intel® Xeon® Gold 6132", "xeon-gold-6132"],
    ["Intel Core i7-6700", "core-i7-6700"],
    ["AMD Ryzen 7 PRO 8700GE", "ryzen-7-pro-8700ge"],
    ["AMD EPYC 4344P", "epyc-4344p"],
  ])("slugifies %s → %s", (cpu, expected) => {
    expect(slugifyCpu(cpu)).toBe(expected);
  });

  it("collapses whitespace and special chars to single hyphens", () => {
    expect(slugifyCpu("AMD   Ryzen___5  / 3600")).toBe("ryzen-5-3600");
  });

  it("returns empty string for an unrecognised input", () => {
    expect(slugifyCpu("")).toBe("");
    expect(slugifyCpu("   ")).toBe("");
  });
});

describe("vendorOf", () => {
  it("identifies Intel", () => {
    expect(vendorOf("Intel Xeon E3-1245v2")).toBe("Intel");
    expect(vendorOf("2x Intel Xeon Gold 6132")).toBe("Intel");
  });

  it("identifies AMD", () => {
    expect(vendorOf("AMD Ryzen 5 3600")).toBe("AMD");
    expect(vendorOf("2x AMD EPYC 7502")).toBe("AMD");
  });

  it("falls back to Other", () => {
    expect(vendorOf("ARM Neoverse N1")).toBe("Other");
  });
});

describe("displayCpuName", () => {
  it("strips trademark marks and collapses whitespace", () => {
    expect(displayCpuName("Intel® Xeon® Gold 6132")).toBe(
      "Intel Xeon Gold 6132",
    );
    expect(displayCpuName("Intel(R) Xeon(R) E3-1245v2")).toBe(
      "Intel Xeon E3-1245v2",
    );
  });
});
