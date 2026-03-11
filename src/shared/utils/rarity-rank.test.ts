import { describe, it, expect } from "bun:test";
import { getRarityRank, sortByRarityDesc, getTopRarityVariants } from "./rarity-rank.js";
import type { Card } from "../types/card.js";

describe("getRarityRank", () => {
  it("ranks known rarities in order", () => {
    expect(getRarityRank("Common")).toBeLessThan(getRarityRank("Uncommon"));
    expect(getRarityRank("Uncommon")).toBeLessThan(getRarityRank("Rare"));
    expect(getRarityRank("Rare")).toBeLessThan(getRarityRank("Double Rare"));
    expect(getRarityRank("Double Rare")).toBeLessThan(getRarityRank("Art Rare"));
    expect(getRarityRank("Art Rare")).toBeLessThan(getRarityRank("Ultra Rare"));
    expect(getRarityRank("Ultra Rare")).toBeLessThan(getRarityRank("Illustration Rare"));
    expect(getRarityRank("Illustration Rare")).toBeLessThan(getRarityRank("Special Art Rare"));
    expect(getRarityRank("Special Art Rare")).toBeLessThan(getRarityRank("Special Illustration Rare"));
    expect(getRarityRank("Special Illustration Rare")).toBeLessThan(getRarityRank("Hyper Rare"));
    expect(getRarityRank("Hyper Rare")).toBeLessThan(getRarityRank("Secret Rare"));
  });

  it("is case-insensitive", () => {
    expect(getRarityRank("common")).toBe(getRarityRank("Common"));
    expect(getRarityRank("RARE")).toBe(getRarityRank("Rare"));
    expect(getRarityRank("hyper rare")).toBe(getRarityRank("Hyper Rare"));
  });

  it("returns 0 for unknown rarities", () => {
    expect(getRarityRank("Unknown")).toBe(0);
    expect(getRarityRank("")).toBe(0);
    expect(getRarityRank("Mythic")).toBe(0);
  });
});

describe("sortByRarityDesc", () => {
  const makeCard = (rarity: string): Card => ({
    id: rarity,
    localId: "1",
    name: "Test",
    imageBase: "",
    category: "Pokemon",
    rarity,
    energyTypes: [],
    setId: "test",
    setCode: "TST",
    setName: "Test",
    era: "sv",
    isFullArt: false,
    isEx: false,
    isV: false,
    isVmax: false,
    isVstar: false,
    isAncient: false,
    isFuture: false,
    isTera: false,
    hasFoil: false,
  });

  it("sorts cards by rarity descending", () => {
    const cards = [makeCard("Common"), makeCard("Rare"), makeCard("Illustration Rare")];
    const sorted = sortByRarityDesc(cards);
    expect(sorted[0].rarity).toBe("Illustration Rare");
    expect(sorted[1].rarity).toBe("Rare");
    expect(sorted[2].rarity).toBe("Common");
  });

  it("does not mutate the original array", () => {
    const cards = [makeCard("Rare"), makeCard("Common")];
    sortByRarityDesc(cards);
    expect(cards[0].rarity).toBe("Rare");
  });
});

describe("getTopRarityVariants", () => {
  const makeCard = (rarity: string, id = rarity): Card => ({
    id,
    localId: "1",
    name: "Test",
    imageBase: "",
    category: "Pokemon",
    rarity,
    energyTypes: [],
    setId: "test",
    setCode: "TST",
    setName: "Test",
    era: "sv",
    isFullArt: false,
    isEx: false,
    isV: false,
    isVmax: false,
    isVstar: false,
    isAncient: false,
    isFuture: false,
    isTera: false,
    hasFoil: false,
  });

  it("returns only the highest-rarity variants", () => {
    const cards = [
      makeCard("Uncommon", "a"),
      makeCard("Hyper rare", "b"),
      makeCard("Uncommon", "c"),
    ];
    const top = getTopRarityVariants(cards);
    expect(top).toHaveLength(1);
    expect(top[0].id).toBe("b");
  });

  it("returns multiple variants when they share the top rank", () => {
    const cards = [
      makeCard("Uncommon", "a"),
      makeCard("Rare", "b"),
      makeCard("Rare", "c"),
    ];
    const top = getTopRarityVariants(cards);
    expect(top).toHaveLength(2);
    expect(top.map((c) => c.id).sort()).toEqual(["b", "c"]);
  });

  it("returns empty for empty input", () => {
    expect(getTopRarityVariants([])).toEqual([]);
  });
});
