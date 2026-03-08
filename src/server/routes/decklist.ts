import { Hono } from "hono";
import type { DecklistEntry, DecklistOutput, ImportResult } from "../../shared/types/decklist.js";
import type { Card } from "../../shared/types/card.js";
import { SET_MAP } from "../../shared/constants/set-codes.js";
import { loadSet, findCardBySetAndNumber, findCardByName } from "../services/card-store.js";
import {
  fetchTournamentDetails,
  fetchTournamentStandings,
  fetchStandaloneDecklist,
  parseLimitlessUrl,
  parsePtcgoText,
  type LimitlessDecklist,
  type LimitlessCard,
} from "../services/limitless.js";

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
  } catch (e: any) {
    return c.json({ error: e.message }, 502);
  }
});

/** Fetch and resolve a player's decklist from a Limitless tournament */
app.post("/import/limitless/deck", async (c) => {
  const { tournamentId, playerName } = await c.req.json<{
    tournamentId: string;
    playerName: string;
  }>();

  try {
    const standings = await fetchTournamentStandings(tournamentId);
    const player = standings.find((s) => s.name === playerName);
    if (!player?.decklist) return c.json({ error: "Player or decklist not found" }, 404);

    const result = await resolveDecklist(player.decklist);
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 502);
  }
});

/** Parse and resolve pasted PTCGO/PTCGL text */
app.post("/import/text", async (c) => {
  const { text } = await c.req.json<{ text: string }>();
  if (!text?.trim()) return c.json({ error: "No text provided" }, 400);

  try {
    const parsed = parsePtcgoText(text);
    const result = await resolveDecklist(parsed);
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

async function resolveDecklist(decklist: LimitlessDecklist): Promise<ImportResult> {
  // Collect all unique set codes and pre-load them
  const setCodes = new Set<string>();
  const allCards: Array<LimitlessCard & { category: string }> = [];
  for (const card of decklist.pokemon) {
    setCodes.add(card.set);
    allCards.push({ ...card, category: "pokemon" });
  }
  for (const card of decklist.trainer) {
    setCodes.add(card.set);
    allCards.push({ ...card, category: "trainer" });
  }
  for (const card of decklist.energy) {
    setCodes.add(card.set);
    allCards.push({ ...card, category: "energy" });
  }

  // Load all required sets
  for (const code of setCodes) {
    if (SET_MAP[code]) {
      try {
        await loadSet(code);
      } catch (e: any) {
        console.warn(`Failed to load set ${code}: ${e.message}`);
      }
    }
  }

  const resolved: Array<{ card: Card; count: number }> = [];
  const unresolved: ImportResult["unresolved"] = [];

  for (const entry of allCards) {
    let card = findCardBySetAndNumber(entry.set, entry.number);

    // Fallback: search by name (useful for energy cards from unknown sets)
    if (!card) {
      card = findCardByName(entry.name);
    }

    if (card) {
      resolved.push({ card, count: entry.count });
    } else {
      unresolved.push({
        name: entry.name,
        set: entry.set,
        number: entry.number,
        count: entry.count,
        category: entry.category,
      });
    }
  }

  return { cards: resolved, unresolved };
}

export default app;
