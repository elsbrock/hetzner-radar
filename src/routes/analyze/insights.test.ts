import { describe, expect, it } from "vitest";
import type { ServerConfiguration } from "$lib/api/frontend/filter";
import {
  buildDisplayList,
  collectPrices,
  countServers,
  filterByPrice,
  groupServers,
  sortServers,
  toNetPrice,
} from "./insights";

/**
 * These rules lived inside a 190-line `$effect` on the analyze page and were never
 * covered. Ordering is the subtle part, and the assertions below were checked
 * against the original comparator rather than against intuition: a missing price
 * becomes `Infinity`, so it sorts last ascending and *first* descending, while a
 * 0 is an ordinary low value in every field.
 */

/**
 * `over` is deliberately loose rather than `Partial<ServerConfiguration>`.
 * `ServerConfiguration` declares `cpu: string`, but the rows come from DuckDB and
 * the production code has always defended against null (`server.cpu ?? …`), so
 * the tests need to be able to express that case. The declared type is the thing
 * that is wrong here, not the fixture.
 */
function server(
  over: Partial<Record<keyof ServerConfiguration, unknown>> = {},
): ServerConfiguration {
  return {
    cpu: "AMD Ryzen 5 3600",
    price: 40,
    ram_size: 64,
    nvme_size: 1000,
    sata_size: 0,
    hdd_size: 0,
    cpu_score: 1000,
    cpu_multicore_score: 5000,
    markup_percentage: 5,
    ...over,
  } as ServerConfiguration;
}

const names = (groups: { groupName: string }[]) =>
  groups.map((g) => g.groupName);
const prices = (servers: ServerConfiguration[]) => servers.map((s) => s.price);

describe("toNetPrice", () => {
  it("strips VAT and rounds to cents", () => {
    expect(toNetPrice(119, 0.19)).toBe(100);
    expect(toNetPrice(50, 0.25)).toBe(40);
  });

  it("returns null for an unset bound", () => {
    expect(toNetPrice(undefined, 0.19)).toBeNull();
  });

  it("is identity at a zero VAT rate", () => {
    expect(toNetPrice(42.5, 0)).toBe(42.5);
  });
});

describe("filterByPrice", () => {
  const list = [
    server({ price: 10 }),
    server({ price: 20 }),
    server({ price: 30 }),
  ];

  it("returns the input untouched when unbounded", () => {
    expect(filterByPrice(list, null, null)).toBe(list);
  });

  it("applies an inclusive lower bound", () => {
    expect(prices(filterByPrice(list, 20, null))).toEqual([20, 30]);
  });

  it("applies an inclusive upper bound", () => {
    expect(prices(filterByPrice(list, null, 20))).toEqual([10, 20]);
  });

  it("applies both bounds", () => {
    expect(prices(filterByPrice(list, 15, 25))).toEqual([20]);
  });

  it("excludes priceless servers once any bound is set", () => {
    const withNull = [...list, server({ price: null })];
    expect(filterByPrice(withNull, 0, null)).toHaveLength(3);
    // ...but keeps them when unconstrained.
    expect(filterByPrice(withNull, null, null)).toHaveLength(4);
  });
});

describe("sortServers", () => {
  it("does not mutate its input", () => {
    const list = [server({ price: 30 }), server({ price: 10 })];
    sortServers(list, "price", "asc");
    expect(prices(list)).toEqual([30, 10]);
  });

  it("sorts by price ascending and descending", () => {
    const list = [
      server({ price: 30 }),
      server({ price: 10 }),
      server({ price: 20 }),
    ];
    expect(prices(sortServers(list, "price", "asc"))).toEqual([10, 20, 30]);
    expect(prices(sortServers(list, "price", "desc"))).toEqual([30, 20, 10]);
  });

  it("treats a missing price as Infinity: last ascending, first descending", () => {
    // Verified against the original comparator, which produced exactly this.
    const list = [
      server({ price: null }),
      server({ price: 30 }),
      server({ price: 10 }),
    ];
    expect(prices(sortServers(list, "price", "asc"))).toEqual([10, 30, null]);
    expect(prices(sortServers(list, "price", "desc"))).toEqual([null, 30, 10]);
  });

  it("sums the three disk types for storage", () => {
    const small = server({ nvme_size: 500, sata_size: 0, hdd_size: 0 });
    const big = server({ nvme_size: 500, sata_size: 500, hdd_size: 4000 });
    const sorted = sortServers([small, big], "storage", "desc");
    expect(sorted[0]).toBe(big);
  });

  it("sorts a zero as the low value it is, in both directions", () => {
    // The original special-cased 0 for ram/storage/cpu_score, but those branches
    // computed the same result as the general comparison. 0 is an ordinary low
    // value, not an unknown — only a missing *price* is pinned last.
    const zero = server({ ram_size: 0 });
    const small = server({ ram_size: 32 });
    const large = server({ ram_size: 128 });

    expect(sortServers([large, zero, small], "ram", "asc")[0]).toBe(zero);
    expect(sortServers([large, zero, small], "ram", "desc").at(-1)).toBe(zero);
  });

  it("sorts a zero price as the cheapest, distinct from a missing price", () => {
    const free = server({ price: 0 });
    const paid = server({ price: 10 });
    const unknown = server({ price: null });

    expect(sortServers([paid, free], "price", "asc")[0]).toBe(free);
    // A real 0 is cheapest; a missing price is Infinity, so it goes last.
    const asc = sortServers([unknown, paid, free], "price", "asc");
    expect(asc[0]).toBe(free);
    expect(asc.at(-1)).toBe(unknown);
  });

  it.each(["cpu_score", "cpu_multicore_score"] as const)(
    "sorts by %s",
    (field) => {
      const low = server({ [field]: 100 } as Partial<ServerConfiguration>);
      const high = server({ [field]: 900 } as Partial<ServerConfiguration>);
      expect(sortServers([low, high], field, "desc")[0]).toBe(high);
    },
  );
});

describe("groupServers", () => {
  it("puts everything in one group for 'none'", () => {
    const list = [server(), server()];
    const groups = groupServers(list, "none");
    expect(names(groups)).toEqual(["All Servers"]);
    expect(groups[0].servers).toBe(list);
  });

  it("groups by vendor alphabetically", () => {
    const groups = groupServers(
      [
        server({ cpu: "Intel Xeon E3-1275" }),
        server({ cpu: "AMD Ryzen 5 3600" }),
      ],
      "cpu_vendor",
    );
    expect(names(groups)).toEqual(["AMD", "Intel"]);
  });

  it("forces the unknown vendor bucket last", () => {
    const groups = groupServers(
      [
        server({ cpu: "Marvell ThunderX" }),
        server({ cpu: "Intel Xeon" }),
        server({ cpu: null }),
      ],
      "cpu_vendor",
    );
    expect(names(groups)).toEqual(["Intel", "Unknown Vendor"]);
    // Both the unrecognised vendor and the null CPU land in the same bucket.
    expect(groups[1].servers).toHaveLength(2);
  });

  it("groups by exact CPU model", () => {
    const groups = groupServers(
      [
        server({ cpu: "Intel Xeon E3-1275" }),
        server({ cpu: "AMD Ryzen 5 3600" }),
        server({ cpu: "Intel Xeon E3-1275" }),
      ],
      "cpu_model",
    );
    expect(names(groups)).toEqual(["AMD Ryzen 5 3600", "Intel Xeon E3-1275"]);
    expect(groups[1].servers).toHaveLength(2);
  });

  it("splits best price from the rest, best first", () => {
    const groups = groupServers(
      [
        server({ markup_percentage: 12 }),
        server({ markup_percentage: 0 }),
        server({ markup_percentage: 0.0001 }),
      ],
      "best_price",
    );
    expect(names(groups)).toEqual(["Best Price", "Above Best Price"]);
    // 0 and 0.0001 are both within epsilon of the best price.
    expect(groups[0].servers).toHaveLength(2);
    expect(groups[1].servers).toHaveLength(1);
  });

  it("treats a null markup as not-best", () => {
    const groups = groupServers(
      [server({ markup_percentage: null })],
      "best_price",
    );
    expect(names(groups)).toEqual(["Above Best Price"]);
  });

  it("drops empty groups", () => {
    const groups = groupServers(
      [server({ markup_percentage: 0 })],
      "best_price",
    );
    expect(names(groups)).toEqual(["Best Price"]);
  });

  it("returns nothing for an empty list", () => {
    expect(groupServers([], "cpu_vendor")).toEqual([]);
    expect(groupServers([], "best_price")).toEqual([]);
  });
});

describe("buildDisplayList", () => {
  it("filters, then sorts, then groups", () => {
    const list = [
      server({ cpu: "Intel Xeon", price: 100 }),
      server({ cpu: "AMD Ryzen", price: 50 }),
      server({ cpu: "AMD Ryzen", price: 25 }),
      server({ cpu: "AMD Ryzen", price: 500 }),
    ];

    const groups = buildDisplayList({
      servers: list,
      priceMin: undefined,
      priceMax: 119, // gross; 100 net at 19% VAT
      vatRate: 0.19,
      sortField: "price",
      sortDirection: "asc",
      groupBy: "cpu_vendor",
    });

    expect(names(groups)).toEqual(["AMD", "Intel"]);
    // The 500 is filtered out; the AMD group stays price-ascending.
    expect(prices(groups[0].servers)).toEqual([25, 50]);
    expect(prices(groups[1].servers)).toEqual([100]);
  });

  it("applies price bounds in net terms, not gross", () => {
    const groups = buildDisplayList({
      servers: [server({ price: 100 })],
      priceMin: 110,
      priceMax: undefined,
      vatRate: 0.19,
      sortField: "price",
      sortDirection: "asc",
      groupBy: "none",
    });
    // 110 gross is ~92.44 net, so a 100 net server still qualifies.
    expect(countServers(groups)).toBe(1);
  });
});

describe("countServers / collectPrices", () => {
  const groups = [
    {
      groupName: "A",
      servers: [server({ price: 10 }), server({ price: null })],
    },
    { groupName: "B", servers: [server({ price: 30 })] },
  ];

  it("counts across groups", () => {
    expect(countServers(groups)).toBe(3);
    expect(countServers([])).toBe(0);
  });

  it("collects only real prices", () => {
    expect(collectPrices(groups)).toEqual([10, 30]);
  });
});
