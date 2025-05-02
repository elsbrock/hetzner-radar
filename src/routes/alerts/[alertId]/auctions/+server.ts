import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * GET handler for fetching auctions that matched a specific alert
 * 
 * This endpoint retrieves auction matches for a triggered alert from the alert_auction_matches table,
 * joined with the auctions table to get full auction details.
 */
export async function GET({ params, locals, platform }: RequestEvent) {
  // Ensure user is authenticated
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }

  const { alertId } = params;
  if (!alertId) {
    throw error(400, 'Alert ID is required');
  }

  const db = platform?.env.DB;
  if (!db) {
    throw error(500, 'Database connection failed');
  }

  try {
    // First verify that the alert belongs to the current user
    const alertHistoryResult = await db.prepare(`
      SELECT id, name, user_id 
      FROM price_alert_history 
      WHERE id = ?
    `)
    .bind(alertId)
    .all();

    // Check if we found the alert in history
    if (alertHistoryResult.results.length > 0) {
      const alertHistory = alertHistoryResult.results[0];
      
      // Verify ownership
      if (alertHistory.user_id !== locals.user.id.toString()) {
        throw error(403, 'You do not have permission to view this alert');
      }

      // Fetch auction matches with auction details
      const matchesResult = await db.prepare(`
        SELECT 
          aam.id,
          aam.alert_history_id,
          aam.auction_id,
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
        JOIN 
          auctions a ON aam.auction_id = a.id
        WHERE 
          aam.alert_history_id = ?
        ORDER BY 
          aam.match_price ASC
      `)
      .bind(alertId)
      .all();

      return json({
        alertName: alertHistory.name,
        auctions: matchesResult.results
      });
    } 
    
    // If not found in history, check active alerts
    const activeAlertResult = await db.prepare(`
      SELECT id, name, user_id 
      FROM price_alert 
      WHERE id = ?
    `)
    .bind(alertId)
    .all();

    if (activeAlertResult.results.length > 0) {
      const activeAlert = activeAlertResult.results[0];
      
      // Verify ownership
      if (activeAlert.user_id !== locals.user.id.toString()) {
        throw error(403, 'You do not have permission to view this alert');
      }

      // For active alerts, we don't have matches yet
      return json({
        alertName: activeAlert.name,
        auctions: []
      });
    }
    
    // If we get here, the alert wasn't found in either table
    // Throw a 404 error so the client can handle it properly
    throw error(404, 'Alert not found');
  } catch (err) {
    console.error(`Error fetching auction matches for alert ${alertId}:`, err);
    
    // If the error is already a SvelteKit error response, rethrow it
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    
    // Otherwise, throw a generic 500 error
    throw error(500, 'Failed to fetch auction matches');
  }
}