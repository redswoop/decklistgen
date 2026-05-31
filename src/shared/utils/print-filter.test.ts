import { describe, expect, test } from "bun:test";
import { shouldPrintCard, isSpecialEnergy, isBasicEnergy } from "./print-filter.js";
import type { Card, CardDetail } from "../types/card.js";

function card(partial: Partial<Card>): Card {
  return {
    id: "x", localId: "1", name: "X", imageBase: "", category: "Pokemon",
    rarity: "Common", energyTypes: [], setId: "s", setCode: "S", setName: "S",
    era: "sv", ...partial,
  } as Card;
}

const NONE = { exclude: new Set<string>(), noBasicEnergy: false };
const withEffect: CardDetail = { ...card({ category: "Energy" }), effect: "does a thing" } as CardDetail;
const noEffect = undefined;

describe("energy classification", () => {
  test("special energy = Energy with effect text", () => {
    expect(isSpecialEnergy(card({ category: "Energy" }), withEffect)).toBe(true);
    expect(isSpecialEnergy(card({ category: "Energy" }), noEffect)).toBe(false);
    expect(isSpecialEnergy(card({ category: "Pokemon" }), withEffect)).toBe(false);
  });
  test("basic energy = Energy without effect text", () => {
    expect(isBasicEnergy(card({ category: "Energy" }), noEffect)).toBe(true);
    expect(isBasicEnergy(card({ category: "Energy" }), withEffect)).toBe(false);
  });
});

describe("shouldPrintCard — special energy is its own bucket", () => {
  const special = card({ category: "Energy", name: "Jet Energy" });

  test("special energy is NOT excluded by the Pokemon filter", () => {
    expect(shouldPrintCard(special, withEffect, { ...NONE, exclude: new Set(["pokemon"]) })).toBe(true);
  });

  test("special energy is NOT excluded by any Trainer filter", () => {
    const allTrainers = new Set(["supporters", "items", "tools", "stadiums"]);
    expect(shouldPrintCard(special, withEffect, { ...NONE, exclude: allTrainers })).toBe(true);
  });

  test("special energy is NOT excluded by the basic-energy toggle", () => {
    expect(shouldPrintCard(special, withEffect, { ...NONE, noBasicEnergy: true })).toBe(true);
  });

  test("special energy IS excluded only by its own filter", () => {
    expect(shouldPrintCard(special, withEffect, { ...NONE, exclude: new Set(["specialenergy"]) })).toBe(false);
  });
});

describe("shouldPrintCard — other categories", () => {
  test("pokemon", () => {
    const p = card({ category: "Pokemon" });
    expect(shouldPrintCard(p, undefined, NONE)).toBe(true);
    expect(shouldPrintCard(p, undefined, { ...NONE, exclude: new Set(["pokemon"]) })).toBe(false);
  });

  test("trainer subtypes map to plural keys", () => {
    const item = card({ category: "Trainer", trainerType: "Item" });
    const supporter = card({ category: "Trainer", trainerType: "Supporter" });
    expect(shouldPrintCard(item, undefined, { ...NONE, exclude: new Set(["items"]) })).toBe(false);
    expect(shouldPrintCard(item, undefined, { ...NONE, exclude: new Set(["supporters"]) })).toBe(true);
    expect(shouldPrintCard(supporter, undefined, { ...NONE, exclude: new Set(["supporters"]) })).toBe(false);
  });

  test("basic energy excluded only by noBasicEnergy, not specialenergy", () => {
    const basic = card({ category: "Energy", name: "Grass Energy" });
    expect(shouldPrintCard(basic, undefined, { ...NONE, noBasicEnergy: true })).toBe(false);
    expect(shouldPrintCard(basic, undefined, { ...NONE, exclude: new Set(["specialenergy"]) })).toBe(true);
  });
});
