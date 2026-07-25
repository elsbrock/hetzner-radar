import { describe, expect, it } from "vitest";
import { buildCloudStatusInsights } from "./insights";
import type { CloudStatusData } from "./+page.server";

type ServerType = CloudStatusData["serverTypes"][number];

function serverType(
  id: number,
  name: string,
  overrides: Partial<ServerType> = {},
): ServerType {
  return {
    id,
    name,
    description: name,
    cores: 2,
    memory: 4,
    disk: 40,
    cpu_type: "shared",
    architecture: "x86",
    category: "regular_purpose",
    storageType: "local",
    deprecated: false,
    ...overrides,
  } as ServerType;
}

function location(id: number, city: string) {
  return {
    id,
    name: `loc${id}`,
    city,
    country: "DE",
    latitude: 0,
    longitude: 0,
  };
}

const base: CloudStatusData = {
  serverTypes: [
    serverType(1, "cx22"),
    serverType(2, "ccx13"),
    serverType(3, "cax11", { architecture: "arm" }),
  ],
  locations: [location(10, "Falkenstein"), location(20, "Ashburn")],
  supported: { 10: [1, 2, 3], 20: [1, 2] },
  availability: { 10: [1, 2, 3], 20: [1] },
  lastUpdated: "2026-07-25T00:00:00.000Z",
};

describe("buildCloudStatusInsights", () => {
  it("returns nothing without data", () => {
    expect(buildCloudStatusInsights(null)).toEqual([]);
    expect(
      buildCloudStatusInsights({ ...base, serverTypes: [], locations: [] }),
    ).toEqual([]);
  });

  it("names the locations where ARM is offered when it is a subset", () => {
    const [first] = buildCloudStatusInsights(base);
    expect(first).toContain("ARM");
    expect(first).toContain("Falkenstein");
    expect(first).not.toContain("Ashburn");
  });

  it("omits the ARM sentence when every location offers it", () => {
    const everywhere = {
      ...base,
      supported: { 10: [1, 2, 3], 20: [1, 2, 3] },
    };
    expect(
      buildCloudStatusInsights(everywhere).some((s) => s.includes("ARM")),
    ).toBe(false);
  });

  it("contrasts the widest and narrowest locations by in-stock share", () => {
    const ranked = buildCloudStatusInsights(base).find((s) =>
      s.includes("widest choice"),
    );
    // Falkenstein: 3/3 = 100%, Ashburn: 1/2 = 50%
    expect(ranked).toContain("Falkenstein");
    expect(ranked).toContain("100%");
    expect(ranked).toContain("50%");
  });

  it("flags a type that is out of stock everywhere it is offered", () => {
    const out = {
      ...base,
      availability: { 10: [1, 3], 20: [1] },
    };
    expect(
      buildCloudStatusInsights(out).some(
        (s) => s.includes("CCX13") && s.includes("out of stock"),
      ),
    ).toBe(true);
  });

  it("ignores deprecated types", () => {
    const withDeprecated = {
      ...base,
      serverTypes: [
        ...base.serverTypes,
        serverType(9, "cx11", { deprecated: true }),
      ],
      supported: { 10: [1, 2, 3, 9], 20: [1, 2] },
    };
    expect(
      buildCloudStatusInsights(withDeprecated).some((s) => s.includes("CX11")),
    ).toBe(false);
  });

  it("never exceeds four statements", () => {
    expect(buildCloudStatusInsights(base).length).toBeLessThanOrEqual(4);
  });
});
