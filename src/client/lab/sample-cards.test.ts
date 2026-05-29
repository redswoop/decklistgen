import { describe, it, expect } from "bun:test";
import { SAMPLE_CARDS, SAMPLE_TRAINERS, SAMPLE_BASIC_ENERGIES } from "./sample-cards";
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

describe("sample basic energies", () => {
  it("ships at least one basic energy (CardBasicEnergy regression coverage)", () => {
    expect(SAMPLE_BASIC_ENERGIES.length).toBeGreaterThan(0);
  });

  it("every basic energy declares a valid energy type", () => {
    for (const card of SAMPLE_BASIC_ENERGIES) {
      expect(VALID_TYPES.has(card.energyType)).toBe(true);
      expect(card.name).toBeTruthy();
      expect(card.artUrl).toBeTruthy();
    }
  });
});

describe("sample trainers", () => {
  /*
   * Special Energy cards route through CardTrainer (the SVG renderer does the
   * same via enrich-card-data.ts setting trainerType="Special Energy"). The
   * lab's trainer header swaps gradient + tag text based on this value, so
   * we want at least one to keep that branch exercised.
   */
  it("includes at least one Special Energy regression card", () => {
    const specials = SAMPLE_TRAINERS.filter(t => t.trainerType === "Special Energy");
    expect(specials.length).toBeGreaterThan(0);
  });
});
