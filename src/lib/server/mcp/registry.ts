/**
 * The full tool registry.
 *
 * Kept separate from `tools.ts` so the public read tools and the authenticated
 * alert tools can import shared types without a circular dependency, and so
 * registration is explicit rather than an import side effect that bundlers are
 * free to drop.
 */

import { AUTHED_TOOLS } from "./alert-tools";
import { PUBLIC_TOOLS, type ToolDefinition } from "./tools";

export { AUTHED_TOOLS, PUBLIC_TOOLS };

/**
 * Tools visible for a given request. The server is public by default:
 * unauthenticated callers see the read tools, and presenting a valid MCP access
 * token additionally exposes alert management.
 */
export function toolsFor(userId: string | null): ToolDefinition[] {
  return userId ? [...PUBLIC_TOOLS, ...AUTHED_TOOLS] : [...PUBLIC_TOOLS];
}

export type ToolLookup =
  | { status: "ok"; tool: ToolDefinition }
  | { status: "requires_auth" }
  | { status: "unknown" };

/**
 * Resolves a tool name for a request. Distinguishing "needs sign-in" from "does
 * not exist" lets a model tell the user to connect an account rather than
 * concluding the capability is absent.
 */
export function lookupTool(name: string, userId: string | null): ToolLookup {
  const visible = toolsFor(userId).find((t) => t.name === name);
  if (visible) return { status: "ok", tool: visible };

  if (AUTHED_TOOLS.some((t) => t.name === name)) {
    return { status: "requires_auth" };
  }

  return { status: "unknown" };
}
