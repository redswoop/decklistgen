import { describe, it, expect } from "bun:test";
import { classifyCard, classifyAbility, type SetupRule } from "./setup-rules.js";
import type { Card } from "../types/card.js";

function pokemon(name: string, stage: string, abilities: Array<{ name: string; effect: string }>): Card & { abilities?: Array<{ name: string; effect: string }> } {
  return {
    id: name, localId: "1", name, imageBase: "", category: "Pokemon", rarity: "C",
    energyTypes: [], setId: "x", setCode: "X", setName: "X", era: "sv", stage,
    isFullArt: false, isEx: false, isV: false, isVmax: false, isVstar: false,
    isAncient: false, isFuture: false, isTera: false, hasFoil: false,
    isPrintUnfriendly: false, mechanicsHash: "x", illustrator: "", abilities,
  };
}

function trainer(name: string, trainerType: Card["trainerType"], effect?: string): Card & { effect?: string } {
  return {
    id: name, localId: "1", name, imageBase: "", category: "Trainer", trainerType,
    rarity: "C", energyTypes: [], setId: "x", setCode: "X", setName: "X", era: "sv",
    isFullArt: false, isEx: false, isV: false, isVmax: false, isVstar: false,
    isAncient: false, isFuture: false, isTera: false, hasFoil: false,
    isPrintUnfriendly: false, mechanicsHash: "x", illustrator: "", effect,
  };
}

const cap = (r: SetupRule | null) => r?.cap;

describe("classifyCard — effect-text inference", () => {
  it("Buddy-Buddy Poffin → bench up to 2 basics ≤70 HP", () => {
    const r = classifyCard(trainer("Buddy-Buddy Poffin", "Item",
      "Search your deck for up to 2 Basic Pokémon with 70 HP or less and put them onto your Bench. Then, shuffle your deck."));
    expect(cap(r)).toEqual({ type: "bench-basics", count: 2, maxHp: 70 });
    expect(r?.source).toBe("item");
  });

  it("Poké Pad → search a non-rule-box Pokémon to hand", () => {
    const r = classifyCard(trainer("Poké Pad", "Item",
      "Search your deck for a Pokémon that doesn't have a Rule Box, reveal it, and put it into your hand. Then, shuffle your deck."));
    expect(cap(r)).toEqual({ type: "search-pokemon", restrict: "non-rule-box", count: 1, maxHp: undefined });
  });

  it("Ultra Ball → search any Pokémon, discard 2", () => {
    const r = classifyCard(trainer("Ultra Ball", "Item",
      "You can use this card only if you discard 2 other cards from your hand. Search your deck for a Pokémon, reveal it, and put it into your hand. Then, shuffle your deck."));
    expect(cap(r)).toEqual({ type: "search-pokemon", restrict: "any", count: 1, maxHp: undefined });
    expect(r?.discard).toBe(2);
  });

  it("Hilda → search an Evolution Pokémon to hand", () => {
    const r = classifyCard(trainer("Hilda", "Supporter",
      "Search your deck for an Evolution Pokémon and an Energy card, reveal them, and put them into your hand. Then, shuffle your deck."));
    expect(cap(r)).toEqual({ type: "search-pokemon", restrict: "evolution", count: 1, maxHp: undefined });
    expect(r?.source).toBe("supporter");
  });

  it("Dawn → search the whole line to hand", () => {
    const r = classifyCard(trainer("Dawn", "Supporter",
      "Search your deck for a Basic Pokémon, a Stage 1 Pokémon, and a Stage 2 Pokémon, reveal them, and put them into your hand. Then, shuffle your deck."));
    expect(cap(r)).toEqual({ type: "search-line" });
  });

  it("Team Rocket's Petrel → search any Trainer to hand", () => {
    const r = classifyCard(trainer("Team Rocket's Petrel", "Supporter",
      "Search your deck for a Trainer card, reveal it, and put it into your hand. Then, shuffle your deck."));
    expect(cap(r)).toEqual({ type: "search-trainer" });
  });

  it("Pokégear 3.0 → search a Supporter to hand", () => {
    const r = classifyCard(trainer("Pokégear 3.0", "Item",
      "Look at the top 7 cards of your deck. You may reveal a Supporter card you find there and put it into your hand. Shuffle the other cards back into your deck."));
    expect(cap(r)).toEqual({ type: "search-supporter" });
  });

  it("Lillie's Determination → shuffle-draw, uses the larger (8) count", () => {
    const r = classifyCard(trainer("Lillie's Determination", "Supporter",
      "Shuffle your hand into your deck. Then, draw 6 cards. If you have exactly 6 Prize cards remaining, draw 8 cards instead."));
    expect(cap(r)).toEqual({ type: "draw", amount: 8, shuffleHand: true });
  });

  it("Cheren → draw 3", () => {
    const r = classifyCard(trainer("Cheren", "Supporter", "Draw 3 cards."));
    expect(cap(r)).toEqual({ type: "draw", amount: 3, shuffleHand: false });
  });

  it("Iris's Fighting Spirit → draw up to 6 (draw-to)", () => {
    const r = classifyCard(trainer("Iris's Fighting Spirit", "Supporter",
      "You can use this card only if you discard another card from your hand. Draw cards until you have 6 cards in your hand."));
    expect(cap(r)).toEqual({ type: "draw-to", size: 6 });
    expect(r?.discard).toBe(1);
  });

  it("Poké Ball → coin-flip search any Pokémon", () => {
    const r = classifyCard(trainer("Poké Ball", "Item",
      "Flip a coin. If heads, search your deck for a Pokémon, reveal it, and put it into your hand. Then, shuffle your deck."));
    expect(cap(r)).toEqual({ type: "search-pokemon", restrict: "any", count: 1, maxHp: undefined });
    expect(r?.coinFlip).toBe(true);
  });

  it("Arven → search a Trainer/Item (not a Pokémon, despite 'Pokémon Tool')", () => {
    const r = classifyCard(trainer("Arven", "Supporter",
      "Search your deck for an Item card and a Pokémon Tool card, reveal them, and put them into your hand. Then, shuffle your deck."));
    expect(cap(r)).toEqual({ type: "search-trainer" });
  });

  it("Fighting Gong → typed Basic search carries the energy restriction", () => {
    const r = classifyCard(trainer("Fighting Gong", "Item",
      "Search your deck for a Basic {F} Energy card or a Basic {F} Pokémon, reveal it, and put it into your hand. Then, shuffle your deck."));
    expect(cap(r)).toEqual({ type: "search-pokemon", restrict: "basic", count: 1, maxHp: undefined, energyType: "Fighting" });
  });

  it("Rare Candy → rare-candy", () => {
    const r = classifyCard(trainer("Rare Candy", "Item",
      "Choose 1 of your Basic Pokémon in play. If you have a Stage 2 card in your hand that evolves from that Pokémon, put that card onto the Basic Pokémon to evolve it, skipping the Stage 1."));
    expect(cap(r)).toEqual({ type: "rare-candy" });
  });

  it("ignores non-setup effects (heal, switch, energy, tools, stadiums)", () => {
    expect(classifyCard(trainer("Potion", "Item", "Heal 30 damage from 1 of your Pokémon."))).toBeNull();
    expect(classifyCard(trainer("Switch", "Item", "Switch your Active Pokémon with 1 of your Benched Pokémon."))).toBeNull();
    expect(classifyCard(trainer("Boss's Orders", "Supporter", "Switch in 1 of your opponent's Benched Pokémon to the Active Spot."))).toBeNull();
    expect(classifyCard(trainer("Energy Switch", "Item", "Move a Basic Energy from 1 of your Pokémon to another of your Pokémon."))).toBeNull();
    expect(classifyCard(trainer("Air Balloon", "Tool", "The Retreat Cost of the Pokémon this card is attached to is less."))).toBeNull();
  });

  it("does not mistake an Energy search for a Pokémon search (object isolation)", () => {
    // Crispin searches Energy, then 'attach … to 1 of your Pokémon' — must NOT be a Pokémon tutor.
    expect(classifyCard(trainer("Crispin", "Supporter",
      "Search your deck for up to 2 Basic Energy cards of different types, reveal them, and put 1 of them into your hand. Attach the other to 1 of your Pokémon. Then, shuffle your deck."))).toBeNull();
    expect(classifyCard(trainer("Energy Search", "Item",
      "Search your deck for a Basic Energy card, reveal it, and put it into your hand. Then, shuffle your deck."))).toBeNull();
  });
});

describe("classifyCard — name fallback (no effect text)", () => {
  it("recognizes Rare Candy, balls, and known supporters by name", () => {
    expect(cap(classifyCard(trainer("Rare Candy", "Item")))).toEqual({ type: "rare-candy" });
    expect(cap(classifyCard(trainer("Nest Ball", "Item")))).toEqual({ type: "bench-basics", count: 1 });
    expect(cap(classifyCard(trainer("Ultra Ball", "Item")))).toEqual({ type: "search-pokemon", restrict: "any", count: 1, maxHp: undefined });
    expect(cap(classifyCard(trainer("Professor's Research", "Supporter")))).toEqual({ type: "draw", amount: 7, shuffleHand: true });
    expect(cap(classifyCard(trainer("Arven", "Supporter")))).toEqual({ type: "search-trainer" });
  });
});

describe("classifyAbility", () => {
  const cap = (r: ReturnType<typeof classifyAbility>) => r?.cap;

  it("Genesect ex Metallic Signal → active-turn search for Evolution Metal Pokémon", () => {
    const r = classifyAbility(pokemon("Genesect ex", "Basic", [{ name: "Metallic Signal",
      effect: "Once during your turn, you may search your deck for up to 2 Evolution {M} Pokémon, reveal them, and put them into your hand. Then, shuffle your deck." }]));
    expect(cap(r)).toEqual({ type: "search-pokemon", restrict: "evolution", count: 2, maxHp: undefined, energyType: "Metal" });
    expect(r?.trigger).toBe("active-turn");
  });

  it("Meowth ex Last-Ditch Catch → on-bench search for a Supporter", () => {
    const r = classifyAbility(pokemon("Meowth ex", "Basic", [{ name: "Last-Ditch Catch",
      effect: "Once during your turn, when you play this Pokémon from your hand onto your Bench, you may use this Ability. Search your deck for a Supporter card, reveal it, and put it into your hand. Then, shuffle your deck." }]));
    expect(cap(r)).toEqual({ type: "search-supporter" });
    expect(r?.trigger).toBe("on-bench");
  });

  it("Lunatone Lunar Cycle → draw 3, needs energy + Solrock in play", () => {
    const r = classifyAbility(pokemon("Lunatone", "Basic", [{ name: "Lunar Cycle",
      effect: "Once during your turn, if you have Solrock in play, you may discard a Basic {F} Energy card from your hand in order to use this Ability. Draw 3 cards." }]));
    expect(cap(r)).toEqual({ type: "draw", amount: 3, shuffleHand: false });
    expect(r?.requiresEnergy).toBe(true);
    expect(r?.requiresInPlay).toBe("solrock");
  });

  it("skips situational (Knock Out) abilities like Fezandipiti's Flip the Script", () => {
    expect(classifyAbility(pokemon("Fezandipiti ex", "Basic", [{ name: "Flip the Script",
      effect: "Once during your turn, if any of your Pokémon were Knocked Out during your opponent's last turn, you may draw 3 cards." }]))).toBeNull();
  });

  it("classifies evolution-stage draw engines", () => {
    expect(cap(classifyAbility(pokemon("Dudunsparce", "Stage1", [{ name: "Run Away Draw",
      effect: "Once during your turn, you may draw 3 cards. If you drew any cards in this way, shuffle this Pokémon and all attached cards into your deck." }]))))
      .toEqual({ type: "draw", amount: 3, shuffleHand: false });

    expect(cap(classifyAbility(pokemon("Bibarel", "Stage1", [{ name: "Industrious Incisors",
      effect: "Once during your turn, you may draw cards until you have 5 cards in your hand." }]))))
      .toEqual({ type: "draw-to", size: 5 });

    const delphox = classifyAbility(pokemon("Delphox", "Stage2", [{ name: "Flare Magic",
      effect: "Once during your turn, you may discard a Basic Fire Energy card from your hand in order to use this Ability. Draw cards until you have 7 cards in your hand." }]));
    expect(cap(delphox)).toEqual({ type: "draw-to", size: 7 });
    expect(delphox?.requiresEnergy).toBe(true);
  });

  it("skips passive/static abilities", () => {
    expect(classifyAbility(pokemon("Shaymin", "Basic", [{ name: "Flower Curtain",
      effect: "Prevent all damage done to your Benched Pokémon that don't have a Rule Box by attacks from your opponent's Pokémon." }]))).toBeNull();
  });
});
