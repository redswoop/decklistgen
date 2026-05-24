import type { DeckCard } from "../types/deck.js";

/**
 * Merge duplicate DeckCard entries (same setCode + localId), summing counts.
 * Preserves array order — first occurrence keeps its position. For artCard
 * and templateSetId, the last non-undefined value across merged entries wins
 * (so a deliberately-set override isn't silently dropped by an earlier
 * unset entry).
 */
export function consolidateDeckCards(cards: DeckCard[]): DeckCard[] {
  const seen = new Map<string, number>();
  const result: DeckCard[] = [];

  for (const dc of cards) {
    const key = `${dc.card.setCode}:${dc.card.localId}`;
    const idx = seen.get(key);
    if (idx !== undefined) {
      const prev = result[idx];
      result[idx] = {
        ...prev,
        count: prev.count + dc.count,
        ...(dc.artCard !== undefined ? { artCard: dc.artCard } : {}),
        ...(dc.templateSetId !== undefined ? { templateSetId: dc.templateSetId } : {}),
      };
    } else {
      seen.set(key, result.length);
      result.push({ ...dc });
    }
  }

  return result;
}
