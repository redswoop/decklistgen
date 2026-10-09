#!/usr/bin/env bun
/**
 * DecklistGen MCP server (stdio transport).
 *
 * Used by MCP clients (Claude Desktop, Claude Code, etc.) to invoke DecklistGen
 * tools over a long-running subprocess, against this checkout's own data/ and
 * cache/. Example Claude Desktop entry:
 *
 *   {
 *     "mcpServers": {
 *       "decklistgen": {
 *         "command": "bun",
 *         "args": ["/path/to/decklistgen/cli/mcp.ts"],
 *         "env": { "DECKLISTGEN_API_TOKEN": "dg_…" }
 *       }
 *     }
 *   }
 *
 * Without DECKLISTGEN_API_TOKEN the server is anonymous: browse tools work,
 * deck / art / sim tools refuse. Mint a token from the web UI (user menu →
 * API Tokens). For the running server (local or NAS) prefer the HTTP endpoint:
 *   claude mcp add --transport http decklistgen https://<host>/api/mcp \
 *     --header "Authorization: Bearer dg_…"
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "../src/server/mcp/server.js";
import { validateApiToken } from "../src/server/services/api-token-store.js";

async function main(): Promise<void> {
  const token = process.env.DECKLISTGEN_API_TOKEN;
  const user = token ? validateApiToken(token) : null;
  if (token && !user) {
    console.error("DECKLISTGEN_API_TOKEN is set but not valid for this data/ directory — running anonymously.");
  }
  const server = createMcpServer({ user });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server failed:", err);
  process.exit(1);
});
