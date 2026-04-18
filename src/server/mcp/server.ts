import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCardTools } from "./tools/cards.js";
import { registerSetTools } from "./tools/sets.js";
import { registerDecklistTools } from "./tools/decklist.js";
import { registerPublicDeckTools } from "./tools/public-decks.js";
import { registerProxyTools } from "./tools/proxy.js";

export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "decklistgen",
      version: "0.1.0",
    },
    {
      capabilities: { tools: {} },
      instructions:
        "DecklistGen MCP server. Browse Pokemon TCG cards, import decklists, " +
        "and render proxy previews. Call list_sets first to see what's available, " +
        "then search_cards to find specific cards. Sets are lazy-loaded — if a " +
        "search returns nothing, call load_set or load_era first.",
    },
  );

  registerSetTools(server);
  registerCardTools(server);
  registerDecklistTools(server);
  registerPublicDeckTools(server);
  registerProxyTools(server);

  return server;
}
