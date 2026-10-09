import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCardTools } from "./tools/cards.js";
import { registerSetTools } from "./tools/sets.js";
import { registerDecklistTools } from "./tools/decklist.js";
import { registerPublicDeckTools } from "./tools/public-decks.js";
import { registerProxyTools } from "./tools/proxy.js";
import { registerUserTools } from "./tools/users.js";
import { registerDeckTools } from "./tools/decks.js";
import { registerSimTools } from "./tools/sim.js";
import { registerArtTools } from "./tools/art.js";
import { ANONYMOUS, type McpContext } from "./context.js";

export type { McpContext } from "./context.js";

export function createMcpServer(ctx: McpContext = ANONYMOUS): McpServer {
  const server = new McpServer(
    {
      name: "decklistgen",
      version: "0.2.0",
    },
    {
      capabilities: { tools: {} },
      instructions:
        "DecklistGen MCP server. Browse Pokemon TCG cards, import decklists, and — when connected " +
        "with an API token — manage a player's saved decks: list / find / create / copy / delete, add, " +
        "remove and swap printings, beautify, check legality, queue artwork generation, and run the " +
        "opening-hand and setup simulators (results include a plain-language interpretation). " +
        "Call whoami to see who you are; admins pass actAsUserId to work on another player's decks " +
        "(find them with list_users or find_decks allUsers=true). Cards are addressed by id " +
        "(e.g. 'sv06.5-036', from search_cards). Sets are lazy-loaded — if a search returns nothing, " +
        "call load_set or load_era first. Deleting a deck is irreversible: confirm with the user.",
    },
  );

  registerSetTools(server);
  registerCardTools(server);
  registerDecklistTools(server);
  registerPublicDeckTools(server);
  registerProxyTools(server);
  registerUserTools(server, ctx);
  registerDeckTools(server, ctx);
  registerSimTools(server, ctx);
  registerArtTools(server, ctx);

  return server;
}
