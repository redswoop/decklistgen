import { describe, it, expect } from "bun:test";
import {
  adaptPokemon,
  adaptTrainer,
  adaptBasicEnergy,
} from "./card-to-lab.js";
import type { Card, CardDetail } from "../../shared/types/card.js";

function baseCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "sv01-001",
    localId: "001",
    name: "Sprigatito",
    imageBase: "https://example/sv01-001",
    category: "Pokemon",
    rarity: "Common",
    energyTypes: ["Grass"],
    setId: "sv01",
    setCode: "SVI",
    setName: "Scarlet & Violet",
    era: "sv",
    hp: 70,
    stage: "Basic",
    retreat: 1,
    isFullArt: false,
    isEx: false,
    isV: false,
    isVmax: false,
    isVstar: false,
    isAncient: false,
    isFuture: false,
    isTera: false,
    hasFoil: false,
    isPrintUnfriendly: false,
    mechanicsHash: "",
    illustrator: "kirisAki",
    ...overrides,
  };
}

function baseDetail(card: Card, overrides: Partial<CardDetail> = {}): CardDetail {
  return {
    ...card,
    attacks: [],
    abilities: [],
    weaknesses: [],
    resistances: [],
    ...overrides,
  };
}

describe("adaptPokemon", () => {
  it("maps the simple case (basic Grass Pokemon, one attack)", () => {
    const card = baseCard();
    const detail = baseDetail(card, {
      attacks: [{ name: "Scratch", cost: ["Colorless"], damage: "10" }],
      weaknesses: [{ type: "Fire", value: "×2" }],
      evolveFrom: undefined,
    });
    const lab = adaptPokemon(card, detail, "/art.png");
    expect(lab).toEqual({
      name: "Sprigatito",
      suffix: undefined,
      evolvesFrom: undefined,
      stage: "Basic",
      type: "Grass",
      hp: 70,
      artUrl: "/art.png",
      ability: undefined,
      attacks: [{ name: "Scratch", cost: ["Colorless"], damage: "10", effect: undefined }],
      weakness: { type: "Fire", value: "×2" },
      resistance: undefined,
      retreat: 1,
      illustrator: "kirisAki",
    });
  });

  it("strips the suffix token from the name (the lab renders it as a logo)", () => {
    const ex = baseCard({ name: "Charizard ex", isEx: true });
    expect(adaptPokemon(ex, undefined, "/x").name).toBe("Charizard");

    const v = baseCard({ name: "Surfing Pikachu V", isV: true });
    expect(adaptPokemon(v, undefined, "/x").name).toBe("Surfing Pikachu");

    const vstar = baseCard({ name: "Charizard VSTAR", isVstar: true });
    expect(adaptPokemon(vstar, undefined, "/x").name).toBe("Charizard");

    const vmax = baseCard({ name: "Flying Pikachu VMAX", isVmax: true });
    expect(adaptPokemon(vmax, undefined, "/x").name).toBe("Flying Pikachu");

    // No suffix: name passes through untouched.
    expect(adaptPokemon(baseCard({ name: "Lunala" }), undefined, "/x").name).toBe("Lunala");

    // Edge case: name already lacks the token even though the flag is set
    // (dirty upstream data). Don't mangle, return as-is.
    const weird = baseCard({ name: "Charizard", isEx: true });
    expect(adaptPokemon(weird, undefined, "/x").name).toBe("Charizard");
  });

  it("fans in the suffix flags by precedence (VSTAR > VMAX > V > ex)", () => {
    const both = baseCard({ isV: true, isVstar: true });
    expect(adaptPokemon(both, undefined, "/x").suffix).toBe("VSTAR");

    const vmaxAndV = baseCard({ isV: true, isVmax: true });
    expect(adaptPokemon(vmaxAndV, undefined, "/x").suffix).toBe("VMAX");

    const justEx = baseCard({ isEx: true });
    expect(adaptPokemon(justEx, undefined, "/x").suffix).toBe("ex");

    const plain = baseCard();
    expect(adaptPokemon(plain, undefined, "/x").suffix).toBeUndefined();
  });

  it("falls back to Colorless for unknown energy types", () => {
    const weird = baseCard({ energyTypes: ["Bug"] });
    expect(adaptPokemon(weird, undefined, "/x").type).toBe("Colorless");

    const noType = baseCard({ energyTypes: [] });
    expect(adaptPokemon(noType, undefined, "/x").type).toBe("Colorless");
  });

  it("normalizes stage (Stage1/Stage2/Basic survive; others drop)", () => {
    expect(adaptPokemon(baseCard({ stage: "Stage1" }), undefined, "/x").stage).toBe("Stage1");
    expect(adaptPokemon(baseCard({ stage: "VMAX" }), undefined, "/x").stage).toBeUndefined();
    expect(adaptPokemon(baseCard({ stage: undefined }), undefined, "/x").stage).toBeUndefined();
  });

  it("picks the first ability when multiple are present", () => {
    const card = baseCard();
    const detail = baseDetail(card, {
      abilities: [
        { name: "First", type: "Ability", effect: "do thing" },
        { name: "Second", type: "Ability", effect: "do other thing" },
      ],
    });
    const lab = adaptPokemon(card, detail, "/x");
    expect(lab.ability).toEqual({ name: "First", effect: "do thing" });
  });

  it("works without detail (still renders, no attacks/abilities)", () => {
    const lab = adaptPokemon(baseCard(), undefined, "/x");
    expect(lab.attacks).toEqual([]);
    expect(lab.ability).toBeUndefined();
    expect(lab.weakness).toBeUndefined();
    expect(lab.resistance).toBeUndefined();
  });

  it("defaults hp and retreat to 0 when missing", () => {
    const lab = adaptPokemon(
      baseCard({ hp: undefined, retreat: undefined }),
      undefined,
      "/x",
    );
    expect(lab.hp).toBe(0);
    expect(lab.retreat).toBe(0);
  });
});

describe("adaptTrainer", () => {
  it("maps trainerType through (Item/Supporter/Tool/Stadium)", () => {
    const supporter = baseCard({ category: "Trainer", trainerType: "Supporter", name: "Arven" });
    expect(adaptTrainer(supporter, undefined, "/x").trainerType).toBe("Supporter");

    const tool = baseCard({ category: "Trainer", trainerType: "Tool", name: "Forest Seal Stone" });
    expect(adaptTrainer(tool, undefined, "/x").trainerType).toBe("Tool");
  });

  it("routes category=Energy with effect text as Special Energy", () => {
    const card = baseCard({ category: "Energy", name: "Double Turbo Energy", trainerType: undefined });
    const detail = baseDetail(card, { effect: "Provides {C}{C}." });
    expect(adaptTrainer(card, detail, "/x").trainerType).toBe("Special Energy");
    expect(adaptTrainer(card, detail, "/x").effect).toBe("Provides {C}{C}.");
  });

  it("defaults unknown trainerType to Item rather than blowing up", () => {
    const weird = baseCard({ category: "Trainer", trainerType: undefined });
    expect(adaptTrainer(weird, undefined, "/x").trainerType).toBe("Item");
  });
});

describe("adaptBasicEnergy", () => {
  it("builds a footer from set name and localId", () => {
    const card = baseCard({
      category: "Energy",
      name: "Fire Energy",
      energyTypes: ["Fire"],
      setName: "Scarlet & Violet",
      localId: "230",
    });
    const lab = adaptBasicEnergy(card, "/fire.png");
    expect(lab).toEqual({
      name: "Fire Energy",
      energyType: "Fire",
      artUrl: "/fire.png",
      footer: "Scarlet & Violet • 230",
    });
  });
});
