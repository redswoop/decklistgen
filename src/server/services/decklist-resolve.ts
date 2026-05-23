import type { Card } from "../../shared/types/card.js";
import type { ImportResult } from "../../shared/types/decklist.js";
import { SET_MAP } from "../../shared/constants/set-codes.js";
import { loadSet, findCardBySetAndNumber, findCardByName } from "./card-store.js";
import type { LimitlessDecklist, LimitlessCard } from "./limitless.js";

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
