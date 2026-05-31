import type { Card, CardDetail } from "../types/card.js";
import { shouldPrintCard, type PrintFilterOptions } from "./print-filter.js";

/** A deck card paired with its optional detail (needed to classify energy). */
export interface PrintCountEntry {
  card: Card;
  detail?: CardDetail;
  count: number;
}

/**
 * Count the cards that will land on the printed sheet, mirroring
 * `PrintSheet.vue`'s `buildEntry()`: filtered by `shouldPrintCard`, then
 * `qtyOneEach ? 1 : max(1, count)` copies each.
 */
export function countPrintCards(
  entries: PrintCountEntry[],
  opts: PrintFilterOptions,
  qtyOneEach: boolean,
): number {
  let total = 0;
  for (const e of entries) {
    if (!shouldPrintCard(e.card, e.detail, opts)) continue;
    total += qtyOneEach ? 1 : Math.max(1, e.count);
  }
  return total;
}

export interface PrintSummary {
  cardCount: number;
  sheets: number;
  /** Empty card slots on the final sheet (0 when it fills evenly). */
  emptySlots: number;
  /** True when the last sheet is partially empty. */
  incomplete: boolean;
}

/** Lay `cardCount` cards into pages of `cardsPerSheet` and report the fit. */
export function summarizePrint(cardCount: number, cardsPerSheet: number): PrintSummary {
  if (cardCount <= 0) {
    return { cardCount: 0, sheets: 0, emptySlots: 0, incomplete: false };
  }
  const sheets = Math.ceil(cardCount / cardsPerSheet);
  const used = cardCount % cardsPerSheet;
  const emptySlots = used === 0 ? 0 : cardsPerSheet - used;
  return { cardCount, sheets, emptySlots, incomplete: emptySlots > 0 };
}
