import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { HETZNER_IPV4_COST_CENTS } from "$lib/constants";
import {
  buildAuctionMatchQuery,
  parseMatchRequest,
} from "$lib/api/backend/auction-match";

interface AuctionRow {
  id: number;
  price: number;
  seen: string;
  datacenter: string;
  location: string;
}

export interface LiveAuctionResult {
  id: number;
  lastPrice: number;
  lastSeen: number;
  datacenter: string;
  location: string;
}

export const POST: RequestHandler = async ({ request, platform }) => {
  const db = platform?.env?.DB;

  if (!db) {
    return json(
      { auctions: [], error: "Database not available" },
      { status: 503 },
    );
  }

  try {
    const body = parseMatchRequest(await request.json());

    if (!body) {
      return json(
        { auctions: [], error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { query, params } = buildAuctionMatchQuery(body);

    const result = await db
      .prepare(query)
      .bind(...params)
      .all<AuctionRow>();

    const auctions: LiveAuctionResult[] = (result.results ?? []).map((row) => ({
      id: row.id,
      lastPrice: row.price + HETZNER_IPV4_COST_CENTS / 100,
      lastSeen: row.seen ? Math.floor(new Date(row.seen).getTime() / 1000) : 0,
      datacenter: row.datacenter,
      location: row.location,
    }));

    return json({ auctions });
  } catch (error) {
    console.error("Error fetching auctions:", error);
    return json(
      { auctions: [], error: "Failed to fetch auctions" },
      { status: 500 },
    );
  }
};
