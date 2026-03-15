import type { DeckCard } from "../types/deck.js";

/**
 * Merge duplicate DeckCard entries (same setCode + localId), summing counts.
 * Preserves array order — first occurrence keeps its position.
 */
export function consolidateDeckCards(cards: DeckCard[]): DeckCard[] {
  const seen = new Map<string, number>(); // key → index in result
  const result: DeckCard[] = [];

  for (const dc of cards) {
    const key = `${dc.card.setCode}:${dc.card.localId}:${dc.artCardId ?? ""}`;
    const idx = seen.get(key);
    if (idx !== undefined) {
      result[idx] = { ...result[idx], count: result[idx].count + dc.count };
    } else {
      seen.set(key, result.length);
      result.push({ ...dc });
    }
  }

  return result;
}
