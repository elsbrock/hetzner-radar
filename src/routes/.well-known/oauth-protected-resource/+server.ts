/**
 * OAuth protected resource metadata (RFC 9728) at the origin root.
 *
 * Tells an MCP client which authorization server guards /mcp. Clients following
 * the older convention fetch this bare path; newer ones append the resource
 * path (/.well-known/oauth-protected-resource/mcp), which is handled by the
 * sibling [...resource] route.
 */

import { preflight, serveMetadata } from "$lib/server/mcp/well-known";
import { oAuthProtectedResourceMetadata } from "better-auth/plugins";
import type { RequestHandler } from "./$types";

export const OPTIONS: RequestHandler = async () => preflight();

export const GET: RequestHandler = async (event) =>
  serveMetadata(event, (auth) => oAuthProtectedResourceMetadata(auth));
