import { describe, it, expect } from "bun:test";
import {
  isRareCandy,
  ballSpec,
  ballCanFetch,
  botSupporter,
  isBattleVipPass,
} from "./setup-cards.js";
import type { Card } from "../types/card.js";

function mk(partial: Partial<Card> & { name: string }): Card {
  return {
    id: partial.id ?? partial.name.toLowerCase().replace(/\s+/g, "-"),
    localId: "1",
    name: partial.name,
    imageBase: "",
    category: partial.category ?? "Trainer",
    trainerType: partial.trainerType,
    rarity: "Common",
    energyTypes: [],
    setId: "x",
    setCode: "X",
    setName: "X",
    era: "sv",
    hp: partial.hp,
    stage: partial.stage,
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
    mechanicsHash: "x",
    illustrator: "",
    ...partial,
  };
}

describe("isRareCandy", () => {
  it("matches Rare Candy case-insensitively", () => {
    expect(isRareCandy(mk({ name: "Rare Candy", trainerType: "Item" }))).toBe(true);
    expect(isRareCandy(mk({ name: "rare candy" }))).toBe(true);
    expect(isRareCandy(mk({ name: "Quick Ball" }))).toBe(false);
  });
});

describe("ballSpec", () => {
  it("returns specs for the four balls and null otherwise", () => {
    expect(ballSpec(mk({ name: "Quick Ball" }))).toEqual({ kind: "quick", discard: 1, fetch: "basic" });
    expect(ballSpec(mk({ name: "Nest Ball" }))).toEqual({ kind: "nest", discard: 0, fetch: "basic" });
    expect(ballSpec(mk({ name: "Level Ball" }))).toEqual({ kind: "level", discard: 0, fetch: "pokemon-hp-le-90" });
    expect(ballSpec(mk({ name: "Ultra Ball" }))).toEqual({ kind: "ultra", discard: 2, fetch: "any-pokemon" });
    expect(ballSpec(mk({ name: "Great Ball" }))).toBeNull();
  });
});

describe("ballCanFetch", () => {
  const quick = ballSpec(mk({ name: "Quick Ball" }))!;
  const level = ballSpec(mk({ name: "Level Ball" }))!;
  const ultra = ballSpec(mk({ name: "Ultra Ball" }))!;

  it("basic-only balls fetch Basics, not evolutions", () => {
    expect(ballCanFetch(quick, mk({ name: "Charmander", category: "Pokemon", stage: "Basic" }))).toBe(true);
    expect(ballCanFetch(quick, mk({ name: "Charizard ex", category: "Pokemon", stage: "Stage2" }))).toBe(false);
  });
  it("level ball respects HP<=90", () => {
    expect(ballCanFetch(level, mk({ name: "Charmander", category: "Pokemon", stage: "Basic", hp: 70 }))).toBe(true);
    expect(ballCanFetch(level, mk({ name: "Snorlax", category: "Pokemon", stage: "Basic", hp: 150 }))).toBe(false);
  });
  it("ultra ball fetches any Pokemon", () => {
    expect(ballCanFetch(ultra, mk({ name: "Charizard ex", category: "Pokemon", stage: "Stage2" }))).toBe(true);
    expect(ballCanFetch(ultra, mk({ name: "Boss's Orders", category: "Trainer" }))).toBe(false);
  });
});

describe("botSupporter", () => {
  it("classifies understood supporters", () => {
    expect(botSupporter(mk({ name: "Professor's Research", trainerType: "Supporter" }))).toBe("professors-research");
    expect(botSupporter(mk({ name: "Iono", trainerType: "Supporter" }))).toBe("iono");
    expect(botSupporter(mk({ name: "Arven", trainerType: "Supporter" }))).toBe("arven");
    expect(botSupporter(mk({ name: "Boss's Orders", trainerType: "Supporter" }))).toBeNull();
  });
});

describe("isBattleVipPass", () => {
  it("matches Battle VIP Pass", () => {
    expect(isBattleVipPass(mk({ name: "Battle VIP Pass", trainerType: "Item" }))).toBe(true);
    expect(isBattleVipPass(mk({ name: "Nest Ball" }))).toBe(false);
  });
});
