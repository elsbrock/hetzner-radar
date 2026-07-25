/**
 * Authenticated MCP tools for Hetzner Cloud availability alerts.
 *
 * Distinct from the price alerts in `alert-tools.ts`: those watch the dedicated
 * server auction for a price drop, these watch whether a Cloud plan can be
 * ordered in a given location. Different table, different limit, different
 * matcher — so they are deliberately separate tools rather than a mode flag,
 * which a model would get wrong.
 *
 * Server types and locations are identified by numeric Hetzner IDs, so
 * `cloud_availability` must be called first to discover them; the tool
 * descriptions say so, and unknown IDs are rejected with the valid options
 * listed rather than silently stored.
 */

import {
  createCloudAlert,
  deleteCloudAlert,
  getCloudAlertsForUser,
  isBelowMaxCloudAlerts,
  MAX_CLOUD_ALERTS,
  MAX_NAME_LENGTH,
} from "$lib/api/backend/cloud-alerts";
import type { ToolDefinition } from "./tools";

type AlertOn = "available" | "unavailable" | "both";

interface ServerTypeInfo {
  id: number;
  name: string;
  description?: string;
  cores?: number;
  memory?: number;
  disk?: number;
  cpu_type?: string;
  architecture?: string;
  isDeprecated?: boolean;
}

interface LocationInfo {
  id: number;
  name: string;
  city?: string;
  country?: string;
}

interface CloudStatus {
  serverTypes?: ServerTypeInfo[];
  locations?: LocationInfo[];
  availability?: Record<number, number[]>;
  lastUpdated?: string | null;
}

function requireUser(userId: string | null): string {
  if (!userId) {
    throw new Error(
      "This tool requires a signed-in Server Radar account. Connect this MCP server with an account first.",
    );
  }
  return userId;
}

async function cloudStatus(worker: RadarWorkerService | undefined) {
  if (!worker) throw new Error("Cloud status service is not available.");
  return (await worker.getStatus()) as CloudStatus;
}

/** Reads a numeric ID array from tool arguments, tolerating string input. */
function readIds(value: unknown, field: string): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${field} must be a non-empty array of numeric IDs.`);
  }
  return value.map((v) => {
    const n = Number(v);
    if (!Number.isInteger(n)) {
      throw new Error(
        `${field} must contain integer IDs; got ${JSON.stringify(v)}.`,
      );
    }
    return n;
  });
}

/**
 * Rejects unknown IDs up front. Storing them would create an alert that can
 * never fire, and the user would have no way to tell.
 */
function validateIds(
  requested: number[],
  known: { id: number; name: string }[],
  field: string,
): void {
  const valid = new Set(known.map((k) => k.id));
  const unknown = requested.filter((id) => !valid.has(id));
  if (unknown.length) {
    const options = known.map((k) => `${k.id}=${k.name}`).join(", ");
    throw new Error(
      `Unknown ${field}: ${unknown.join(", ")}. Valid options are: ${options}`,
    );
  }
}

export const listCloudAlertsTool: ToolDefinition = {
  name: "list_cloud_alerts",
  description:
    "List the signed-in user's Hetzner Cloud availability alerts, plus recently triggered ones. " +
    `A user may have at most ${MAX_CLOUD_ALERTS} of these, separately from price alerts.`,
  requiresAuth: true,
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  async handler(_args, ctx) {
    const userId = requireUser(ctx.userId);
    const alerts = await getCloudAlertsForUser(ctx.env.DB, userId);

    // Resolve IDs to names where possible — a bare list of numbers is useless
    // to a model trying to describe the alert back to a user.
    let names: {
      types: Map<number, string>;
      locs: Map<number, string>;
    } | null = null;
    try {
      const status = await cloudStatus(ctx.env.RADAR_WORKER);
      names = {
        types: new Map((status.serverTypes ?? []).map((t) => [t.id, t.name])),
        locs: new Map((status.locations ?? []).map((l) => [l.id, l.name])),
      };
    } catch {
      // Names are a nicety; the alert list still stands without them.
    }

    return {
      active: alerts.activeAlerts.map((a) => ({
        id: a.id,
        name: a.name,
        server_types: a.server_type_ids.map((id) => ({
          id,
          name: names?.types.get(id) ?? null,
        })),
        locations: a.location_ids.map((id) => ({
          id,
          name: names?.locs.get(id) ?? null,
        })),
        alert_on: a.alert_on,
        // Alerts disarm after firing and re-arm when the condition clears, so
        // "not armed" explains why a live alert is currently silent.
        is_armed: a.is_armed,
        notifications: {
          email: a.email_notifications,
          discord: a.discord_notifications,
          webhook: a.webhook_notifications,
        },
        created_at: a.created_at,
      })),
      triggered: alerts.triggeredAlerts.map((h) => ({
        id: h.id,
        alert_id: h.alert_id,
        server_type: h.server_type_name,
        location: h.location_name,
        event: h.event_type,
        triggered_at: h.triggered_at,
      })),
      max_active_alerts: MAX_CLOUD_ALERTS,
    };
  },
};

export const createCloudAlertTool: ToolDefinition = {
  name: "create_cloud_alert",
  description:
    "Create an alert for Hetzner Cloud plan availability — notify when a given server type becomes orderable (or stops being orderable) in a given location. " +
    "This is Hetzner Cloud, NOT the dedicated server auction; use create_alert for auction price alerts. " +
    "Server types and locations are numeric Hetzner IDs: call cloud_availability first to look them up. " +
    `A user may have at most ${MAX_CLOUD_ALERTS} cloud alerts.`,
  requiresAuth: true,
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        maxLength: MAX_NAME_LENGTH,
        description: "Short label for the alert.",
      },
      server_type_ids: {
        type: "array",
        items: { type: "integer" },
        description:
          "Numeric Hetzner Cloud server type IDs (e.g. CX22, CCX13). Get these from cloud_availability — names are not accepted.",
      },
      location_ids: {
        type: "array",
        items: { type: "integer" },
        description:
          "Numeric Hetzner location IDs (e.g. Falkenstein, Helsinki). Get these from cloud_availability.",
      },
      alert_on: {
        type: "string",
        enum: ["available", "unavailable", "both"],
        description:
          "Fire when the plan becomes available (default), becomes unavailable, or on either transition.",
      },
      email_notifications: {
        type: "boolean",
        description: "Notify by email. Defaults to true.",
      },
      discord_notifications: {
        type: "boolean",
        description: "Notify via the user's configured Discord webhook.",
      },
      webhook_notifications: {
        type: "boolean",
        description: "Notify via the user's configured generic webhook.",
      },
    },
    required: ["name", "server_type_ids", "location_ids"],
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

    const serverTypeIds = readIds(args.server_type_ids, "server_type_ids");
    const locationIds = readIds(args.location_ids, "location_ids");

    const status = await cloudStatus(ctx.env.RADAR_WORKER);
    validateIds(serverTypeIds, status.serverTypes ?? [], "server_type_ids");
    validateIds(locationIds, status.locations ?? [], "location_ids");

    const alertOn = (args.alert_on as AlertOn | undefined) ?? "available";
    if (!["available", "unavailable", "both"].includes(alertOn)) {
      throw new Error("alert_on must be one of: available, unavailable, both.");
    }

    if (!(await isBelowMaxCloudAlerts(ctx.env.DB, userId))) {
      throw new Error(
        `You already have the maximum of ${MAX_CLOUD_ALERTS} cloud availability alerts. Delete one with delete_cloud_alert before creating another.`,
      );
    }

    const email = args.email_notifications !== false;
    const discord = args.discord_notifications === true;
    const webhook = args.webhook_notifications === true;
    if (!email && !discord && !webhook) {
      throw new Error("At least one notification method must be enabled.");
    }

    const id = await createCloudAlert(
      ctx.env.DB,
      userId,
      name,
      serverTypeIds,
      locationIds,
      alertOn,
      email,
      discord,
      webhook,
    );

    const typeNames = new Map(
      (status.serverTypes ?? []).map((t) => [t.id, t.name]),
    );
    const locNames = new Map(
      (status.locations ?? []).map((l) => [l.id, l.name]),
    );

    return {
      created: true,
      id,
      name,
      alert_on: alertOn,
      server_types: serverTypeIds.map((i) => ({
        id: i,
        name: typeNames.get(i) ?? null,
      })),
      locations: locationIds.map((i) => ({
        id: i,
        name: locNames.get(i) ?? null,
      })),
    };
  },
};

export const deleteCloudAlertTool: ToolDefinition = {
  name: "delete_cloud_alert",
  description:
    "Delete one of the signed-in user's Hetzner Cloud availability alerts by ID. Use list_cloud_alerts to find the ID. " +
    "This does not touch auction price alerts — use delete_alert for those.",
  requiresAuth: true,
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Alert ID from list_cloud_alerts." },
    },
    required: ["id"],
    additionalProperties: false,
  },
  async handler(args, ctx) {
    const userId = requireUser(ctx.userId);
    const id = String(args.id ?? "").trim();
    if (!id) throw new Error("Alert id is required.");

    // Argument order here is (db, userId, alertId) — the reverse of the price
    // alert helper's (db, alertId, userId). Both scope the DELETE by user.
    await deleteCloudAlert(ctx.env.DB, userId, id);
    return { deleted: true, id };
  },
};

export const CLOUD_ALERT_TOOLS: ToolDefinition[] = [
  listCloudAlertsTool,
  createCloudAlertTool,
  deleteCloudAlertTool,
];
