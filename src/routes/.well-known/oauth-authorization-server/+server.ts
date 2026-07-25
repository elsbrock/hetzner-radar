/**
 * OAuth authorization server metadata (RFC 8414) at the issuer root.
 * See src/lib/server/mcp/well-known.ts for why this route has to exist.
 */

import { preflight, serveMetadata } from "$lib/server/mcp/well-known";
import { oAuthDiscoveryMetadata } from "better-auth/plugins";
import type { RequestHandler } from "./$types";

export const OPTIONS: RequestHandler = async () => preflight();

export const GET: RequestHandler = async (event) =>
  serveMetadata(event, (auth) => oAuthDiscoveryMetadata(auth));
