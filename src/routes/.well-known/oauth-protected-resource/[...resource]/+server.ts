/**
 * RFC 9728 locates resource metadata by appending the resource's path to the
 * well-known prefix, so a resource at /mcp is described at
 * /.well-known/oauth-protected-resource/mcp. Clients differ on which form they
 * request; both return the same document.
 */

import { preflight, serveMetadata } from "$lib/server/mcp/well-known";
import { oAuthProtectedResourceMetadata } from "better-auth/plugins";
import type { RequestHandler } from "./$types";

export const OPTIONS: RequestHandler = async () => preflight();

export const GET: RequestHandler = async (event) =>
  serveMetadata(event, (auth) => oAuthProtectedResourceMetadata(auth));
