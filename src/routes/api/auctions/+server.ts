import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { HETZNER_IPV4_COST_CENTS } from "$lib/constants";

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

interface MatchRequest {
  cpu: string;
  ram_size: number;
  is_ecc: boolean;
  nvme_drives: number[];
  sata_drives: number[];
  hdd_drives: number[];
  with_inic: boolean | null;
  with_gpu: boolean | null;
  with_hwr: boolean | null;
  with_rps: boolean | null;
  // Optional filters
  locationGermany?: boolean;
  locationFinland?: boolean;
  selectedDatacenters?: string[];
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
    const body: MatchRequest = await request.json();

    // Sort drives for comparison
    const sortedNvme = [...body.nvme_drives].sort((a, b) => a - b);
    const sortedSata = [...body.sata_drives].sort((a, b) => a - b);
    const sortedHdd = [...body.hdd_drives].sort((a, b) => a - b);

    // Build the query
    let query = `
      SELECT id, price, seen, datacenter, location
      FROM current_auctions
      WHERE cpu = ?
        AND ram_size = ?
        AND is_ecc = ?
        AND nvme_count = ?
        AND sata_count = ?
        AND hdd_count = ?
    `;

    const params: (string | number | boolean)[] = [
      body.cpu,
      body.ram_size,
      body.is_ecc ? 1 : 0,
      body.nvme_drives.length,
      body.sata_drives.length,
      body.hdd_drives.length,
    ];

    // Add feature flags
    if (body.with_inic !== null) {
      query += ` AND with_inic = ?`;
      params.push(body.with_inic ? 1 : 0);
    }
    if (body.with_gpu !== null) {
      query += ` AND with_gpu = ?`;
      params.push(body.with_gpu ? 1 : 0);
    }
    if (body.with_hwr !== null) {
      query += ` AND with_hwr = ?`;
      params.push(body.with_hwr ? 1 : 0);
    }
    if (body.with_rps !== null) {
      query += ` AND with_rps = ?`;
      params.push(body.with_rps ? 1 : 0);
    }

    // Location filtering
    const locationConditions: string[] = [];
    if (body.locationGermany !== false) {
      locationConditions.push("location = 'Germany'");
    }
    if (body.locationFinland !== false) {
      locationConditions.push("location = 'Finland'");
    }
    if (locationConditions.length > 0) {
      query += ` AND (${locationConditions.join(" OR ")})`;
    }

    // Datacenter filtering
    if (body.selectedDatacenters && body.selectedDatacenters.length > 0) {
      const cityPrefixes = ["FSN", "NBG", "HEL"];
      const dcConditions: string[] = [];

      for (const dc of body.selectedDatacenters) {
        if (cityPrefixes.includes(dc)) {
          dcConditions.push(`datacenter LIKE '${dc}%'`);
        } else {
          dcConditions.push(`datacenter = '${dc}'`);
        }
      }

      if (dcConditions.length > 0) {
        query += ` AND (${dcConditions.join(" OR ")})`;
      }
    }

    // Add drive matching - D1 stores these as JSON strings
    query += ` AND nvme_drives = ?`;
    params.push(JSON.stringify(sortedNvme));

    query += ` AND sata_drives = ?`;
    params.push(JSON.stringify(sortedSata));

    query += ` AND hdd_drives = ?`;
    params.push(JSON.stringify(sortedHdd));

    query += ` ORDER BY price ASC LIMIT 6`;

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
