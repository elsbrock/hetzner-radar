/**
 * Resolves the Server Radar user behind an MCP request, if any.
 *
 * The MCP server is public by default: read tools work with no credentials at
 * all. Presenting a valid OAuth access token additionally unlocks alert
 * management. Anything unparseable or expired is treated as anonymous rather
 * than as an error — a bad token should degrade to the public surface, not
 * break the whole session.
 */

import { getAuth } from "$lib/server/auth";
import type { RequestEvent } from "@sveltejs/kit";

export async function resolveMcpUser(
  event: RequestEvent,
): Promise<string | null> {
  const env = event.platform?.env;
  if (!env?.DB) return null;

  // No Authorization header at all is the common case — the public surface.
  if (!event.request.headers.get("authorization")) return null;

  try {
    const session = await getAuth(env).api.getMcpSession({
      headers: event.request.headers,
    });
    return session?.userId ?? null;
  } catch (error) {
    console.warn("[mcp] failed to resolve MCP session:", error);
    return null;
  }
}
