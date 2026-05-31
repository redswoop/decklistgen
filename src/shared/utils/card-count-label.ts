/**
 * Format the Browse grid header count.
 *
 * `refined` is how many cards match the full filter set (what you see).
 * `universe` is how many exist in the selected set/era + category, before the
 * finer refinement filters narrow things down. When refinement actually shrinks
 * the set we show "showing X of Y" so the count never lies about how many cards
 * the chosen universe holds; otherwise we show a plain "N cards".
 */
export function formatCardCountLabel(refined: number, universe: number | null): string {
  if (universe != null && universe > refined) {
    return `showing ${refined} of ${universe}`;
  }
  return `${refined} card${refined === 1 ? "" : "s"}`;
}
