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

/** Reused by search_auctions and the alert tools so the two stay interchangeable. */
const QUERY_PROPERTIES: Record<string, unknown> = {
  cpu: {
    type: "string",
    description:
      "Case-insensitive substring of the CPU name, e.g. 'epyc', 'ryzen 9', '7302'.",
  },
  cpu_vendor: {
    type: "string",
    enum: ["Intel", "AMD"],
    description: "Restrict to one CPU vendor.",
  },
  min_cpu_cores: { type: "integer", description: "Minimum physical cores." },
  min_cpu_threads: { type: "integer", description: "Minimum threads." },
  min_cpu_multicore_score: {
    type: "integer",
    description:
      "Minimum Geekbench multi-core score. Servers whose CPU is not in the benchmark database are excluded when this is set.",
  },
  min_ram_gb: { type: "integer", description: "Minimum RAM in GB." },
  max_price_eur: {
    type: "number",
    description:
      "Maximum monthly price in EUR, matched against total_monthly_net (server + IPv4, BEFORE VAT). Setting vat_rate does not change what this filters on.",
  },
  location: {
    type: "string",
    enum: ["Germany", "Finland"],
    description: "Country the datacenter is in.",
  },
  datacenter: {
    type: "string",
    description:
      "Exact datacenter such as 'FSN1-DC14', or a city prefix: FSN (Falkenstein), NBG (Nuremberg), HEL (Helsinki).",
  },
  min_nvme_count: {
    type: "integer",
    description: "Minimum number of NVMe drives.",
  },
  min_nvme_total_gb: {
    type: "integer",
    description:
      "Minimum combined NVMe capacity in GB (sum of all NVMe drives).",
  },
  min_sata_count: {
    type: "integer",
    description: "Minimum number of SATA SSDs.",
  },
  min_sata_total_gb: {
    type: "integer",
    description: "Minimum combined SATA SSD capacity in GB.",
  },
  min_hdd_count: { type: "integer", description: "Minimum number of HDDs." },
  min_hdd_total_gb: {
    type: "integer",
    description: "Minimum combined HDD capacity in GB.",
  },
  min_largest_drive_gb: {
    type: "integer",
    description:
      "Minimum capacity of the single largest drive, GB. Use for 'one big disk' rather than 'lots of total space'.",
  },
  ecc: {
    type: "boolean",
    description: "Require (true) or exclude (false) ECC memory.",
  },
  gpu: { type: "boolean", description: "Require or exclude a GPU." },
  inic: { type: "boolean", description: "Require or exclude Intel NIC." },
  hwr: { type: "boolean", description: "Require or exclude hardware RAID." },
  rps: {
    type: "boolean",
    description: "Require or exclude redundant power supply.",
  },
};

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
