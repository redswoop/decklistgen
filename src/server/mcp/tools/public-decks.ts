import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listPublicDecks, getDeck } from "../../services/deck-store.js";
import { asJson } from "../util.js";

export function registerPublicDeckTools(server: McpServer): void {
  server.registerTool(
    "list_public_decks",
    {
      title: "List public decks",
      description:
        "List decks that users have published publicly on DecklistGen. Paginated; returns " +
        "summary rows with id, name, cover image, card count, owner.",
      inputSchema: {
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({ page, pageSize }) => {
      const result = await listPublicDecks(page, pageSize);
      return asJson({ ...result, page, pageSize });
    },
  );

  server.registerTool(
    "get_public_deck",
    {
      title: "Get a public deck by ID",
      description:
        "Return the full saved deck (including every card entry) for a given public deck ID. " +
        "Errors if the deck is private or doesn't exist.",
      inputSchema: {
        id: z.string(),
      },
    },
    async ({ id }) => {
      const deck = await getDeck(id);
      if (!deck || !deck.isPublic) {
        return asJson({ error: `Public deck not found: ${id}` }, true);
      }
      return asJson(deck);
    },
  );
}
