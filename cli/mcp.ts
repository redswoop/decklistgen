#!/usr/bin/env bun
/**
 * DecklistGen MCP server (stdio transport).
 *
 * Used by MCP clients (Claude Desktop, Claude Code, etc.) to invoke DecklistGen
 * tools over a long-running subprocess. Example Claude Desktop entry:
 *
 *   {
 *     "mcpServers": {
 *       "decklistgen": {
 *         "command": "bun",
 *         "args": ["/path/to/decklistgen/cli/mcp.ts"]
 *       }
 *     }
 *   }
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "../src/server/mcp/server.js";

async function main(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server failed:", err);
  process.exit(1);
});
