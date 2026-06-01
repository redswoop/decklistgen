import { describe, test, expect } from "bun:test";
import { foldCards, SAME_ART, SAME_CARD, type FoldStrategy } from "./fold-cards.js";
import type { Card } from "../types/card.js";

function card(over: Partial<Card>): Card {
  return {
    id: "x",
    localId: "1",
    name: "Pikachu",
    imageBase: "",
    category: "Pokemon",
    rarity: "Holo Rare V",
    energyTypes: [],
    setId: "swsh1",
    setCode: "SSH",
    setName: "Sword & Shield",
    era: "swsh",
    isFullArt: false,
    isEx: false,
    isV: true,
    isVmax: false,
    isVstar: false,
    isAncient: false,
    isFuture: false,
    isTera: false,
    hasFoil: true,
    isPrintUnfriendly: false,
    mechanicsHash: "abc",
    illustrator: "Ken Sugimori",
    ...over,
  };
}

describe("SAME_ART folding", () => {
  test("folds same-name/illustrator/tier printings across sets into one group", () => {
    const a = card({ id: "swsh3-076", setId: "swsh3", localId: "76", name: "Morpeko V" });
    const b = card({ id: "swsh8-038", setId: "swsh8", localId: "38", name: "Morpeko V" });
    const groups = foldCards([b, a], SAME_ART);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2);
    // Representative = earliest by (setId, localId), regardless of input order
    expect(groups[0].representative.id).toBe("swsh3-076");
  });

  test("keeps a plain printing and an alt/full-art of the same card separate (different tier)", () => {
    const holo = card({ id: "swsh1-001", name: "Pikachu V", rarity: "Holo Rare V" });
    const fullart = card({ id: "swsh1-170", name: "Pikachu V", rarity: "Special Illustration Rare" });
    const groups = foldCards([holo, fullart], SAME_ART);
    expect(groups).toHaveLength(2);
  });

  test("keeps different cards by the same illustrator separate (name in key)", () => {
    const pika = card({ id: "swsh1-001", name: "Pikachu V" });
    const eevee = card({ id: "swsh1-002", name: "Eevee V" });
    const groups = foldCards([pika, eevee], SAME_ART);
    expect(groups).toHaveLength(2);
  });

  test("keeps same-name cards with different mechanics separate", () => {
    const a = card({ id: "swsh1-001", name: "Pikachu V", mechanicsHash: "aaa" });
    const b = card({ id: "swsh3-001", name: "Pikachu V", mechanicsHash: "bbb" });
    const groups = foldCards([a, b], SAME_ART);
    expect(groups).toHaveLength(2);
  });

  test("folds reprints even when one is missing illustrator metadata", () => {
    // Mimikyu V BST 62 (has illustrator) and BRS 68 (blank illustrator) are the
    // same card+art reprinted; they must fold despite the missing metadata.
    const bst = card({ id: "swsh5-62", setId: "swsh5", name: "Mimikyu V", mechanicsHash: "441c9782", illustrator: "Eske Yoshinob" });
    const brs = card({ id: "swsh9-068", setId: "swsh9", name: "Mimikyu V", mechanicsHash: "441c9782", illustrator: "" });
    const groups = foldCards([bst, brs], SAME_ART);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2);
    expect(groups[0].representative.id).toBe("swsh5-62");
  });

  test("never folds basic energy (distinct art per set)", () => {
    const e1 = card({ id: "swsh1-160", name: "Grass Energy", category: "Energy", illustrator: "", mechanicsHash: "basic", rarity: "Common" });
    const e2 = card({ id: "swsh9-160", name: "Grass Energy", category: "Energy", illustrator: "", mechanicsHash: "basic", rarity: "Common", setId: "swsh9" });
    const groups = foldCards([e1, e2], SAME_ART);
    expect(groups).toHaveLength(2);
  });

  test("is order-preserving by first occurrence", () => {
    const morpekoA = card({ id: "swsh3-076", setId: "swsh3", name: "Morpeko V" });
    const morpekoB = card({ id: "swsh8-038", setId: "swsh8", name: "Morpeko V" });
    const zacian = card({ id: "swsh1-138", setId: "swsh1", name: "Zacian V" });
    // Morpeko appears first in input → its group leads, even though Zacian's set sorts earlier
    const groups = foldCards([morpekoA, zacian, morpekoB], SAME_ART);
    expect(groups.map((g) => g.representative.name)).toEqual(["Morpeko V", "Zacian V"]);
  });

  test("singletons pass through as one-member groups", () => {
    const a = card({ id: "swsh1-001", name: "A" });
    const b = card({ id: "swsh1-002", name: "B" });
    const groups = foldCards([a, b], SAME_ART);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.members.length === 1)).toBe(true);
  });

  test("empty input yields no groups", () => {
    expect(foldCards([], SAME_ART)).toEqual([]);
  });

  test("custom strategy keys are honored", () => {
    const byName: FoldStrategy = { name: "name", keyOf: (c) => c.name };
    const a = card({ id: "1", name: "X", illustrator: "A" });
    const b = card({ id: "2", name: "X", illustrator: "B" });
    expect(foldCards([a, b], byName)).toHaveLength(1);
  });
});

describe("SAME_CARD folding", () => {
  test("folds different-art printings of the same card into one group", () => {
    // Beautify spreads copies across visually-distinct printings (different
    // rarity tiers); SAME_CARD collapses them by identity regardless of art.
    const holo = card({ id: "sv01-100", setId: "sv01", name: "Pikachu ex", rarity: "Double Rare" });
    const fullart = card({ id: "sv02-098", setId: "sv02", name: "Pikachu ex", rarity: "Special Illustration Rare" });
    const groups = foldCards([fullart, holo], SAME_CARD);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2);
    expect(groups[0].representative.id).toBe("sv01-100"); // earliest printing
  });

  test("keeps cards with different mechanics separate", () => {
    const a = card({ id: "sv01-001", name: "Pikachu V", mechanicsHash: "aaa" });
    const b = card({ id: "sv02-001", name: "Pikachu V", mechanicsHash: "bbb" });
    expect(foldCards([a, b], SAME_CARD)).toHaveLength(2);
  });

  test("folds basic energy across sets by name (unlike SAME_ART)", () => {
    const e1 = card({ id: "swsh1-160", name: "Grass Energy", category: "Energy", illustrator: "", mechanicsHash: "basic", rarity: "Common" });
    const e2 = card({ id: "swsh9-160", name: "Grass Energy", category: "Energy", illustrator: "Art B", mechanicsHash: "basic", rarity: "Common", setId: "swsh9" });
    expect(foldCards([e1, e2], SAME_CARD)).toHaveLength(1);
    // SAME_ART keeps them separate.
    expect(foldCards([e1, e2], SAME_ART)).toHaveLength(2);
  });

  test("is order-preserving by first occurrence", () => {
    const pikaA = card({ id: "sv01-100", setId: "sv01", name: "Pikachu ex" });
    const pikaB = card({ id: "sv02-098", setId: "sv02", name: "Pikachu ex" });
    const eevee = card({ id: "sv01-050", setId: "sv01", name: "Eevee" });
    const groups = foldCards([pikaA, eevee, pikaB], SAME_CARD);
    expect(groups.map((g) => g.representative.name)).toEqual(["Pikachu ex", "Eevee"]);
  });
});
