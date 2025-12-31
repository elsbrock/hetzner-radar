import { describe, expect, it } from "vitest";

import {
  createDefaultFilter,
  decodeFilterString,
  defaultFilter,
  encodeFilter,
  parseStoredFilter,
} from "./filter";

describe("filter helpers", () => {
  it("creates a deep copy for the default filter", () => {
    const copy = createDefaultFilter();

    expect(copy).not.toBe(defaultFilter);
    expect(copy.ramInternalSize).not.toBe(defaultFilter.ramInternalSize);
    expect(copy.ssdNvmeCount).not.toBe(defaultFilter.ssdNvmeCount);
    expect(copy.selectedCpuModels).not.toBe(defaultFilter.selectedCpuModels);
  });

  it("merges stored filter data with defaults", () => {
    const stored = JSON.stringify({
      cpuCount: 4,
      selectedCpuModels: ["Intel Core i5-12500"],
    });

    const parsed = parseStoredFilter(stored);

    expect(parsed).not.toBeNull();
    expect(parsed?.cpuCount).toBe(4);
    expect(parsed?.selectedCpuModels).toEqual(["Intel Core i5-12500"]);
    expect(parsed?.extrasHWR).toBe(null); // inherited from default
  });

  it("returns null when stored filter is missing or malformed", () => {
    expect(parseStoredFilter(null)).toBeNull();
    expect(parseStoredFilter("null")).toBeNull();
    expect(parseStoredFilter("{")).toBeNull();
  });

  it("round-trips filters through encode/decode", () => {
    const filter = {
      ...createDefaultFilter(),
      cpuCount: 2,
      selectedCpuModels: ["AMD Ryzen 9"],
    };

    const encoded = encodeFilter(filter);
    const decoded = decodeFilterString(encoded);

    expect(decoded).toEqual(filter);
  });
});
