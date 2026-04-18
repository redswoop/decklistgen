import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  parsePtcgoText,
  parseLimitlessUrl,
  fetchStandaloneDecklist,
  fetchTournamentDetails,
  fetchTournamentStandings,
} from "../../services/limitless.js";
import { resolveDecklist } from "../../services/decklist-resolve.js";
import type { DecklistEntry } from "../../../shared/types/decklist.js";
import { asJson } from "../util.js";

export function registerDecklistTools(server: McpServer): void {
  server.registerTool(
    "parse_ptcgo_text",
    {
      title: "Parse pasted PTCGO/PTCGL decklist text",
      description:
        "Parse a pasted decklist in PTCGO/PTCGL text format (e.g. '4 Charizard ex PAF 54') " +
        "and resolve each line to a DecklistGen card. Returns resolved + unresolved entries.",
      inputSchema: {
        text: z.string().min(1).describe("Raw decklist text."),
      },
    },
    async ({ text }) => {
      try {
        const parsed = parsePtcgoText(text);
        const result = await resolveDecklist(parsed);
        return asJson(result);
      } catch (e) {
        return asJson({ error: e instanceof Error ? e.message : String(e) }, true);
      }
    },
  );

  server.registerTool(
    "import_limitless",
    {
      title: "Import a deck from Limitless TCG",
      description:
        "Accepts either a standalone decklist URL (https://limitlesstcg.com/decks/list/NNN) " +
        "or a tournament URL. For standalone: resolves the deck immediately. For tournaments: " +
        "returns the player list — call import_limitless_player with a chosen player.",
      inputSchema: {
        url: z.string().describe("Limitless URL or bare tournament ID."),
      },
    },
    async ({ url }) => {
      const parsed = parseLimitlessUrl(url);
      if (!parsed) return asJson({ error: "Invalid Limitless URL or tournament ID" }, true);

      try {
        if (parsed.type === "decklist") {
          const decklist = await fetchStandaloneDecklist(parsed.decklistId);
          const result = await resolveDecklist(decklist);
          return asJson({ directImport: true, ...result });
        }

        const [details, standings] = await Promise.all([
          fetchTournamentDetails(parsed.tournamentId),
          fetchTournamentStandings(parsed.tournamentId),
        ]);

        const players = standings
          .filter((s) => s.decklist)
          .map((s) => ({
            name: s.name,
            placing: s.placing,
            record: s.record,
            deckName: s.deck?.name,
          }));

        return asJson({
          tournamentId: parsed.tournamentId,
          tournamentName: details.name,
          playerCount: details.players,
          players,
        });
      } catch (e) {
        return asJson({ error: e instanceof Error ? e.message : String(e) }, true);
      }
    },
  );

  server.registerTool(
    "import_limitless_player",
    {
      title: "Import a specific player's deck from a Limitless tournament",
      description:
        "After import_limitless returns a player list, call this with the tournament ID " +
        "and player name to resolve their decklist to DecklistGen cards.",
      inputSchema: {
        tournamentId: z.string(),
        playerName: z.string(),
      },
    },
    async ({ tournamentId, playerName }) => {
      try {
        const standings = await fetchTournamentStandings(tournamentId);
        const player = standings.find((s) => s.name === playerName);
        if (!player?.decklist) {
          return asJson({ error: "Player or decklist not found" }, true);
        }
        const result = await resolveDecklist(player.decklist);
        return asJson(result);
      } catch (e) {
        return asJson({ error: e instanceof Error ? e.message : String(e) }, true);
      }
    },
  );

  server.registerTool(
    "format_decklist",
    {
      title: "Format decklist entries as printable text",
      description:
        "Convert structured decklist entries into a plain-text listing (one line per entry, " +
        "'SETCODE LOCALID xCOUNT  # Name').",
      inputSchema: {
        entries: z
          .array(
            z.object({
              setCode: z.string(),
              localId: z.string(),
              count: z.number().int().min(1),
              name: z.string(),
            }),
          )
          .min(1),
      },
    },
    async ({ entries }) => {
      const typed = entries as DecklistEntry[];
      const lines = typed.map((e) => `${e.setCode} ${e.localId} x${e.count}  # ${e.name}`);
      return asJson({ text: lines.join("\n"), entries: typed });
    },
  );
}
