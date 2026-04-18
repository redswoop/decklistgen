import type { Card } from "../../shared/types/card.js";
import type { ImportResult } from "../../shared/types/decklist.js";
import { SET_MAP } from "../../shared/constants/set-codes.js";
import { loadSet, findCardBySetAndNumber, findCardByName, getCard } from "./card-store.js";
import type { LimitlessDecklist, LimitlessCard } from "./limitless.js";

/**
 * Limitless uses "MEE" with arbitrary numbers for basic energies, but TCGdex
 * has no "sve" set — basic energies live in various SV expansion sets.
 */
const BASIC_ENERGY_MAP: Record<string, { tcgdexId: string; setCode: string }> = {
  "1": { tcgdexId: "sv02-278", setCode: "PAL" },
  "2": { tcgdexId: "sv03-230", setCode: "OBF" },
  "3": { tcgdexId: "sv02-279", setCode: "PAL" },
  "4": { tcgdexId: "sv01-257", setCode: "SVI" },
  "5": { tcgdexId: "sv03.5-207", setCode: "MEW" },
  "6": { tcgdexId: "sv01-258", setCode: "SVI" },
  "7": { tcgdexId: "sv06.5-098", setCode: "SFA" },
  "8": { tcgdexId: "sv06.5-099", setCode: "SFA" },
};

export async function resolveDecklist(decklist: LimitlessDecklist): Promise<ImportResult> {
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
    if (!card) card = findCardByName(entry.name);
    if (!card && entry.set === "MEE" && BASIC_ENERGY_MAP[entry.number]) {
      const mapping = BASIC_ENERGY_MAP[entry.number];
      try {
        await loadSet(mapping.setCode);
      } catch {}
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
