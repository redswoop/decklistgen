import type { Card } from "../types/card.js";
import { getRarityRank } from "./rarity-rank.js";

export type GroupBy = "none" | "set" | "energyType" | "rarity" | "category";
export type SortBy = "alpha" | "rarity" | "type" | "set" | "count";
export type SortDir = "asc" | "desc";

/** A virtualized grid row: a group header, or a chunk of cards forming one row. */
export type VirtualRow =
  | { type: "header"; label: string; count: number }
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

/**
 * Bucket cards by the chosen grouping key, returning [label, cards] entries.
 * Entries are sorted alphabetically by label except for "set", which keeps the
 * input (set-code) ordering.
 */
export function groupCards(cards: Card[], by: GroupBy): [string, Card[]][] {
  const map = new Map<string, Card[]>();
  for (const card of cards) {
    let key: string;
    switch (by) {
      case "set": key = `${card.setName} (${card.setCode})`; break;
      case "energyType": key = card.energyTypes[0] ?? "Colorless"; break;
      case "rarity": key = card.rarity; break;
      case "category": key = card.trainerType ?? card.category; break;
      default: key = "";
    }
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(card);
  }
  const entries = Array.from(map.entries());
  if (by !== "set") entries.sort((a, b) => a[0].localeCompare(b[0]));
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
