import { describe, test, expect } from "bun:test";
import { applyFilters } from "./filter-cards.js";
import type { Card } from "../types/card.js";

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "test-001",
    localId: "001",
    name: "Test Card",
    imageBase: "",
    category: "Pokemon",
    rarity: "Common",
    energyTypes: ["Fire"],
    setId: "sv01",
    setCode: "PAL",
    setName: "Paldea Evolved",
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
    ...overrides,
  };
}

describe("applyFilters", () => {
  describe("specialAttributes skip for non-Pokemon categories", () => {
    const trainer = makeCard({ id: "t1", name: "Boss's Orders", category: "Trainer", trainerType: "Supporter", energyTypes: [] });
    const energy = makeCard({ id: "e1", name: "Fire Energy", category: "Energy", energyTypes: [] });
    const exPokemon = makeCard({ id: "p1", name: "Charizard ex", isEx: true });
    const nonExPokemon = makeCard({ id: "p2", name: "Pikachu" });
    const cards = [trainer, energy, exPokemon, nonExPokemon];

    test("specialAttributes filter narrows Pokemon when category is Pokemon", () => {
      const result = applyFilters(cards, { category: "Pokemon", specialAttributes: ["ex"] });
      expect(result).toEqual([exPokemon]);
    });

    test("specialAttributes filter is a no-op when category is Trainer", () => {
      const result = applyFilters(cards, { category: "Trainer", specialAttributes: ["ex"] });
      expect(result).toEqual([trainer]);
    });

    test("specialAttributes filter is a no-op when category is Energy", () => {
      const result = applyFilters(cards, { category: "Energy", specialAttributes: ["ex"] });
      expect(result).toEqual([energy]);
    });

    test("specialAttributes filter applies when no category set (filters all cards)", () => {
      const result = applyFilters(cards, { specialAttributes: ["ex"] });
      expect(result).toEqual([exPokemon]);
    });
  });

  describe("energyTypes skip for non-Pokemon categories", () => {
    const trainer = makeCard({ id: "t1", name: "Nest Ball", category: "Trainer", trainerType: "Item", energyTypes: [] });
    const firePokemon = makeCard({ id: "p1", name: "Charmander", energyTypes: ["Fire"] });
    const waterPokemon = makeCard({ id: "p2", name: "Squirtle", energyTypes: ["Water"] });
    const cards = [trainer, firePokemon, waterPokemon];

    test("energyTypes filter narrows Pokemon when category is Pokemon", () => {
      const result = applyFilters(cards, { category: "Pokemon", energyTypes: ["Fire"] });
      expect(result).toEqual([firePokemon]);
    });

    test("energyTypes filter is a no-op when category is Trainer", () => {
      const result = applyFilters(cards, { category: "Trainer", energyTypes: ["Fire"] });
      expect(result).toEqual([trainer]);
    });

    test("energyTypes filter is a no-op when category is Energy", () => {
      const energy = makeCard({ id: "e1", category: "Energy", energyTypes: [] });
      const result = applyFilters([energy], { category: "Energy", energyTypes: ["Fire"] });
      expect(result).toEqual([energy]);
    });
  });

  describe("deck code search", () => {
    const cre063 = makeCard({ id: "swsh6-063", localId: "063", name: "Shadow Rider Calyrex VMAX", setCode: "CRE", setId: "swsh6" });
    const cre064 = makeCard({ id: "swsh6-064", localId: "064", name: "Mewtwo", setCode: "CRE", setId: "swsh6" });
    const sv01036 = makeCard({ id: "sv01-036", localId: "036", name: "Arcanine", setCode: "SVI", setId: "sv01" });
    const cards = [cre063, cre064, sv01036];

    test("matches 'CRE 063' format", () => {
      expect(applyFilters(cards, { nameSearch: "CRE 063" })).toEqual([cre063]);
    });

    test("matches 'CRE063' no-space format", () => {
      expect(applyFilters(cards, { nameSearch: "CRE063" })).toEqual([cre063]);
    });

    test("matches 'cre 63' case-insensitive, no leading zero", () => {
      expect(applyFilters(cards, { nameSearch: "cre 63" })).toEqual([cre063]);
    });

    test("matches 'CRE-063' with dash", () => {
      expect(applyFilters(cards, { nameSearch: "CRE-063" })).toEqual([cre063]);
    });

    test("matches TCGdex ID format 'swsh6-063'", () => {
      expect(applyFilters(cards, { nameSearch: "swsh6-063" })).toEqual([cre063]);
    });

    test("falls back to name search when not a deck code", () => {
      expect(applyFilters(cards, { nameSearch: "Shadow" })).toEqual([cre063]);
    });

    test("matches either deck code or name", () => {
      expect(applyFilters(cards, { nameSearch: "Mewtwo" })).toEqual([cre064]);
    });
  });

  describe("trainerType skip for non-Trainer categories", () => {
    const supporter = makeCard({ id: "t1", name: "Boss's Orders", category: "Trainer", trainerType: "Supporter", energyTypes: [] });
    const item = makeCard({ id: "t2", name: "Nest Ball", category: "Trainer", trainerType: "Item", energyTypes: [] });
    const pokemon = makeCard({ id: "p1", name: "Pikachu" });

    test("trainerType narrows Trainer cards when category is Trainer", () => {
      const result = applyFilters([supporter, item, pokemon], { category: "Trainer", trainerType: "Supporter" });
      expect(result).toEqual([supporter]);
    });

    test("trainerType is a no-op when category is Pokemon", () => {
      const result = applyFilters([supporter, item, pokemon], { category: "Pokemon", trainerType: "Supporter" });
      expect(result).toEqual([pokemon]);
    });
  });
});
