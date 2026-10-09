import type { Card } from "../types/card.js";
import { getRarityRank } from "./rarity-rank.js";
import { printCategoryOf, printCategoryLabel, PRINT_CATEGORY_ORDER } from "./print-plan.js";
import { EFFECT_FACET_LABELS, UNTAGGED_FACET_LABEL, facetLabelsOf } from "./effect-tags.js";

/**
 * `printCategory` is the deck grid's print-mode grouping: one bucket per print filter.
 * `function` buckets by what a card does (effect-tag facets).
 */
export type GroupBy = "none" | "set" | "energyType" | "rarity" | "category" | "function" | "printCategory";
export type SortBy = "alpha" | "rarity" | "type" | "set" | "count";
export type SortDir = "asc" | "desc";

/** A virtualized grid row: a group header, or a chunk of cards forming one row. */
export type VirtualRow =
  | { type: "header"; label: string; count: number; cards: Card[] }
  | { type: "cards"; cards: Card[] };

const CATEGORY_ORDER: Record<string, number> = { Pokemon: 0, Trainer: 1, Energy: 2 };

/** Sort cards by the chosen key, then apply direction. Pure; never mutates input. */
export function sortCards(
  cards: Card[],
  by: SortBy,
  dir: SortDir,
  counts?: Record<string, number>,
): Card[] {
  const sorted = [...cards].sort((a, b) => {
    switch (by) {
      case "alpha": return a.name.localeCompare(b.name);
      case "rarity": return getRarityRank(b.rarity) - getRarityRank(a.rarity);
      case "type": {
        const ca = CATEGORY_ORDER[a.category] ?? 9;
        const cb = CATEGORY_ORDER[b.category] ?? 9;
        if (ca !== cb) return ca - cb;
        return a.name.localeCompare(b.name);
      }
      case "set": {
        if (a.setCode !== b.setCode) return a.setCode.localeCompare(b.setCode);
        return (parseInt(a.localId) || 0) - (parseInt(b.localId) || 0);
      }
      case "count": {
        const ca = counts?.[a.id] ?? 0;
        const cb = counts?.[b.id] ?? 0;
        if (cb !== ca) return cb - ca;
        return a.name.localeCompare(b.name);
      }
      default: return 0;
    }
  });
  return dir === "desc" ? sorted.reverse() : sorted;
}

const PRINT_CATEGORY_RANK = new Map(PRINT_CATEGORY_ORDER.map((c, i) => [printCategoryLabel(c), i]));
const FACET_RANK = new Map(EFFECT_FACET_LABELS.map((label, i) => [label, i]));

/** The group label(s) a card falls under. Only "function" can yield more than one. */
function groupKeys(card: Card, by: GroupBy): string[] {
  switch (by) {
    case "set": return [`${card.setName} (${card.setCode})`];
    case "energyType": return [card.energyTypes[0] ?? "Colorless"];
    case "rarity": return [card.rarity];
    case "category": return [card.trainerType ?? card.category];
    case "function": {
      const facets = facetLabelsOf(card.effectTags);
      return facets.length ? facets : [UNTAGGED_FACET_LABEL];
    }
    case "printCategory": return [printCategoryLabel(printCategoryOf(card))];
    default: return [""];
  }
}

/**
 * Bucket cards by the chosen grouping key, returning [label, cards] entries.
 * Entries are sorted alphabetically by label except for "set", which keeps the
 * input (set-code) ordering, "printCategory", which follows
 * PRINT_CATEGORY_ORDER (Pokémon first, basic energy last), and "function",
 * which follows the effect-tag facet order with untagged cards last. Under
 * "function" a card appears in every facet it has a tag in (Iono is under both
 * Draw and Disruption), so group counts can sum past the card count.
 */
export function groupCards(cards: Card[], by: GroupBy): [string, Card[]][] {
  const map = new Map<string, Card[]>();
  for (const card of cards) {
    for (const key of groupKeys(card, by)) {
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(card);
    }
  }
  const entries = Array.from(map.entries());
  if (by === "printCategory") {
    entries.sort((a, b) => (PRINT_CATEGORY_RANK.get(a[0]) ?? 99) - (PRINT_CATEGORY_RANK.get(b[0]) ?? 99));
  } else if (by === "function") {
    entries.sort((a, b) => (FACET_RANK.get(a[0]) ?? 99) - (FACET_RANK.get(b[0]) ?? 99));
  } else if (by !== "set") {
    entries.sort((a, b) => a[0].localeCompare(b[0]));
  }
  return entries;
}

/** Split a flat card list into row chunks of `perRow` for the virtualizer. */
export function chunkCards(cards: Card[], perRow: number): VirtualRow[] {
  const rows: VirtualRow[] = [];
  for (let i = 0; i < cards.length; i += perRow) {
    rows.push({ type: "cards", cards: cards.slice(i, i + perRow) });
  }
  return rows;
}
