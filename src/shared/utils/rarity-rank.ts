import type { Card } from "../types/card.js";

const RARITY_RANK: Record<string, number> = {
  "common": 1,
  "uncommon": 2,
  "rare": 3,
  "double rare": 4,
  "art rare": 5,
  "ultra rare": 6,
  "illustration rare": 7,
  "special art rare": 9,
  "special illustration rare": 10,
  "hyper rare": 11,
  "secret rare": 12,
};

export function getRarityRank(rarity: string): number {
  return RARITY_RANK[rarity.toLowerCase()] ?? 0;
}

export function sortByRarityDesc(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => getRarityRank(b.rarity) - getRarityRank(a.rarity));
}

/** Return only the variants sharing the highest rarity rank */
export function getTopRarityVariants(cards: Card[]): Card[] {
  if (cards.length === 0) return [];
  const sorted = sortByRarityDesc(cards);
  const topRank = getRarityRank(sorted[0].rarity);
  return sorted.filter((c) => getRarityRank(c.rarity) === topRank);
}
