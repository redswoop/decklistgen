import { Hono } from "hono";
import type { DecklistEntry, DecklistOutput } from "../../shared/types/decklist.js";
import {
  fetchTournamentDetails,
  fetchTournamentStandings,
  fetchStandaloneDecklist,
  parseLimitlessUrl,
  parsePtcgoText,
} from "../services/limitless.js";
import { resolveDecklist } from "../services/decklist-resolve.js";
import { logAction, getClientIp } from "../services/logger.js";

const app = new Hono();

app.post("/generate", async (c) => {
  const body = await c.req.json<{ entries: DecklistEntry[] }>();
  const { entries } = body;

  if (!entries?.length) return c.json({ error: "No entries" }, 400);

  const lines = entries.map((e) => `${e.setCode} ${e.localId} x${e.count}  # ${e.name}`);
  const output: DecklistOutput = { text: lines.join("\n"), entries };
  return c.json(output);
});

/** Fetch player list from a tournament, or resolve a standalone decklist directly */
app.post("/import/limitless/players", async (c) => {
  const { url } = await c.req.json<{ url: string }>();
  logAction("deck.import.limitless", getClientIp(c), { url });
  const parsed = parseLimitlessUrl(url);
  if (!parsed) return c.json({ error: "Invalid Limitless URL or tournament ID" }, 400);

  try {
    // Standalone decklist: resolve immediately, no player selection needed
    if (parsed.type === "decklist") {
      const decklist = await fetchStandaloneDecklist(parsed.decklistId);
      const result = await resolveDecklist(decklist);
      return c.json({ directImport: true, ...result });
    }

    // Tournament: return player list for selection
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

    return c.json({
      tournamentId: parsed.tournamentId,
      tournamentName: details.name,
      playerCount: details.players,
      players,
    });
  } catch (e) {
    console.error("Limitless player fetch failed:", e);
    return c.json({ error: "Failed to fetch tournament data" }, 502);
  }
});

/** Fetch and resolve a player's decklist from a Limitless tournament */
app.post("/import/limitless/deck", async (c) => {
  const { tournamentId, playerName } = await c.req.json<{
    tournamentId: string;
    playerName: string;
  }>();
  logAction("deck.import.limitless.deck", getClientIp(c), { tournamentId, playerName });

  try {
    const standings = await fetchTournamentStandings(tournamentId);
    const player = standings.find((s) => s.name === playerName);
    if (!player?.decklist) return c.json({ error: "Player or decklist not found" }, 404);

    const result = await resolveDecklist(player.decklist);
    return c.json(result);
  } catch (e) {
    console.error("Limitless deck fetch failed:", e);
    return c.json({ error: "Failed to fetch decklist" }, 502);
  }
});

/** Parse and resolve pasted PTCGO/PTCGL text */
app.post("/import/text", async (c) => {
  const { text } = await c.req.json<{ text: string }>();
  if (!text?.trim()) return c.json({ error: "No text provided" }, 400);
  logAction("deck.import.text", getClientIp(c), { textLength: text.length });

  try {
    const parsed = parsePtcgoText(text);
    const result = await resolveDecklist(parsed);
    return c.json(result);
  } catch (e) {
    console.error("Text import failed:", e);
    return c.json({ error: "Failed to parse decklist text" }, 500);
  }
});

export default app;
