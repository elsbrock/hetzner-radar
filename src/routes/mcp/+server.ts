/**
 * Public MCP server (Streamable HTTP, stateless).
 *
 * Only three JSON-RPC methods carry weight — initialize, tools/list,
 * tools/call — so this is hand-rolled rather than pulling in the MCP SDK,
 * whose HTTP transport is Node-oriented and would not run on Workers.
 *
 * Statelessness is deliberate: every request is self-contained, so no Durable
 * Object or session store is involved and the endpoint scales like any other
 * Worker route.
 */

import { resolveMcpUser } from "$lib/server/mcp/auth";
import { SnapshotUnavailableError } from "$lib/server/mcp/snapshot";
import { lookupTool, toolsFor } from "$lib/server/mcp/registry";
import type { ToolContext } from "$lib/server/mcp/tools";
import type { RequestHandler } from "./$types";

/** Newest first. We echo the client's version when we support it. */
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const DEFAULT_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

const SERVER_INFO = {
  name: "hetzner-server-radar",
  title: "Hetzner Server Radar",
  version: "1.0.0",
};

const INSTRUCTIONS =
  "Tracks Hetzner's dedicated server auction (Serverbörse) and Hetzner Cloud availability. " +
  "Use search_auctions to find currently listed dedicated servers by hardware and price, " +
  "get_auction for one listing by ID, and cloud_availability for Hetzner Cloud plans. " +
  "All prices are EUR and net of VAT; total_monthly_net already includes the mandatory IPv4 address. " +
  "Auction data refreshes about every 5 minutes. " +
  "Server Radar is an independent project and is not affiliated with Hetzner.";

// JSON-RPC 2.0 reserved codes.
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: string;
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
) {
  return {
    jsonrpc: "2.0",
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

function json(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

function negotiateVersion(params: Record<string, unknown> | undefined): string {
  const requested = params?.protocolVersion;
  if (
    typeof requested === "string" &&
    SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
  ) {
    return requested;
  }
  return DEFAULT_PROTOCOL_VERSION;
}

/**
 * Turns a thrown error into an MCP tool error. Tool failures are reported as a
 * successful JSON-RPC response with isError set — that is what lets a model see
 * the message and adapt, rather than the client treating it as transport
 * breakage.
 */
function toolErrorResult(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Tool execution failed.";
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

async function handleRpc(
  request: JsonRpcRequest,
  ctx: ToolContext,
): Promise<unknown | null> {
  const id = request.id ?? null;

  switch (request.method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: negotiateVersion(request.params),
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });

    // Notifications carry no id and must not get a response body.
    case "notifications/initialized":
    case "notifications/cancelled":
      return null;

    case "ping":
      return rpcResult(id, {});

    case "tools/list":
      return rpcResult(id, {
        tools: toolsFor(ctx.userId).map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      });

    case "tools/call": {
      const name = request.params?.name;
      const args = (request.params?.arguments ?? {}) as Record<string, unknown>;

      if (typeof name !== "string") {
        return rpcError(id, INVALID_PARAMS, "Tool name is required.");
      }

      const found = lookupTool(name, ctx.userId);

      if (found.status === "requires_auth") {
        return rpcError(
          id,
          INVALID_REQUEST,
          `Tool '${name}' requires you to be signed in to Server Radar. Connect this MCP server with an account to manage alerts.`,
        );
      }
      if (found.status === "unknown") {
        return rpcError(id, METHOD_NOT_FOUND, `Unknown tool: ${name}`);
      }

      try {
        const output = await found.tool.handler(args, ctx);
        return rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        });
      } catch (error) {
        if (error instanceof SnapshotUnavailableError) {
          console.error("[mcp] snapshot unavailable:", error.message);
        } else {
          console.error(`[mcp] tool '${name}' failed:`, error);
        }
        return rpcResult(id, toolErrorResult(error));
      }
    }

    default:
      return rpcError(
        id,
        METHOD_NOT_FOUND,
        `Unsupported method: ${request.method}`,
      );
  }
}

export const OPTIONS: RequestHandler = async () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

/**
 * Streamable HTTP defines GET for opening a server-initiated SSE stream. This
 * server is stateless and never initiates anything, so it declines rather than
 * holding a connection open.
 */
export const GET: RequestHandler = async () =>
  json(
    rpcError(null, INVALID_REQUEST, "This MCP server is stateless; use POST."),
    405,
    { Allow: "POST, OPTIONS" },
  );

export const POST: RequestHandler = async (event) => {
  const env = event.platform?.env;
  if (!env) {
    return json(
      rpcError(null, INTERNAL_ERROR, "Server environment unavailable."),
      503,
    );
  }

  let payload: unknown;
  try {
    payload = await event.request.json();
  } catch {
    return json(rpcError(null, PARSE_ERROR, "Invalid JSON."), 400);
  }

  const userId = await resolveMcpUser(event);
  const ctx: ToolContext = { env, userId };

  // A batch is an array; a single call is an object. Both are valid JSON-RPC.
  const batch = Array.isArray(payload) ? payload : [payload];

  if (batch.length === 0) {
    return json(rpcError(null, INVALID_REQUEST, "Empty batch."), 400);
  }

  const responses: unknown[] = [];
  for (const entry of batch) {
    if (typeof entry !== "object" || entry === null) {
      responses.push(
        rpcError(null, INVALID_REQUEST, "Invalid request object."),
      );
      continue;
    }

    const response = await handleRpc(entry as JsonRpcRequest, ctx);
    if (response !== null) responses.push(response);
  }

  // All-notifications batch: acknowledge with no body, per JSON-RPC.
  if (responses.length === 0) {
    return new Response(null, { status: 202, headers: CORS_HEADERS });
  }

  const body = Array.isArray(payload) ? responses : responses[0];

  // Responses can carry per-user alert data, and POST is not cacheable by
  // default anyway — be explicit rather than rely on that.
  return json(body, 200, { "Cache-Control": "no-store" });
};
