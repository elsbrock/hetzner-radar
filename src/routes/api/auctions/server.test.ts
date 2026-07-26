import { describe, expect, it } from "vitest";
import { buildAuctionMatchQuery, parseMatchRequest } from "./+server";

/**
 * The datacenter clause of this endpoint used to interpolate request strings
 * into SQL while every other clause bound with `?`, on a public unauthenticated
 * POST against a D1 binding that also holds `session` and `oauthAccessToken`.
 *
 * The first block below is the regression test for that. The rest pins the
 * lookup's behaviour so the fix cannot be undone by a later refactor.
 */

const VALID = {
  cpu: "AMD Ryzen 5 3600",
  ram_size: 64,
  is_ecc: true,
  nvme_drives: [1000, 1000],
  sata_drives: [] as number[],
  hdd_drives: [] as number[],
  with_inic: null,
  with_gpu: null,
  with_hwr: null,
  with_rps: null,
};

function build(raw: unknown) {
  const body = parseMatchRequest(raw);
  expect(body).not.toBeNull();
  return buildAuctionMatchQuery(body!);
}

describe("SQL injection regression", () => {
  const PAYLOAD =
    "x' UNION SELECT rowid, token, 0, ipAddress, userId FROM session --";

  it("keeps an injected datacenter out of the SQL and binds it instead", () => {
    const { query, params } = build({
      ...VALID,
      selectedDatacenters: [PAYLOAD],
    });

    expect(query).not.toContain("UNION");
    expect(query).not.toContain(PAYLOAD);
    expect(query).toContain("datacenter = ?");
    // The payload survives only as an inert bound value.
    expect(params).toContain(PAYLOAD);
  });

  it("never emits a quote character into the datacenter clause", () => {
    const hostile = ["'", '"', "\\", "--", "FSN'--"];
    const { query, params } = build({
      ...VALID,
      selectedDatacenters: hostile,
    });

    // Isolate the datacenter clause itself — the location clause legitimately
    // contains quoted literals, and `datacenter` also appears in the SELECT list.
    const start = query.indexOf("AND (datacenter");
    expect(start).toBeGreaterThan(-1);
    const clause = query.slice(start, query.indexOf(")", start) + 1);

    expect(clause).not.toMatch(/['"\\]/);
    expect(clause).toBe(
      `AND (${hostile.map(() => "datacenter = ?").join(" OR ")})`,
    );
    // Each hostile string is carried as an inert parameter.
    for (const h of hostile) expect(params).toContain(h);
  });

  it("binds one parameter per selected datacenter", () => {
    const { query, params } = build({
      ...VALID,
      selectedDatacenters: ["FSN1-DC14", "HEL1-DC2", "NBG1-DC3"],
    });

    expect(query.match(/datacenter (=|LIKE) \?/g)).toHaveLength(3);
    expect(params).toContain("FSN1-DC14");
    expect(params).toContain("HEL1-DC2");
    expect(params).toContain("NBG1-DC3");
  });
});

describe("parseMatchRequest", () => {
  it("accepts a well-formed body", () => {
    expect(parseMatchRequest(VALID)).not.toBeNull();
  });

  it.each([
    ["a non-object", "nope"],
    ["null", null],
    ["a missing cpu", { ...VALID, cpu: undefined }],
    ["an empty cpu", { ...VALID, cpu: "" }],
    ["a non-numeric ram_size", { ...VALID, ram_size: "64" }],
    ["a NaN ram_size", { ...VALID, ram_size: Number.NaN }],
    ["a non-boolean is_ecc", { ...VALID, is_ecc: "yes" }],
    ["missing drive arrays", { cpu: "x", ram_size: 1, is_ecc: false }],
    ["a non-numeric drive entry", { ...VALID, nvme_drives: ["1000"] }],
    ["a non-string datacenter", { ...VALID, selectedDatacenters: [1] }],
    [
      "more datacenters than the parameter cap",
      { ...VALID, selectedDatacenters: Array(65).fill("FSN") },
    ],
  ])("rejects %s", (_label, raw) => {
    expect(parseMatchRequest(raw)).toBeNull();
  });

  it("accepts exactly the datacenter cap", () => {
    expect(
      parseMatchRequest({
        ...VALID,
        selectedDatacenters: Array(64).fill("FSN"),
      }),
    ).not.toBeNull();
  });

  it("normalises an absent extras flag to null, meaning no opinion", () => {
    const body = parseMatchRequest({ ...VALID, with_gpu: undefined });
    expect(body?.with_gpu).toBeNull();

    // null must not narrow the query at all.
    expect(buildAuctionMatchQuery(body!).query).not.toContain("with_gpu");
  });
});

describe("buildAuctionMatchQuery", () => {
  it("matches hardware identity with bound parameters", () => {
    const { query, params } = build(VALID);

    expect(query).toContain("FROM current_auctions");
    expect(query).toContain("cpu = ?");
    expect(params[0]).toBe("AMD Ryzen 5 3600");
    expect(params[1]).toBe(64);
    expect(params[2]).toBe(1);
  });

  it("sorts drive arrays before comparing them as JSON", () => {
    const { params } = build({ ...VALID, nvme_drives: [2000, 500, 1000] });
    expect(params).toContain("[500,1000,2000]");
  });

  it("treats a city selection as a prefix match", () => {
    const { query, params } = build({
      ...VALID,
      selectedDatacenters: ["FSN"],
    });

    expect(query).toContain("datacenter LIKE ?");
    expect(params).toContain("FSN%");
  });

  it("treats a specific datacenter as an exact match", () => {
    const { query, params } = build({
      ...VALID,
      selectedDatacenters: ["FSN1-DC14"],
    });

    expect(query).toContain("datacenter = ?");
    expect(params).toContain("FSN1-DC14");
    expect(params).not.toContain("FSN1-DC14%");
  });

  it("combines prefix and exact selections with OR", () => {
    const { query } = build({
      ...VALID,
      selectedDatacenters: ["FSN", "HEL1-DC2"],
    });

    expect(query).toContain("datacenter LIKE ? OR datacenter = ?");
  });

  it("omits the datacenter clause when none are selected", () => {
    expect(build(VALID).query).not.toContain("datacenter LIKE");
    expect(build({ ...VALID, selectedDatacenters: [] }).query).not.toContain(
      "datacenter =",
    );
  });

  it("only narrows location when a flag is explicitly false", () => {
    expect(build(VALID).query).toContain(
      "location = 'Germany' OR location = 'Finland'",
    );

    const finlandOnly = build({ ...VALID, locationGermany: false });
    expect(finlandOnly.query).toContain("location = 'Finland'");
    expect(finlandOnly.query).not.toContain("location = 'Germany'");
  });

  it("applies extras flags only when stated", () => {
    expect(build(VALID).query).not.toContain("with_gpu");

    const { query, params } = build({ ...VALID, with_gpu: true });
    expect(query).toContain("with_gpu = ?");
    expect(params).toContain(1);
  });
});
