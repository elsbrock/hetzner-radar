/**
 * Authenticated MCP tools for price-alert management.
 *
 * These are listed only when the request carries a valid MCP access token; the
 * read tools stay public. They take the same flat query schema as
 * `search_auctions`, so an agent can search and then say "alert me if this
 * drops below X" using the identical parameters.
 */

import {
  createAlert,
  deleteAlert,
  getAlertsForUser,
  isBelowMaxAlerts,
  MAX_ALERTS,
  MAX_NAME_LENGTH,
} from "$lib/api/backend/alerts";
import {
  buildServerFilter,
  netEurToStoredPrice,
  serializeFilter,
} from "./filter";
import type { AuctionQuery } from "./search";
import type { ToolDefinition } from "./tools";

import { ALERT_QUERY_PROPERTIES } from "./tools";

/**
 * Reads only the keys the alert schema advertises. Search-only parameters are
 * absent from that schema, so they cannot leak into a filter that could not
 * honour them.
 */
function readAlertQuery(args: Record<string, unknown>): AuctionQuery {
  const q: AuctionQuery = {};
  for (const key of Object.keys(ALERT_QUERY_PROPERTIES)) {
    if (args[key] !== undefined && args[key] !== null) {
      (q as Record<string, unknown>)[key] = args[key];
    }
  }
  return q;
}

function requireUser(userId: string | null): string {
  if (!userId) {
    throw new Error(
      "This tool requires a signed-in Server Radar account. Connect this MCP server with an account first.",
    );
  }
  return userId;
}

export const listAlertsTool: ToolDefinition = {
  name: "list_alerts",
  description:
    "List the signed-in user's Server Radar price alerts, both active ones and those that have already been triggered. " +
    `A user may have at most ${MAX_ALERTS} active alerts.`,
  requiresAuth: true,
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  async handler(_args, ctx) {
    const userId = requireUser(ctx.userId);
    const alerts = await getAlertsForUser(ctx.env.DB, userId);

    return {
      active: alerts.activeResults.map((a) => ({
        id: a.id,
        name: a.name,
        // Stated in full because the stored number is gross and VAT-inclusive,
        // which is not what search_auctions filters on.
        target_price_eur_gross: a.price,
        vat_rate_percent: a.vat_rate,
        includes_ipv4: true,
        notifications: {
          email: a.email_notifications,
          discord: a.discord_notifications,
          webhook: a.webhook_notifications,
        },
        created_at: a.created_at,
      })),
      triggered: alerts.triggeredResults.map((a) => ({
        id: a.id,
        name: a.name,
        target_price_eur_gross: a.price,
        trigger_price_eur_gross: a.trigger_price,
        triggered_at: a.triggered_at,
      })),
      max_active_alerts: MAX_ALERTS,
    };
  },
};

export const createAlertTool: ToolDefinition = {
  name: "create_alert",
  description:
    "Create a Server Radar price alert. The user is notified when a matching auction server drops to or below the target price. " +
    "Hardware criteria use the same parameters as search_auctions, so you can search first and then create an alert from the same values. " +
    `A user may have at most ${MAX_ALERTS} active alerts. ` +
    "max_price_eur is NET (server + IPv4, before VAT) — the same basis search_auctions filters on; VAT is applied internally using vat_rate_percent.",
  requiresAuth: true,
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        maxLength: MAX_NAME_LENGTH,
        description: "Short label for the alert, unique per user.",
      },
      max_price_eur: {
        type: "number",
        description:
          "Target monthly price in EUR, NET of VAT and including the IPv4 address. Notify when a match costs this or less.",
      },
      vat_rate_percent: {
        type: "number",
        description:
          "VAT rate as a PERCENTAGE (e.g. 19 for Germany, 0 for none). Defaults to 0. Note this is a percentage, not a decimal.",
      },
      ...ALERT_QUERY_PROPERTIES,
      email_notifications: {
        type: "boolean",
        description: "Notify by email. Defaults to true.",
      },
      discord_notifications: {
        type: "boolean",
        description:
          "Notify via the user's configured Discord webhook. Requires one to be set in settings.",
      },
      webhook_notifications: {
        type: "boolean",
        description:
          "Notify via the user's configured generic webhook. Requires one to be set in settings.",
      },
    },
    required: ["name", "max_price_eur"],
    additionalProperties: false,
  },
  async handler(args, ctx) {
    const userId = requireUser(ctx.userId);

    const name = String(args.name ?? "").trim();
    if (!name) throw new Error("Alert name is required.");
    if (name.length > MAX_NAME_LENGTH) {
      throw new Error(
        `Alert name must be at most ${MAX_NAME_LENGTH} characters.`,
      );
    }

    const netPrice = Number(args.max_price_eur);
    if (!Number.isFinite(netPrice) || netPrice <= 0) {
      throw new Error("max_price_eur must be a positive number of euros.");
    }

    const vatRate = Number(args.vat_rate_percent ?? 0);
    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
      throw new Error(
        "vat_rate_percent must be a percentage between 0 and 100 (e.g. 19), not a decimal.",
      );
    }

    if (!(await isBelowMaxAlerts(ctx.env.DB, userId))) {
      throw new Error(
        `You already have the maximum of ${MAX_ALERTS} active alerts. Delete one with delete_alert before creating another.`,
      );
    }

    const email = args.email_notifications !== false;
    const discord = args.discord_notifications === true;
    const webhook = args.webhook_notifications === true;
    if (!email && !discord && !webhook) {
      throw new Error("At least one notification method must be enabled.");
    }

    const filter = buildServerFilter(readAlertQuery(args));
    const storedPrice = netEurToStoredPrice(netPrice, vatRate);

    try {
      await createAlert(
        ctx.env.DB,
        userId,
        name,
        serializeFilter(filter),
        String(storedPrice),
        vatRate,
        email,
        discord,
        webhook,
      );
    } catch (error) {
      // The UNIQUE indexes on (user_id, name) and (user_id, filter) are the
      // likely cause; say so rather than surfacing a raw SQL error.
      console.error("[mcp] create_alert failed:", error);
      throw new Error(
        "Could not create the alert. An alert with the same name, or the same set of criteria, may already exist.",
        { cause: error },
      );
    }

    return {
      created: true,
      name,
      target_price_eur_gross: storedPrice,
      target_price_eur_net: netPrice,
      vat_rate_percent: vatRate,
      filter,
    };
  },
};

export const deleteAlertTool: ToolDefinition = {
  name: "delete_alert",
  description:
    "Delete one of the signed-in user's price alerts by its ID. Use list_alerts first to find the ID.",
  requiresAuth: true,
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Alert ID from list_alerts." },
    },
    required: ["id"],
    additionalProperties: false,
  },
  async handler(args, ctx) {
    const userId = requireUser(ctx.userId);
    const id = String(args.id ?? "").trim();
    if (!id) throw new Error("Alert id is required.");

    // Note the argument order: deleteAlert takes (db, alertId, userId).
    // Its SQL scopes by user_id, so one user cannot delete another's alert.
    await deleteAlert(ctx.env.DB, id, userId);
    return { deleted: true, id };
  },
};

export const AUTHED_TOOLS: ToolDefinition[] = [
  listAlertsTool,
  createAlertTool,
  deleteAlertTool,
];
