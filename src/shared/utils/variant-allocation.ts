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
