import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";

/**
 * GET handler for fetching auctions that matched a specific alert
 *
 * This endpoint retrieves auction matches for a triggered alert from the alert_auction_matches table,
 * joined with the auctions table to get full auction details.
 */
export async function GET({ params, locals, platform }: RequestEvent) {
  // Ensure user is authenticated
  if (!locals.user) {
    throw error(401, "Unauthorized");
  }

  const { alertId } = params;
  if (!alertId) {
    throw error(400, "Alert ID is required");
  }

  const env = platform?.env;
  const db = env?.DB;
  if (!db) {
    throw error(500, "Database connection failed");
  }

  try {
    // First verify that the alert belongs to the current user
    type AlertHistorySummary = {
      id: string;
      name: string;
    };

    const alertHistoryResult = await db
      .prepare(
        `
      SELECT id, name 
      FROM price_alert_history
      WHERE id = ? and user_id = ?
    `,
      )
      .bind(alertId, locals.user.id)
      .all<AlertHistorySummary>();

    // Check if we found the alert in history
    if (alertHistoryResult.results.length > 0) {
      const alertHistory = alertHistoryResult.results[0];

      // Fetch auction matches with auction details
      const matchesResult = await db
        .prepare(
          `
        SELECT
          aam.alert_history_id,
          aam.auction_id,
          aam.auction_seen_at,
          aam.match_price,
          aam.matched_at,
          a.cpu,
          a.ram,
          a.datacenter,
          a.location,
          a.price,
          a.seen
        FROM
          alert_auction_matches aam
        INNER JOIN
          auctions a ON aam.auction_id = a.id AND aam.auction_seen_at = a.seen
        WHERE
          aam.alert_history_id = ?
          AND aam.auction_id IS NOT NULL
        ORDER BY
          aam.match_price ASC
      `,
        )
        .bind(alertId)
        .all();

      return json({
        alertName: alertHistory.name,
        auctions: matchesResult.results,
      });
    }

    throw error(404, "Alert not found");
  } catch (err) {
    console.error(`Error fetching auction matches for alert ${alertId}:`, err);

    // If the error is already a SvelteKit error response, rethrow it
    if (err && typeof err === "object" && "status" in err) {
      throw err;
    }

    // Otherwise, throw a generic 500 error
    throw error(500, "Failed to fetch auction matches");
  }
}
