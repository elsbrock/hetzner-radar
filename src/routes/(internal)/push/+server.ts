import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import type { RequestHandler } from "@sveltejs/kit";
import {
  prepareServerData,
  findMatchingAlerts,
  groupAlertsByAlertId,
  processAlert,
  type RawServerData
} from "$lib/api/backend/alerts-push";

/**
 * Validates the incoming request for authentication and content type
 */
function validateRequest(request: Request): { isValid: boolean; errorResponse?: Response } {
  // Verify API key is present
  const authKey = request.headers.get("x-auth-key");
  if (!dev && (!authKey || authKey !== env.API_KEY)) {
    return {
      isValid: false,
      errorResponse: new Response(null, {
        status: 401,
        statusText: "Unauthorized",
      }),
    };
  }

  // Verify it's JSON
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return {
      isValid: false,
      errorResponse: new Response(null, {
        status: 400,
        statusText: "Bad Request",
      }),
    };
  }

  return { isValid: true };
}

/**
 * POST handler for the push endpoint
 * 
 * This endpoint receives server data from Hetzner, processes it, and triggers alerts
 * when matching servers are found. It also stores matched auctions for each alert.
 */
export const POST: RequestHandler = async (event) => {
  const start = performance.now();
  const request = event.request;

  // Validate the request
  const validation = validateRequest(request);
  if (!validation.isValid) {
    return validation.errorResponse!;
  }

  const db = event.platform?.env.DB;
  if (!db) {
    return new Response(null, {
      status: 500,
      statusText: "Internal Server Error",
    });
  }

  try {
    // Parse the request body
    const configs = await request.json() as RawServerData[];
    
    // Prepare server data for insertion
    const auctionBatch = await prepareServerData(db, configs);
    
    // Insert server data into auctions table
    await db.batch(auctionBatch);
    
    // Find matching alerts
    const matchedAlerts = await findMatchingAlerts(db);
    
    // Group matched alerts by alert ID
    const alertMap = groupAlertsByAlertId(matchedAlerts);
    
    // Process each alert
    for (const [_, data] of alertMap.entries()) {
      await processAlert(db, event.platform, data.alertInfo, data.matchedAuctions);
    }

    // Return response
    return new Response(JSON.stringify({
      servers: configs.length,
      alerts: alertMap.size,
      matches: matchedAlerts.length,
      time: performance.now() - start,
    }));
  } catch (error) {
    console.error("Error processing push request:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
};
