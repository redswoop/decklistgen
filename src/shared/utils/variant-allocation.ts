import { getRarityRank } from "./rarity-rank.js";

/**
 * Distribute `total` copies across variant IDs.
 * Round-robin randomized: shuffles variants, then deals one copy at a time.
 */
export function randomizeAllocation(variantIds: string[], total: number): Map<string, number> {
  const alloc = new Map<string, number>();
  for (const id of variantIds) alloc.set(id, 0);
  if (variantIds.length === 0 || total <= 0) return alloc;

  // Shuffle
  const shuffled = [...variantIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Round-robin deal
  for (let i = 0; i < total; i++) {
    const id = shuffled[i % shuffled.length];
    alloc.set(id, alloc.get(id)! + 1);
  }

  return alloc;
}

/**
 * Put all copies on a single selected variant.
 */
export function useForAll(variantIds: string[], selectedId: string, total: number): Map<string, number> {
  const alloc = new Map<string, number>();
  for (const id of variantIds) alloc.set(id, id === selectedId ? total : 0);
  return alloc;
}

/**
 * Map rarity rank to an art tier for dedup purposes.
 * Ranks 0–3 (Common through Rare/Holo) share the same "regular" artwork.
 * Each premium rank (4+) gets unique art treatments.
 */
function artTier(rarity: string): number {
  const rank = getRarityRank(rarity);
  return rank <= 3 ? 0 : rank;
}

/**
 * Pick one representative card per unique artwork.
 * Key: illustrator + art tier — same artist at the "regular" tier (Common/Uncommon/Rare)
 * is the same art reprinted. Premium tiers each get distinct artwork.
 */
export function deduplicateByArt<T extends { illustrator: string; rarity: string; id: string }>(variants: T[]): T[] {
  const seen = new Map<string, T>();
  for (const v of variants) {
    const tier = artTier(v.rarity);
    // No illustrator (e.g. basic energy): dedup by tier alone
    const key = v.illustrator ? `${v.illustrator}:${tier}` : `_unknown:${tier}`;
    if (!seen.has(key)) seen.set(key, v);
  }
  return [...seen.values()];
}

/**
 * Check that allocation values sum to the expected total and all values are non-negative integers.
 */
export function isValidAllocation(allocation: Map<string, number>, expectedTotal: number): boolean {
  let sum = 0;
  for (const count of allocation.values()) {
    if (!Number.isInteger(count) || count < 0) return false;
    sum += count;
  }
  return sum === expectedTotal;
}
