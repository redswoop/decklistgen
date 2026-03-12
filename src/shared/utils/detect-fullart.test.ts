import { describe, expect, it } from "bun:test";
import { isFullArt } from "./detect-fullart.js";
import type { TcgdexCard } from "../types/card.js";

function makeCard(overrides: Partial<TcgdexCard> = {}): TcgdexCard {
  return {
    id: "test-1",
    localId: "1",
    name: "Pikachu",
    category: "Pokemon",
    ...overrides,
  };
}

describe("isFullArt", () => {
  it("returns false for a standard card", () => {
    expect(isFullArt(makeCard())).toBe(false);
  });

  it("detects ex Pokemon", () => {
    expect(isFullArt(makeCard({ name: "Charizard ex" }))).toBe(true);
  });

  it("detects V Pokemon", () => {
    expect(isFullArt(makeCard({ name: "Arceus V" }))).toBe(true);
  });

  it("does not flag Pokemon ending in IV as V", () => {
    expect(isFullArt(makeCard({ name: "Moltres IV" }))).toBe(false);
  });

  it("detects VMAX by stage", () => {
    expect(isFullArt(makeCard({ name: "Charizard VMAX", stage: "VMAX" }))).toBe(true);
  });

  it("detects VSTAR by stage", () => {
    expect(isFullArt(makeCard({ name: "Arceus VSTAR", stage: "VSTAR" }))).toBe(true);
  });

  it("detects illustration rare rarity", () => {
    expect(isFullArt(makeCard({ rarity: "Illustration Rare" }))).toBe(true);
  });

  it("detects special illustration rare", () => {
    expect(isFullArt(makeCard({ rarity: "Special Illustration Rare" }))).toBe(true);
  });

  it("detects double rare (SV-era)", () => {
    expect(isFullArt(makeCard({ rarity: "Double Rare" }))).toBe(true);
  });

  it("detects ACE SPEC Rare as full art", () => {
    expect(isFullArt(makeCard({
      name: "Prime Catcher",
      category: "Trainer",
      rarity: "ACE SPEC Rare",
      localId: "157",
      set: { id: "sv05", name: "Temporal Forces", cardCount: { official: 162, total: 218 } },
    }))).toBe(true);
  });

  it("detects Trainer Gallery (TG) cards as full art", () => {
    expect(isFullArt(makeCard({
      name: "Hoothoot",
      localId: "TG12",
      rarity: "Rare",
      set: { id: "swsh10", name: "Astral Radiance", cardCount: { official: 189, total: 246 } },
    }))).toBe(true);
  });

  it("detects Galarian Gallery (GG) cards as full art", () => {
    expect(isFullArt(makeCard({
      name: "Pikachu",
      localId: "GG30",
      rarity: "Rare",
      set: { id: "swsh12.5", name: "Crown Zenith", cardCount: { official: 159, total: 230 } },
    }))).toBe(true);
  });

  it("detects secret rares by card number exceeding official count", () => {
    expect(isFullArt(makeCard({
      localId: "200",
      set: { id: "swsh10", name: "Astral Radiance", cardCount: { official: 189, total: 246 } },
    }))).toBe(true);
  });

  it("returns false for card within official count", () => {
    expect(isFullArt(makeCard({
      localId: "50",
      set: { id: "swsh10", name: "Astral Radiance", cardCount: { official: 189, total: 246 } },
    }))).toBe(false);
  });
});
