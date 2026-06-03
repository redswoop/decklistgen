import type { Card } from "../types/card.js";
import type { DeckCard } from "../types/deck.js";
import { consolidateDeckCards } from "./consolidate-deck.js";

/**
 * Pure deck-card list operations for the lightbox variant picker's saved-deck
 * path (the working-deck path uses useDecklist's add/remove/swap). Cards are
 * matched by setCode + localId. add/remove consolidate the result; swap does not
 * (it already produces a clean merged list).
 */

function matches(dc: DeckCard, setCode: string, localId: string): boolean {
  return dc.card.setCode === setCode && dc.card.localId === localId;
}

/** Add one copy of `v`, incrementing an existing entry or appending a new one. */
export function addVariant(cards: DeckCard[], v: Card): DeckCard[] {
  const out = cards.map((dc) => ({ ...dc }));
  const idx = out.findIndex((dc) => matches(dc, v.setCode, v.localId));
  if (idx !== -1) out[idx].count++;
  else out.push({ count: 1, card: v });
  return consolidateDeckCards(out);
}

/** Remove one copy of `v` (dropping the entry when its count hits zero). */
export function removeVariant(cards: DeckCard[], v: Card): DeckCard[] {
  const out: DeckCard[] = [];
  let removed = false;
  for (const dc of cards) {
    if (matches(dc, v.setCode, v.localId) && !removed) {
      removed = true;
      if (dc.count > 1) out.push({ ...dc, count: dc.count - 1 });
    } else {
      out.push(dc);
    }
  }
  return consolidateDeckCards(out);
}

/**
 * Replace every copy of the `from` printing with the same total count of `to`.
 * Captures the from-entry counts, drops them, then folds the total into the
 * target printing (or appends it).
 */
export function swapVariant(
  cards: DeckCard[],
  from: { setCode: string; localId: string },
  to: Card,
): DeckCard[] {
  const out: DeckCard[] = [];
  let captured = 0;
  for (const dc of cards) {
    if (matches(dc, from.setCode, from.localId)) captured += dc.count;
    else out.push(dc);
  }
  const idx = out.findIndex((dc) => matches(dc, to.setCode, to.localId));
  if (idx !== -1) out[idx] = { ...out[idx], count: out[idx].count + captured };
  else out.push({ count: captured, card: to });
  return out;
}
