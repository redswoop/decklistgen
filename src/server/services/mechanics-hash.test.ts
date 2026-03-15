import { describe, expect, it } from "bun:test";
import { computeMechanicsHash } from "./mechanics-hash.js";
import type { TcgdexCard } from "../../shared/types/card.js";

function makeCard(overrides: Partial<TcgdexCard> = {}): TcgdexCard {
  return {
    id: "test-001",
    localId: "001",
    name: "Test Pokemon",
    category: "Pokemon",
    hp: 100,
    stage: "Basic",
    retreat: 1,
    attacks: [{ name: "Tackle", cost: ["Colorless"], damage: "30" }],
    abilities: [],
    weaknesses: [{ type: "Fire", value: "+20" }],
    resistances: [],
    ...overrides,
  };
}

describe("computeMechanicsHash", () => {
  it("same ability/attack names produce same hash regardless of other fields", () => {
    const a = makeCard({ id: "set1-001", hp: 100, retreat: 1 });
    const b = makeCard({ id: "set2-001", hp: 120, retreat: 2 });
    expect(computeMechanicsHash(a)).toBe(computeMechanicsHash(b));
  });

  it("different attack names produce different hash", () => {
    const a = makeCard({
      attacks: [{ name: "Tackle", cost: ["Colorless"], damage: "30" }],
    });
    const b = makeCard({
      attacks: [{ name: "Thunder Shock", cost: ["Lightning"], damage: "40" }],
    });
    expect(computeMechanicsHash(a)).not.toBe(computeMechanicsHash(b));
  });

  it("different HP does NOT affect hash (only names matter)", () => {
    const a = makeCard({ hp: 60 });
    const b = makeCard({ hp: 120 });
    expect(computeMechanicsHash(a)).toBe(computeMechanicsHash(b));
  });

  it("different ability names produce different hash", () => {
    const a = makeCard({
      abilities: [{ name: "Volt Absorb", type: "Ability", effect: "Heal 30" }],
    });
    const b = makeCard({
      abilities: [{ name: "Static", type: "Ability", effect: "Paralyze on contact" }],
    });
    expect(computeMechanicsHash(a)).not.toBe(computeMechanicsHash(b));
  });

  it("same ability/attack names with different effect text produce same hash", () => {
    const a = makeCard({
      abilities: [{ name: "Intrepid Sword", type: "Ability", effect: "Look at top 3 cards..." }],
    });
    const b = makeCard({
      abilities: [{ name: "Intrepid Sword", type: "Ability", effect: "Slightly different wording..." }],
    });
    expect(computeMechanicsHash(a)).toBe(computeMechanicsHash(b));
  });

  it("missing weaknesses/resistances does NOT affect hash", () => {
    const a = makeCard({
      weaknesses: [{ type: "Fire", value: "×2" }],
      resistances: [{ type: "Grass", value: "-30" }],
    });
    const b = makeCard({
      weaknesses: [],
      resistances: [],
    });
    expect(computeMechanicsHash(a)).toBe(computeMechanicsHash(b));
  });

  it("Professor variants with same trainerType produce same hash", () => {
    const sada: TcgdexCard = {
      id: "sv1-001",
      localId: "001",
      name: "Professor's Research (Professor Sada)",
      category: "Trainer",
      trainerType: "Supporter",
      effect: "Discard your hand and draw 7 cards.",
    };
    const magnolia: TcgdexCard = {
      id: "sv2-001",
      localId: "001",
      name: "Professor's Research (Professor Magnolia)",
      category: "Trainer",
      trainerType: "Supporter",
      effect: "Discard your hand and draw 7 cards.",
    };
    expect(computeMechanicsHash(sada)).toBe(computeMechanicsHash(magnolia));
  });

  it("different trainer types produce different hash", () => {
    const supporter: TcgdexCard = {
      id: "test-001",
      localId: "001",
      name: "Test Trainer",
      category: "Trainer",
      trainerType: "Supporter",
      effect: "Draw 3 cards.",
    };
    const item: TcgdexCard = {
      id: "test-002",
      localId: "002",
      name: "Test Trainer",
      category: "Trainer",
      trainerType: "Item",
      effect: "Draw 3 cards.",
    };
    expect(computeMechanicsHash(supporter)).not.toBe(computeMechanicsHash(item));
  });

  it("basic energy always returns 'basic'", () => {
    const fire: TcgdexCard = {
      id: "sv1-e1",
      localId: "e1",
      name: "Fire Energy",
      category: "Energy",
    };
    const water: TcgdexCard = {
      id: "sv1-e2",
      localId: "e2",
      name: "Water Energy",
      category: "Energy",
    };
    expect(computeMechanicsHash(fire)).toBe("basic");
    expect(computeMechanicsHash(water)).toBe("basic");
  });

  it("special energy returns 'special'", () => {
    const a: TcgdexCard = {
      id: "sv1-s1",
      localId: "s1",
      name: "Double Turbo Energy",
      category: "Energy",
      effect: "Provides 2 Colorless. Attacks do 20 less damage.",
    };
    const b: TcgdexCard = {
      id: "sv1-s2",
      localId: "s2",
      name: "Jet Energy",
      category: "Energy",
      effect: "Provides 1 Colorless. Switch in when attached.",
    };
    expect(computeMechanicsHash(a)).toBe("special");
    expect(computeMechanicsHash(b)).toBe("special");
    expect(computeMechanicsHash(a)).not.toBe("basic");
  });

  it("attack order does not affect hash (sorted by name)", () => {
    const a = makeCard({
      attacks: [
        { name: "Bite", cost: ["Darkness"], damage: "20" },
        { name: "Crunch", cost: ["Darkness", "Colorless"], damage: "60" },
      ],
    });
    const b = makeCard({
      attacks: [
        { name: "Crunch", cost: ["Darkness", "Colorless"], damage: "60" },
        { name: "Bite", cost: ["Darkness"], damage: "20" },
      ],
    });
    expect(computeMechanicsHash(a)).toBe(computeMechanicsHash(b));
  });
});
