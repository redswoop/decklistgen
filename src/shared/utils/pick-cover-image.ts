import type { DeckCard } from "../types/deck.js";

/**
 * Pick the best cover image for a deck.
 * Priority: first card with "ex", "V", "VMAX", or "VSTAR" in name.
 * Fallback: first card in the deck.
 */
export function pickCoverImage(cards: DeckCard[]): string | undefined {
  if (cards.length === 0) return undefined;

  const heroSuffixes = ["ex", " V", " VMAX", " VSTAR"];
  const hero = cards.find((c) =>
    heroSuffixes.some((suffix) => c.card.name.endsWith(suffix))
  );
  const pick = hero ?? cards[0];
  return pick.card.imageBase || undefined;
}
