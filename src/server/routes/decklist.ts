import { Hono } from "hono";
import type { DecklistEntry, DecklistOutput, ImportResult } from "../../shared/types/decklist.js";
import type { Card } from "../../shared/types/card.js";
import { SET_MAP } from "../../shared/constants/set-codes.js";
import { loadSet, findCardBySetAndNumber, findCardByName, getCard } from "../services/card-store.js";
import {
  fetchTournamentDetails,
  fetchTournamentStandings,
  fetchStandaloneDecklist,
  parseLimitlessUrl,
  parsePtcgoText,
  type LimitlessDecklist,
  type LimitlessCard,
} from "../services/limitless.js";
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

/**
 * Limitless uses "MEE" with arbitrary numbers for basic energies, but TCGdex
 * has no "sve" set — basic energies live in various SV expansion sets.
 * Map MEE numbers to known TCGdex card IDs.
 */
const BASIC_ENERGY_MAP: Record<string, { tcgdexId: string; setCode: string }> = {
  "1": { tcgdexId: "sv02-278", setCode: "PAL" },   // Grass
  "2": { tcgdexId: "sv03-230", setCode: "OBF" },   // Fire
  "3": { tcgdexId: "sv02-279", setCode: "PAL" },   // Water
  "4": { tcgdexId: "sv01-257", setCode: "SVI" },   // Lightning
  "5": { tcgdexId: "sv03.5-207", setCode: "MEW" },  // Psychic
  "6": { tcgdexId: "sv01-258", setCode: "SVI" },   // Fighting
  "7": { tcgdexId: "sv06.5-098", setCode: "SFA" },  // Darkness
  "8": { tcgdexId: "sv06.5-099", setCode: "SFA" },  // Metal
};

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
      } catch (e) {
        console.warn(`Failed to load set ${code}: ${e instanceof Error ? e.message : String(e)}`);
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

    // Fallback: basic energy from MEE → load the set that has it and look up by tcgdexId
    if (!card && entry.set === "MEE" && BASIC_ENERGY_MAP[entry.number]) {
      const mapping = BASIC_ENERGY_MAP[entry.number];
      try {
        await loadSet(mapping.setCode);
      } catch { /* set may already be loaded or unavailable */ }
      card = getCard(mapping.tcgdexId);
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
