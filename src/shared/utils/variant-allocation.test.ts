import { describe, test, expect } from "bun:test";
import { randomizeAllocation, useForAll, isValidAllocation, deduplicateByArt } from "./variant-allocation.js";

describe("randomizeAllocation", () => {
  test("distributes total across variants", () => {
    const ids = ["a", "b", "c"];
    const alloc = randomizeAllocation(ids, 6);
    expect(alloc.size).toBe(3);
    let sum = 0;
    for (const v of alloc.values()) sum += v;
    expect(sum).toBe(6);
    // Each should get 2 with even distribution
    for (const v of alloc.values()) expect(v).toBe(2);
  });

  test("handles uneven distribution", () => {
    const ids = ["a", "b"];
    const alloc = randomizeAllocation(ids, 3);
    let sum = 0;
    for (const v of alloc.values()) sum += v;
    expect(sum).toBe(3);
    // One gets 2, the other gets 1
    const values = [...alloc.values()].sort();
    expect(values).toEqual([1, 2]);
  });

  test("handles single variant", () => {
    const alloc = randomizeAllocation(["a"], 4);
    expect(alloc.get("a")).toBe(4);
  });

  test("handles zero total", () => {
    const alloc = randomizeAllocation(["a", "b"], 0);
    expect(alloc.get("a")).toBe(0);
    expect(alloc.get("b")).toBe(0);
  });

  test("handles empty variants", () => {
    const alloc = randomizeAllocation([], 5);
    expect(alloc.size).toBe(0);
  });
});

describe("useForAll", () => {
  test("puts all copies on selected variant", () => {
    const alloc = useForAll(["a", "b", "c"], "b", 4);
    expect(alloc.get("a")).toBe(0);
    expect(alloc.get("b")).toBe(4);
    expect(alloc.get("c")).toBe(0);
  });

  test("handles total of 0", () => {
    const alloc = useForAll(["a", "b"], "a", 0);
    expect(alloc.get("a")).toBe(0);
    expect(alloc.get("b")).toBe(0);
  });
});

describe("isValidAllocation", () => {
  test("valid when sum matches expected", () => {
    const alloc = new Map([["a", 2], ["b", 1]]);
    expect(isValidAllocation(alloc, 3)).toBe(true);
  });

  test("invalid when sum differs", () => {
    const alloc = new Map([["a", 2], ["b", 1]]);
    expect(isValidAllocation(alloc, 4)).toBe(false);
  });

  test("invalid with negative values", () => {
    const alloc = new Map([["a", -1], ["b", 4]]);
    expect(isValidAllocation(alloc, 3)).toBe(false);
  });

  test("invalid with non-integer values", () => {
    const alloc = new Map([["a", 1.5], ["b", 1.5]]);
    expect(isValidAllocation(alloc, 3)).toBe(false);
  });

  test("valid with empty allocation and zero total", () => {
    expect(isValidAllocation(new Map(), 0)).toBe(true);
  });

  test("invalid with empty allocation and non-zero total", () => {
    expect(isValidAllocation(new Map(), 3)).toBe(false);
  });
});

describe("deduplicateByArt", () => {
  const card = (id: string, illustrator: string, rarity = "Common") => ({ id, illustrator, rarity });

  test("keeps one representative per unique illustrator at same rarity", () => {
    const variants = [
      card("sv01-100", "Artist A", "Common"),
      card("sv02-100", "Artist A", "Common"),  // same art, different set
      card("sv03-100", "Artist B", "Common"),
    ];
    const result = deduplicateByArt(variants);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.illustrator)).toEqual(["Artist A", "Artist B"]);
  });

  test("keeps same illustrator at different rarity tiers as separate art", () => {
    const variants = [
      card("sv05-144", "AYUMI", "Uncommon"),
      card("me01-167", "AYUMI", "Ultra Rare"),
      card("sv06-223", "AYUMI", "Hyper rare"),
    ];
    const result = deduplicateByArt(variants);
    expect(result).toHaveLength(3);
  });

  test("collapses same illustrator at same rarity tier across sets", () => {
    const variants = [
      card("sv05-144", "AYUMI", "Uncommon"),
      card("sv08.5-101", "AYUMI", "Uncommon"),  // same art reprinted
      card("me01-167", "AYUMI", "Ultra Rare"),   // different art
    ];
    const result = deduplicateByArt(variants);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("sv05-144");
    expect(result[1].id).toBe("me01-167");
  });

  test("treats Common/Uncommon/Rare as same regular art tier", () => {
    const variants = [
      card("a", "Artist A", "Common"),
      card("b", "Artist A", "Uncommon"),
      card("c", "Artist A", "Rare"),
      card("d", "Artist A", "Holo Rare"),
    ];
    const result = deduplicateByArt(variants);
    expect(result).toHaveLength(1);
  });

  test("falls back to id when illustrator is empty", () => {
    const variants = [
      card("sv01-100", ""),
      card("sv02-100", ""),
    ];
    const result = deduplicateByArt(variants);
    expect(result).toHaveLength(2);
  });

  test("handles empty input", () => {
    expect(deduplicateByArt([])).toEqual([]);
  });

  test("all unique illustrators keeps all variants", () => {
    const variants = [
      card("a", "Artist A"),
      card("b", "Artist B"),
      card("c", "Artist C"),
    ];
    const result = deduplicateByArt(variants);
    expect(result).toHaveLength(3);
  });
});
