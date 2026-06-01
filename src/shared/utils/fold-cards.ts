import type { Card } from "../types/card.js";
import { artTier } from "./variant-allocation.js";

/**
 * A group of cards folded into a single display unit.
 * `representative` is the card shown as the stack's face; `members` are every
 * card in the group (representative included), ordered canonical-first.
 */
export interface CardStackGroup {
  representative: Card;
  members: Card[];
}

/**
 * A folding rule. `keyOf` returns the grouping key for a card — cards sharing a
 * key fold together. Strategies are kept generic so additional ones (e.g.
 * by-mechanics, by-deck-slot) can be added without touching `foldCards`.
 */
export interface FoldStrategy {
  name: string;
  keyOf(card: Card): string;
}

/**
 * Canonical-first ordering: earliest set, then numeric local id. Mirrors the
 * comparator used by `getVariants` in the card store so the representative is
 * the earliest-released printing.
 */
function canonicalCompare(a: Card, b: Card): number {
  if (a.setId !== b.setId) return a.setId.localeCompare(b.setId);
  return (parseInt(a.localId) || 0) - (parseInt(b.localId) || 0);
}

/**
 * Fold a flat card list into stack groups by the given strategy.
 *
 * Order-preserving: each group is emitted at the position of its first member
 * in the input, so the caller's sort drives layout. Within a group, the
 * representative is the earliest printing by `(setId, localId)`.
 */
export function foldCards(cards: Card[], strategy: FoldStrategy): CardStackGroup[] {
  const groups = new Map<string, Card[]>();
  const order: string[] = [];

  for (const card of cards) {
    const key = strategy.keyOf(card);
    const existing = groups.get(key);
    if (existing) {
      existing.push(card);
    } else {
      groups.set(key, [card]);
      order.push(key);
    }
  }

  return order.map((key) => {
    const members = groups.get(key)!.slice().sort(canonicalCompare);
    return { representative: members[0], members };
  });
}

/**
 * Fold printings that share the *same artwork*: same name + mechanics + art
 * tier. Alt-arts / full-arts sit in a different rarity tier (via {@link artTier})
 * so they stay separate. Illustrator is intentionally NOT part of the key — it's
 * a redundant discriminator and is frequently missing from reprint metadata
 * (e.g. Brilliant Stars reprints carry no illustrator), which would wrongly
 * split a fold (Mimikyu V BST 62 vs BRS 68). Basic energy is exempted: it's
 * reprinted with genuinely different art per set, so each printing stays its own
 * tile.
 */
export const SAME_ART: FoldStrategy = {
  name: "same-art",
  keyOf(card) {
    if (card.category === "Energy" && card.mechanicsHash === "basic") return card.id;
    return `${card.name}\0${card.mechanicsHash}\0${artTier(card.rarity)}`;
  },
};

/**
 * Fold all printings of the same *card identity* regardless of artwork: same
 * name + mechanics. Art-agnostic (no art tier) and with no basic-energy
 * exemption — every printing/art variant of a card collapses to one unit (and
 * "Grass Energy" sums across sets). Used in the deck's "by card" fold mode to
 * answer "how many of this card do I have", re-collapsing beautify's art spread.
 * This is the same identity key as `getVariantGroups` in the card store.
 */
export const SAME_CARD: FoldStrategy = {
  name: "same-card",
  keyOf: (card) => `${card.name}\0${card.mechanicsHash}`,
};
