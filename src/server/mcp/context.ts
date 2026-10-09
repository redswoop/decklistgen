import type { User } from "../../shared/types/user.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { findUserById } from "../services/user-store.js";
import { asJson } from "./util.js";

/**
 * Per-request identity for the MCP server. `user` is null for anonymous
 * callers (stdio transport with no token, or an unauthenticated HTTP hit); the
 * browse tools still work, the deck / art / sim tools refuse.
 */
export interface McpContext {
  user: User | null;
}

export const ANONYMOUS: McpContext = { user: null };

export type Resolved<T> = { ok: true; value: T } | { ok: false; result: CallToolResult };

export function fail(message: string): CallToolResult {
  return asJson({ error: message }, true);
}

export function requireUser(ctx: McpContext): Resolved<User> {
  if (!ctx.user) {
    return {
      ok: false,
      result: fail(
        "Authentication required. Connect with an API token (Authorization: Bearer dg_… " +
          "or the /api/mcp/t/<token> URL). Mint one from the user menu → API Tokens.",
      ),
    };
  }
  return { ok: true, value: ctx.user };
}

export function requireAuthorizedUser(ctx: McpContext): Resolved<User> {
  const r = requireUser(ctx);
  if (!r.ok) return r;
  if (!r.value.isAuthorized && !r.value.isAdmin) {
    return { ok: false, result: fail("Authorized access required for this action (free-tier account).") };
  }
  return r;
}

/**
 * Which user's decks a tool call operates on. Mirrors the REST `X-Act-As-User`
 * header: admins may name another user; everyone else gets themselves.
 */
export function effectiveUserId(ctx: McpContext, actAsUserId?: string): Resolved<string> {
  const r = requireUser(ctx);
  if (!r.ok) return r;
  const user = r.value;
  if (!actAsUserId || actAsUserId === user.id) return { ok: true, value: user.id };
  if (!user.isAdmin) return { ok: false, result: fail("Admin access required to act as another user") };
  if (!findUserById(actAsUserId)) return { ok: false, result: fail(`Target user not found: ${actAsUserId}`) };
  return { ok: true, value: actAsUserId };
}
