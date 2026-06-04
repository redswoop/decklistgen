import { describe, expect, test } from "bun:test";
import { isSpecialEnergy, isBasicEnergy } from "./energy.js";
import type { Card, CardDetail } from "../types/card.js";

function card(partial: Partial<Card>): Card {
  return {
    id: "x", localId: "1", name: "X", imageBase: "", category: "Pokemon",
    rarity: "Common", energyTypes: [], setId: "s", setCode: "S", setName: "S",
    era: "sv", ...partial,
  } as Card;
}

const withEffect = { effect: "does a thing" } as CardDetail;

describe("isSpecialEnergy — Energy with effect text", () => {
  test("Energy + effect → true", () => {
    expect(isSpecialEnergy(card({ category: "Energy" }), withEffect)).toBe(true);
  });
  test("Energy without effect → false", () => {
    expect(isSpecialEnergy(card({ category: "Energy" }), undefined)).toBe(false);
  });
  test("non-Energy is never special energy", () => {
    expect(isSpecialEnergy(card({ category: "Pokemon" }), withEffect)).toBe(false);
  });
});

describe("isBasicEnergy — Energy with mechanicsHash 'basic'", () => {
  test("Energy + basic hash → true", () => {
    expect(isBasicEnergy(card({ category: "Energy", mechanicsHash: "basic" }))).toBe(true);
  });
  test("Energy with a non-basic hash (special) → false", () => {
    expect(isBasicEnergy(card({ category: "Energy", mechanicsHash: "abc123" }))).toBe(false);
  });
  test("non-Energy is never basic energy", () => {
    expect(isBasicEnergy(card({ category: "Pokemon", mechanicsHash: "basic" }))).toBe(false);
  });
});
