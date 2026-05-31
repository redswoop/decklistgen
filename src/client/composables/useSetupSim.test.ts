import { describe, it, expect } from "bun:test";
import { attachChains } from "./useSetupSim.js";
import type { Card } from "../../shared/types/card.js";

function mk(id: string, name: string, category: Card["category"] = "Pokemon"): Card {
  return {
    id,
    localId: "1",
    name,
    imageBase: "",
    category,
    rarity: "Common",
    energyTypes: [],
    setId: "x",
    setCode: "X",
    setName: "X",
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
    isPrintUnfriendly: false,
    mechanicsHash: "x",
    illustrator: "",
  };
}

describe("attachChains", () => {
  it("attaches resolved chains by card id and leaves others bare", () => {
    const cards = [mk("a", "Charizard ex"), mk("a", "Charizard ex"), mk("b", "Rare Candy", "Trainer")];
    const evolutions = new Map([
      ["a", { stage: "Stage2", chain: ["Charmander", "Charmeleon", "Charizard ex"] }],
    ]);
    const out = attachChains(cards, evolutions);
    expect(out[0].chain).toEqual(["Charmander", "Charmeleon", "Charizard ex"]);
    expect(out[1].chain).toEqual(["Charmander", "Charmeleon", "Charizard ex"]);
    expect(out[2].chain).toBeUndefined();
  });

  it("returns a fresh copy, never mutating the input cards", () => {
    const cards = [mk("a", "Pidgeot ex")];
    const out = attachChains(cards, new Map([["a", { stage: "Stage2", chain: ["Pidgey", "Pidgeot ex"] }]]));
    expect(out[0]).not.toBe(cards[0]);
    expect((cards[0] as Card & { chain?: string[] }).chain).toBeUndefined();
  });
});
