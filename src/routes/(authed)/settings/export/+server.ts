import { getConnectedApps } from "$lib/api/backend/connected-apps";
import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "./$types";

/**
 * GDPR data export.
 *
 * Everything the account owns, in one file. Secrets are deliberately excluded:
 * OAuth client secrets and access/refresh tokens belong to the connected
 * application, not the user, and re-emitting them in a downloadable file would
 * turn a data export into a credential leak. Connected applications are still
 * listed by name and scope so the export shows who has access.
 */
export async function GET(event: RequestEvent) {
  if (!event.locals.user) {
    throw error(401, { message: "Authentication required." });
  }

  const env = event.platform?.env;
  const db = env?.DB;

  if (!db) {
    console.error("Database connection not available for exportData");
    throw error(500, { message: "Database connection error." });
  }

  const userId = event.locals.user.id;

  const rows = async <T>(sql: string, ...binds: unknown[]): Promise<T[]> => {
    const result = await db
      .prepare(sql)
      .bind(...binds)
      .all<T>();
    return result?.results ?? [];
  };

  try {
    const userData = await db
      .prepare(
        `SELECT id, email, name, email_verified, created_at, updated_at,
                discord_webhook_url, webhook_url, notification_preferences
         FROM user WHERE id = ?`,
      )
      .bind(userId)
      .first<Record<string, unknown>>();

    const [
      sessions,
      priceAlerts,
      priceAlertHistoryRaw,
      cloudAlerts,
      cloudAlertHistory,
      connectedApps,
    ] = await Promise.all([
      rows(
        "SELECT id, created_at, updated_at, expires_at, ip_address, user_agent FROM session WHERE user_id = ?",
        userId,
      ),
      rows(
        "SELECT id, name, filter, price, created_at, vat_rate, includes_ipv4_cost, email_notifications, discord_notifications, webhook_notifications FROM price_alert WHERE user_id = ?",
        userId,
      ),
      rows<{ id: string }>(
        "SELECT id, name, filter, price, trigger_price, created_at, triggered_at, vat_rate FROM price_alert_history WHERE user_id = ?",
        userId,
      ),
      rows(
        "SELECT id, name, server_type_ids, location_ids, alert_on, is_armed, email_notifications, discord_notifications, webhook_notifications, created_at FROM cloud_availability_alert WHERE user_id = ?",
        userId,
      ),
      rows(
        "SELECT id, alert_id, server_type_id, server_type_name, location_id, location_name, event_type, triggered_at FROM cloud_alert_history WHERE user_id = ? ORDER BY triggered_at DESC",
        userId,
      ),
      // Applications connected over OAuth. Shares the settings page's helper so
      // both report the same grants — including ones consented to but not yet
      // exchanged for a token. Token and secret values are never included:
      // those are the application's credentials rather than the user's data,
      // and putting them in a downloadable file would make it a credential
      // leak.
      getConnectedApps(db, userId),
    ]);

    // Attach the auctions that triggered each historical price alert.
    const priceAlertHistory = [];
    for (const item of priceAlertHistoryRaw) {
      if (typeof item.id !== "string") {
        console.warn(
          "Skipping price alert history item with invalid ID:",
          item,
        );
        continue;
      }
      priceAlertHistory.push({
        ...item,
        matches: await rows(
          "SELECT auction_id, auction_seen_at, match_price, matched_at FROM alert_auction_matches WHERE alert_history_id = ?",
          item.id,
        ),
      });
    }

    const exportPayload = {
      exported_at: new Date().toISOString(),
      user: userData ?? {},
      sessions,
      price_alerts: priceAlerts,
      price_alert_history: priceAlertHistory,
      cloud_availability_alerts: cloudAlerts,
      cloud_alert_history: cloudAlertHistory,
      connected_applications: connectedApps,
    };

    const filename = `server-radar-export-${new Date().toISOString().slice(0, 10)}.json`;

    return new Response(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        // A data export should never be held by an intermediary cache.
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    console.error("Failed to export data for user:", userId, e);
    const errorMessage =
      e instanceof Error && e.message
        ? e.message
        : "An unknown error occurred.";
    return json(
      {
        message: `An error occurred while exporting your data: ${errorMessage}`,
      },
      { status: 500 },
    );
  }
}
