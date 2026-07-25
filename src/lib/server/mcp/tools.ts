/**
 * MCP tool definitions.
 *
 * Tool descriptions and schemas are the entire API surface a model sees, so
 * they carry the units and the VAT/IPv4 semantics explicitly. Getting this
 * wrong is how an assistant ends up confidently quoting the wrong price.
 */

import { getSnapshot, type AuctionSnapshot } from "./snapshot";
import {
  searchAuctions,
  withVat,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type AuctionQuery,
  type SortKey,
} from "./search";

export interface ToolContext {
  env: PlatformEnv;
  /** Present only when the request carried a valid MCP access token. */
  userId: string | null;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Requires an authenticated MCP session. */
  requiresAuth?: boolean;
  handler: (
    args: Record<string, unknown>,
    ctx: ToolContext,
  ) => Promise<unknown>;
}

const SIZE_MODE = {
  type: "string",
  enum: ["total", "per-disk"],
  description:
    "How the size range is applied. 'total' (default) sums the drives of this type; 'per-disk' requires EVERY drive of this type to fall inside the range.",
};

/**
 * Mirrors the web UI's filter feature-for-feature, so anything expressible
 * there is expressible here — and an alert created via MCP behaves identically
 * to one created in the UI. Shared by search_auctions and create_alert so an
 * agent can search and then alert on the same parameters.
 */
const QUERY_PROPERTIES: Record<string, unknown> = {
  // ---- CPU ----
  cpu: {
    type: "string",
    description:
      "Case-insensitive substring of the CPU name, e.g. 'epyc', 'ryzen 9', '7302'. For exact models use cpu_models.",
  },
  cpu_models: {
    type: "array",
    items: { type: "string" },
    description:
      "Exact CPU model names; a server matches if it is any of them, e.g. ['AMD Ryzen 9 3900'].",
  },
  cpu_vendor: {
    type: "string",
    enum: ["Intel", "AMD"],
    description: "Restrict to one CPU vendor. Omit for either.",
  },
  cpu_count: {
    type: "integer",
    description: "Number of physical CPUs (sockets), e.g. 2 for dual-socket.",
  },
  min_cpu_cores: { type: "integer", description: "Minimum physical cores." },
  max_cpu_cores: { type: "integer", description: "Maximum physical cores." },
  min_cpu_threads: { type: "integer", description: "Minimum threads." },
  max_cpu_threads: { type: "integer", description: "Maximum threads." },
  min_cpu_multicore_score: {
    type: "integer",
    description:
      "Minimum Geekbench multi-core score. Servers whose CPU is not in the benchmark database are excluded when this is set.",
  },

  // ---- Memory ----
  min_ram_gb: { type: "integer", description: "Minimum RAM in GB." },
  max_ram_gb: { type: "integer", description: "Maximum RAM in GB." },
  ecc: {
    type: "boolean",
    description: "Require (true) or exclude (false) ECC memory.",
  },

  // ---- Disks ----
  min_nvme_count: {
    type: "integer",
    description: "Minimum number of NVMe drives.",
  },
  max_nvme_count: {
    type: "integer",
    description: "Maximum number of NVMe drives.",
  },
  min_nvme_size_gb: {
    type: "integer",
    description: "Minimum NVMe capacity in GB, interpreted per nvme_size_mode.",
  },
  max_nvme_size_gb: {
    type: "integer",
    description: "Maximum NVMe capacity in GB, interpreted per nvme_size_mode.",
  },
  nvme_size_mode: SIZE_MODE,

  min_sata_count: {
    type: "integer",
    description: "Minimum number of SATA SSDs.",
  },
  max_sata_count: {
    type: "integer",
    description: "Maximum number of SATA SSDs.",
  },
  min_sata_size_gb: {
    type: "integer",
    description: "Minimum SATA capacity in GB, interpreted per sata_size_mode.",
  },
  max_sata_size_gb: {
    type: "integer",
    description: "Maximum SATA capacity in GB, interpreted per sata_size_mode.",
  },
  sata_size_mode: SIZE_MODE,

  min_hdd_count: { type: "integer", description: "Minimum number of HDDs." },
  max_hdd_count: { type: "integer", description: "Maximum number of HDDs." },
  min_hdd_size_gb: {
    type: "integer",
    description: "Minimum HDD capacity in GB, interpreted per hdd_size_mode.",
  },
  max_hdd_size_gb: {
    type: "integer",
    description: "Maximum HDD capacity in GB, interpreted per hdd_size_mode.",
  },
  hdd_size_mode: SIZE_MODE,

  disk_mode: {
    type: "string",
    enum: ["and", "or"],
    description:
      "How the NVMe/SATA/HDD constraints combine. 'and' (default) requires all of them; 'or' matches a server satisfying any one — use for 'either 2 NVMe or 4 HDDs'.",
  },

  min_drive_count: {
    type: "integer",
    description:
      "Minimum TOTAL drives across all types. Use for a plain 'three disks' — a machine with 1 NVMe and 2 SATA has three drives and no per-type filter finds it.",
  },
  max_drive_count: {
    type: "integer",
    description:
      "Maximum total drives across all types. Set equal to min_drive_count for an exact count.",
  },

  // ---- Location ----
  location: {
    type: "string",
    enum: ["Germany", "Finland"],
    description: "Single country shorthand. Omit for either.",
  },
  locations: {
    type: "array",
    items: { type: "string", enum: ["Germany", "Finland"] },
    description: "Countries to allow. Takes precedence over `location`.",
  },
  datacenters: {
    type: "array",
    items: { type: "string" },
    description:
      "Exact datacenters such as 'FSN1-DC14', or city prefixes: FSN (Falkenstein), NBG (Nuremberg), HEL (Helsinki).",
  },

  // ---- Price ----
  max_price_eur: {
    type: "number",
    description:
      "Maximum monthly price in EUR, matched against total_monthly_net (server + IPv4, BEFORE VAT). Setting vat_rate does not change what this filters on.",
  },
  min_price_eur: {
    type: "number",
    description: "Minimum monthly price in EUR, on the same net basis.",
  },

  // ---- Extras ----
  gpu: { type: "boolean", description: "Require or exclude a GPU." },
  inic: { type: "boolean", description: "Require or exclude Intel NIC." },
  hwr: { type: "boolean", description: "Require or exclude hardware RAID." },
  rps: {
    type: "boolean",
    description: "Require or exclude redundant power supply.",
  },
};

/**
 * Search-only parameters that `ServerFilter` cannot express. Accepting them on
 * create_alert and then dropping them would produce an alert that does not
 * match what was asked for, so they are omitted from its schema entirely.
 */
const SEARCH_ONLY_KEYS = [
  "cpu",
  "min_cpu_multicore_score",
  "min_drive_count",
  "max_drive_count",
  "min_price_eur",
  "max_price_eur",
];

/** The subset of QUERY_PROPERTIES that maps cleanly onto ServerFilter. */
export const ALERT_QUERY_PROPERTIES: Record<string, unknown> =
  Object.fromEntries(
    Object.entries(QUERY_PROPERTIES).filter(
      ([key]) => !SEARCH_ONLY_KEYS.includes(key),
    ),
  );

/** Every query key, for reading arguments off a tool call. */
export const QUERY_KEYS = Object.keys(QUERY_PROPERTIES);

const PRICING_NOTE =
  "All prices are EUR and NET of VAT. pricing.monthly_net is the server alone; " +
  "pricing.total_monthly_net adds the mandatory IPv4 address. Pass vat_rate to " +
  "additionally receive total_monthly_gross. Server Radar is an independent " +
  "project and is not affiliated with Hetzner.";

function readQuery(args: Record<string, unknown>): AuctionQuery {
  const q: AuctionQuery = {};
  for (const key of Object.keys(QUERY_PROPERTIES)) {
    if (args[key] !== undefined && args[key] !== null) {
      (q as Record<string, unknown>)[key] = args[key];
    }
  }
  return q;
}

async function snapshotFor(ctx: ToolContext): Promise<AuctionSnapshot> {
  return getSnapshot(ctx.env.SNAPSHOT);
}

export const searchAuctionsTool: ToolDefinition = {
  name: "search_auctions",
  description:
    "Search Hetzner's dedicated server auction (Serverbörse) for currently listed servers matching hardware and price criteria. " +
    "Returns the cheapest matches first by default. Data refreshes about every 5 minutes. " +
    PRICING_NOTE,
  inputSchema: {
    type: "object",
    properties: {
      ...QUERY_PROPERTIES,
      sort: {
        type: "string",
        enum: ["price", "cpu_score", "ram", "next_reduce"],
        description:
          "Order of results. 'price' (default) is cheapest first; 'next_reduce' surfaces servers whose price drops soonest.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: MAX_LIMIT,
        description: `Maximum results to return (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT}).`,
      },
      vat_rate: {
        type: "number",
        description:
          "Decimal VAT rate to additionally report gross prices, e.g. 0.19 for Germany. Does not affect filtering.",
      },
    },
    additionalProperties: false,
  },
  async handler(args, ctx) {
    const snapshot = await snapshotFor(ctx);
    const result = searchAuctions(snapshot.auctions, readQuery(args), {
      limit: args.limit as number | undefined,
      sort: args.sort as SortKey | undefined,
      vat_rate: args.vat_rate as number | undefined,
    });

    return {
      ...result,
      snapshot_taken_at: snapshot.generated_at,
      currency: "EUR",
      vat_included: false,
    };
  },
};

export const getAuctionTool: ToolDefinition = {
  name: "get_auction",
  description:
    "Fetch one auction listing by its Hetzner auction ID, including full hardware detail and resolved pricing. " +
    PRICING_NOTE,
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "integer", description: "Hetzner auction ID." },
      vat_rate: {
        type: "number",
        description: "Decimal VAT rate to additionally report gross price.",
      },
    },
    required: ["id"],
    additionalProperties: false,
  },
  async handler(args, ctx) {
    const snapshot = await snapshotFor(ctx);
    const id = Number(args.id);
    const auction = snapshot.auctions.find((a) => a.id === id);

    if (!auction) {
      // A listing that has sold or expired simply vanishes from the feed, which
      // is worth saying — it is different from "no such ID ever existed".
      throw new Error(
        `No live auction with id ${id}. It may have sold or been delisted; listings disappear from the feed once they are gone.`,
      );
    }

    return {
      auction: withVat(auction, args.vat_rate as number | undefined),
      snapshot_taken_at: snapshot.generated_at,
    };
  },
};

export const cloudAvailabilityTool: ToolDefinition = {
  name: "cloud_availability",
  description:
    "Current availability of Hetzner Cloud server types per location — which cloud plans (CX, CPX, CAX, CCX) can actually be ordered right now. " +
    "This is Hetzner Cloud, which is separate from the dedicated server auction covered by search_auctions.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  async handler(_args, ctx) {
    const worker = ctx.env.RADAR_WORKER;
    if (!worker) {
      throw new Error("Cloud status service is not available.");
    }
    return { status: await worker.getStatus() };
  },
};

export const PUBLIC_TOOLS: ToolDefinition[] = [
  searchAuctionsTool,
  getAuctionTool,
  cloudAvailabilityTool,
];
