import { describe, it, expect } from "bun:test";
import { SAMPLE_CARDS } from "./sample-cards";
import type { EnergyType } from "./types";

const VALID_TYPES: ReadonlySet<EnergyType> = new Set([
  "Grass", "Fire", "Water", "Lightning", "Psychic",
  "Fighting", "Darkness", "Metal", "Fairy", "Dragon", "Colorless",
]);

describe("sample lab cards", () => {
  it("has at least one card per stage variant the lab should exercise", () => {
    expect(SAMPLE_CARDS.some(c => c.evolvesFrom)).toBe(true);    // evolution
    expect(SAMPLE_CARDS.some(c => c.ability)).toBe(true);         // ability slot
    expect(SAMPLE_CARDS.some(c => c.suffix)).toBe(true);          // suffix logo
  });

  it("every attack cost uses a valid energy type", () => {
    for (const card of SAMPLE_CARDS) {
      for (const atk of card.attacks) {
        for (const t of atk.cost) {
          expect(VALID_TYPES.has(t)).toBe(true);
        }
      }
    }
  });

  it("every card's primary type, weakness, and resistance type is valid", () => {
    for (const card of SAMPLE_CARDS) {
      expect(VALID_TYPES.has(card.type)).toBe(true);
      if (card.weakness)   expect(VALID_TYPES.has(card.weakness.type)).toBe(true);
      if (card.resistance) expect(VALID_TYPES.has(card.resistance.type)).toBe(true);
    }
  });

  it("hp and retreat are non-negative", () => {
    for (const card of SAMPLE_CARDS) {
      expect(card.hp).toBeGreaterThan(0);
      expect(card.retreat).toBeGreaterThanOrEqual(0);
    }
  });
});
