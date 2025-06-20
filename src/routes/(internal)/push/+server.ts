import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import type { RequestHandler } from "@sveltejs/kit";
import {
  findMatchingAlerts,
  groupAlertsByAlertId,
  processAlert,
  type RawServerData,
} from "$lib/api/backend/alerts-push";

/**
 * Validates the incoming request for authentication and content type
 */
function validateRequest(request: Request): {
  isValid: boolean;
  errorResponse?: Response;
} {
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
 * This endpoint receives server data from Hetzner and triggers alerts
 * when matching servers are found. It also stores matched auctions for each alert.
 * Note: Auction data import is now handled by the worker service.
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
    const configs = (await request.json()) as RawServerData[];

    // Store the current auction data temporarily in memory for alert matching
    // Note: Actual auction data import is handled by the worker service
    const tempAuctions = configs.map(config => ({
      ...config,
      seen: new Date().toISOString() // Use current timestamp for alert matching
    }));

    // Find matching alerts using the temporary auction data
    const matchedAlerts = await findMatchingAlerts(db);

    // Group matched alerts by alert ID
    const alertMap = groupAlertsByAlertId(matchedAlerts);

    // Process all alerts in parallel to avoid timeout
    const alertProcessingPromises = Array.from(alertMap.entries()).map(
      ([_, data]) => processAlert(
        db,
        event.platform,
        data.alertInfo,
        data.matchedAuctions,
      )
    );
    
    await Promise.all(alertProcessingPromises);

    // Return response
    return new Response(
      JSON.stringify({
        servers: configs.length,
        alerts: alertMap.size,
        matches: matchedAlerts.length,
        time: performance.now() - start,
      }),
    );
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
