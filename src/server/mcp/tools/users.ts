import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listAllUsers } from "../../services/user-store.js";
import { asJson } from "../util.js";
import { requireUser, fail, type McpContext } from "../context.js";

export function registerUserTools(server: McpServer, ctx: McpContext): void {
  server.registerTool(
    "whoami",
    {
      title: "Who am I",
      description:
        "Return the user this MCP connection is authenticated as (id, display name, role flags), " +
        "or an error if the connection is anonymous. Call this first when you need to touch decks.",
      inputSchema: {},
    },
    async () => {
      const r = requireUser(ctx);
      if (!r.ok) return r.result;
      const { id, email, displayName, isAdmin, isAuthorized } = r.value;
      return asJson({ id, email, displayName, isAdmin, isAuthorized });
    },
  );

  server.registerTool(
    "list_users",
    {
      title: "List users (admin)",
      description:
        "Admin only. List every account (id, email, display name, role flags) so you can find a " +
        "player and then pass their id as actAsUserId to the deck tools.",
      inputSchema: {
        query: z.string().optional().describe("Optional case-insensitive filter on email or display name."),
      },
    },
    async ({ query }) => {
      const r = requireUser(ctx);
      if (!r.ok) return r.result;
      if (!r.value.isAdmin) return fail("Admin access required");
      const q = query?.trim().toLowerCase();
      const users = listAllUsers()
        .filter((u) => !q || u.email.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q))
        .map(({ id, email, displayName, isAdmin, isAuthorized, createdAt }) => ({ id, email, displayName, isAdmin, isAuthorized, createdAt }));
      return asJson({ users, total: users.length });
    },
  );
}
