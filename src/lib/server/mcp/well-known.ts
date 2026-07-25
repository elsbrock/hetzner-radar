/**
 * Shared plumbing for the root-level OAuth discovery documents.
 *
 * Better Auth only serves these under its own basePath (/api/auth/.well-known/…),
 * but RFC 8414 / RFC 9728 and the MCP authorization spec have clients look at
 * the origin root. Without root routes a client fetches
 * `/.well-known/oauth-authorization-server`, receives the SvelteKit 404 page,
 * and reports that it could not register with the sign-in service.
 */

import { getAuth } from "$lib/server/auth";
import { error, type RequestEvent } from "@sveltejs/kit";

export const WELL_KNOWN_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type MetadataHandler = (request: Request) => Promise<Response>;

/**
 * Runs a Better Auth metadata handler and re-emits it CORS-open — these
 * documents are fetched cross-origin by MCP clients, so a same-origin-only
 * response is useless to them.
 */
export async function serveMetadata(
  event: RequestEvent,
  build: (auth: ReturnType<typeof getAuth>) => MetadataHandler,
): Promise<Response> {
  const env = event.platform?.env;
  if (!env?.DB) error(503, "Auth service unavailable.");

  const response = await build(getAuth(env))(event.request);

  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(WELL_KNOWN_CORS)) {
    headers.set(key, value);
  }

  return new Response(response.body, { status: response.status, headers });
}

export const preflight = (): Response =>
  new Response(null, { status: 204, headers: WELL_KNOWN_CORS });
