import { describe, test, expect } from "bun:test";
import {
  EFFECT_FACETS,
  EFFECT_TAGS,
  UNTAGGED_FACET_LABEL,
  effectTagDef,
  facetLabelsOf,
  hasEffectTag,
  isEffectTag,
  tagCard,
  tagEffectText,
  type EffectTag,
} from "./effect-tags.js";
import { EFFECT_TAG_OVERRIDES } from "../constants/effect-tag-overrides.js";

// Real printed effect text → the tags it must produce, exactly. Add a row here
// (with the card's actual wording) whenever a rule changes.
const SUPPORTERS: Array<[name: string, tags: EffectTag[], effect: string]> = [
  ["Professor's Research", ["draw", "hand-refresh"], "Discard your hand and draw 7 cards."],
  ["Cheren", ["draw"], "Draw 3 cards."],
  ["Iono", ["draw", "hand-refresh", "disrupt:hand"],
    "Each player shuffles their hand and puts it on the bottom of their deck. If either player put any cards on the bottom of their deck in this way, each player draws a card for each of their remaining Prize cards."],
  ["Lillie's Determination", ["draw", "hand-refresh"],
    "Shuffle your hand into your deck. Then, draw 6 cards. If you have exactly 6 Prize cards remaining, draw 8 cards instead."],
  ["Brassius", ["draw", "hand-refresh"],
    "Count the cards in your hand, shuffle those cards into your deck, then draw that many cards plus 1."],
  ["Iris's Fighting Spirit", ["draw"],
    "You can use this card only if you discard another card from your hand. Draw cards until you have 6 cards in your hand."],
  // A dig that names what it takes is also a (limited) search for that kind.
  // "a Trainer card" can be any of the four Trainer kinds.
  ["Drayton", ["dig", "search:pokemon", "search:supporter", "search:item", "search:tool", "search:stadium"],
    "Look at the top 7 cards of your deck. You may reveal a Pokémon and a Trainer card you find there and put them into your hand. Shuffle the other cards back into your deck."],
  // …but one that takes any cards is not a pick-what-you-want search:any.
  ["Explorer's Guidance", ["dig"],
    "Look at the top 6 cards of your deck and put 2 of them into your hand. Discard the other cards."],
  // The opponent's deck, not yours: neither a dig nor a search.
  ["Miss Fortune Sisters", [],
    "Look at the top 5 cards of your opponent's deck and discard any number of Item cards you find there. Your opponent shuffles the other cards back into their deck."],
  ["Boss's Orders (SV wording)", ["gust"], "Switch in 1 of your opponent's Benched Pokémon to the Active Spot."],
  ["Boss's Orders (SWSH wording)", ["gust"], "Switch 1 of your opponent's Benched Pokémon with their Active Pokémon."],
  ["Lisia's Appeal", ["gust"],
    "Switch in 1 of your opponent's Benched Basic Pokémon to the Active Spot. If you do, the new Active Pokémon is now Confused."],
  ["Erika's Invitation", ["gust"],
    "Your opponent reveals their hand, and you put a Basic Pokémon you find there onto your opponent's Bench. If you put a Pokémon onto their Bench in this way, switch in that Pokémon to the Active Spot."],
  // The opponent picks the new Active Pokémon: a forced switch, not a gust.
  ["Ryme", ["draw", "forced-switch"],
    "Draw 3 cards. Switch out your opponent's Active Pokémon to the Bench. (Your opponent chooses the new Active Pokémon.)"],
  ["Kieran", ["switch", "damage-boost"],
    "Choose 1: • Switch your Active Pokémon with 1 of your Benched Pokémon. • During this turn, attacks used by your Pokémon do 30 more damage to your opponent's Active Pokémon ex and Active Pokémon V (before applying Weakness and Resistance)."],
  ["Team Rocket's Giovanni", ["gust", "switch"],
    "Switch your Active Team Rocket's Pokémon with 1 of your Benched Team Rocket's Pokémon. If you do, switch in 1 of your opponent's Benched Pokémon to the Active Spot."],
  ["Penny", ["scoop"], "Put 1 of your Basic Pokémon and all attached cards into your hand."],
  ["Professor Turo's Scenario", ["scoop"],
    "Put 1 of your Pokémon in play into your hand. (Discard all cards attached to that Pokémon.)"],
  ["Arven", ["search:item", "search:tool"],
    "Search your deck for an Item card and a Pokémon Tool card, reveal them, and put them into your hand. Then, shuffle your deck."],
  ["Team Rocket's Petrel", ["search:supporter", "search:item", "search:tool", "search:stadium"],
    "Search your deck for a Trainer card, reveal it, and put it into your hand. Then, shuffle your deck."],
  ["Dawn", ["search:pokemon"],
    "Search your deck for a Basic Pokémon, a Stage 1 Pokémon, and a Stage 2 Pokémon, reveal them, and put them into your hand. Then, shuffle your deck."],
  ["Hilda", ["search:pokemon", "search:energy"],
    "Search your deck for an Evolution Pokémon and an Energy card, reveal them, and put them into your hand. Then, shuffle your deck."],
  ["Colress's Tenacity", ["search:energy", "search:stadium"],
    "Search your deck for a Stadium card and an Energy card, reveal them, and put them into your hand. Then, shuffle your deck."],
  ["Cassiopeia", ["search:any"],
    "You can use this card only when it is the last card in your hand. Search your deck for up to 2 cards and put them into your hand. Then, shuffle your deck."],
  ["Crispin", ["search:energy", "energy-accel"],
    "Search your deck for up to 2 Basic Energy cards of different types, reveal them, and put 1 of them into your hand. Attach the other to 1 of your Pokémon. Then, shuffle your deck."],
  // "{D} Pokémon" only names where the Energy goes — not a Pokémon search.
  ["Janine's Secret Art", ["search:energy", "energy-accel"],
    "Choose up to 2 of your {D} Pokémon. For each of those Pokémon, search your deck for a Basic {D} Energy card and attach it to that Pokémon. Then, shuffle your deck. If you attached Energy to your Active Pokémon in this way, it is now Poisoned."],
  // "can't attack" is a drawback on yourself, not a lock.
  ["Geeta", ["search:energy", "energy-accel"],
    "Search your deck for up to 2 Basic Energy cards and attach them to 1 of your Pokémon. Then, shuffle your deck. During this turn, your Pokémon can't attack. (This includes Pokémon that come into play this turn.)"],
  ["Professor Sada's Vitality", ["draw", "energy-accel"],
    "Choose up to 2 of your Ancient Pokémon and attach a Basic Energy card from your discard pile to each of them. If you attached any Energy in this way, draw 3 cards."],
  ["N's Plan", ["energy-move"], "Move up to 2 Energy from your Benched Pokémon to your Active Pokémon."],
  ["Lana's Aid", ["recover"],
    "Put up to 3 in any combination of Pokémon that don't have a Rule Box and Basic Energy cards from your discard pile into your hand. (Pokémon ex, Pokémon V, etc. have Rule Boxes.)"],
  ["Miriam", ["draw", "recover"],
    "Shuffle up to 5 Pokémon from your discard pile into your deck. If you shuffled any cards into your deck in this way, draw 3 cards."],
  ["Cook", ["heal"], "Heal 70 damage from your Active Pokémon."],
  ["AZ's Tranquility", ["switch", "heal"],
    "Switch your Active Pokémon with 1 of your Benched Pokémon. If you moved a Pokémon ex to your Bench in this way, heal 80 damage from that Pokémon."],
  ["Eri", ["disrupt:hand"], "Your opponent reveals their hand, and you discard up to 2 Item cards you find there."],
  ["Xerosic's Machinations", ["disrupt:hand"],
    "Your opponent discards cards from their hand until they have 3 cards in their hand."],
  // Looking at the hand and drawing off it takes nothing from the opponent.
  ["Clive", ["draw"], "Your opponent reveals their hand, and you draw 2 cards for each Supporter card you find there."],
  ["Team Star Grunt", ["disrupt:energy"], "Put an Energy attached to your opponent's Active Pokémon on top of their deck."],
  ["Giacomo", ["disrupt:energy"], "Discard a Special Energy from each of your opponent's Pokémon."],
  ["Giovanni's Charisma", ["energy-accel", "disrupt:energy"],
    "Put an Energy attached to your opponent's Active Pokémon into their hand. If you do, attach an Energy card from your hand to your Active Pokémon."],
  ["Ruffian", ["disrupt:energy", "disrupt:tool-stadium"],
    "Discard a Pokémon Tool and a Special Energy from 1 of your opponent's Pokémon."],
  ["Roxie's Performance", ["lock"],
    "During your opponent's next turn, their Poisoned Pokémon can't retreat. (This includes newly Poisoned Pokémon.)"],
  // "(…you can't use this card.)" is a play condition, not a lock.
  ["Dendra", ["draw"],
    "Put a card from your hand on the bottom of your deck. If you do, draw cards until you have 5 cards in your hand. (If you have no other cards in your hand, you can't use this card.)"],
  ["Black Belt's Training", ["damage-boost"],
    "During this turn, attacks used by your Pokémon do 40 more damage to your opponent's Active Pokémon ex (before applying Weakness and Resistance)."],
  ["Jasmine's Gaze", ["damage-reduce"],
    "During your opponent's next turn, all of your Pokémon take 30 less damage from attacks from your opponent's Pokémon (after applying Weakness and Resistance). (This includes new Pokémon that come into play.)"],
  // "has no Abilities" describes the search target, not a lock.
  ["Salvatore", ["search:pokemon", "evolve"],
    "Search your deck for a card that has no Abilities and evolves from 1 of your Pokémon, and put it onto that Pokémon to evolve it. Then, shuffle your deck. You can use this card on a Pokémon you put down when you were setting up to play or on a Pokémon that was put into play this turn."],
  // Outside the taxonomy: an extra Prize card is none of the current tags.
  ["Briar", [],
    "You can use this card only if your opponent has exactly 2 Prize cards remaining. During this turn, if your opponent's Active Pokémon is Knocked Out by damage from an attack used by your Tera Pokémon, take 1 more Prize card."],
];

const ITEMS: Array<[name: string, tags: EffectTag[], effect: string]> = [
  ["Ultra Ball", ["search:pokemon"],
    "You can use this card only if you discard 2 other cards from your hand. Search your deck for a Pokémon, reveal it, and put it into your hand. Then, shuffle your deck."],
  ["Buddy-Buddy Poffin", ["search:pokemon"],
    "Search your deck for up to 2 Basic Pokémon with 70 HP or less and put them onto your Bench. Then, shuffle your deck."],
  ["Fighting Gong", ["search:pokemon", "search:energy"],
    "Search your deck for a Basic {F} Energy card or a Basic {F} Pokémon, reveal it, and put it into your hand. Then, shuffle your deck."],
  ["Earthen Vessel", ["search:energy"],
    "You can use this card only if you discard another card from your hand. Search your deck for up to 2 Basic Energy cards, reveal them, and put them into your hand. Then, shuffle your deck."],
  ["Secret Box", ["search:supporter", "search:item", "search:tool", "search:stadium"],
    "You can use this card only if you discard 3 other cards from your hand. Search your deck for an Item card, a Pokémon Tool card, a Supporter card, and a Stadium card, reveal them, and put them into your hand. Then, shuffle your deck."],
  // Not literally "search your deck", but it is how you find a Supporter.
  ["Pokégear 3.0", ["dig", "search:supporter"],
    "Look at the top 7 cards of your deck. You may reveal a Supporter card you find there and put it into your hand. Shuffle the other cards back into your deck."],
  ["Dusk Ball", ["dig", "search:pokemon"],
    "Look at the bottom 7 cards of your deck. You may reveal a Pokémon you find there and put it into your hand. Shuffle the other cards back into your deck."],
  ["Electric Generator", ["dig", "search:energy", "energy-accel"],
    "Look at the top 5 cards of your deck and attach up to 2 Basic {L} Energy cards you find there to your Benched {L} Pokémon in any way you like. Shuffle the other cards back into your deck."],
  ["Counter Catcher", ["gust"],
    "You can use this card only if you have more Prize cards remaining than your opponent. Switch in 1 of your opponent's Benched Pokémon to the Active Spot."],
  ["Prime Catcher", ["gust", "switch"],
    "Switch in 1 of your opponent's Benched Pokémon to the Active Spot. If you do, switch your Active Pokémon with 1 of your Benched Pokémon."],
  ["Switch", ["switch"], "Switch your Active Pokémon with 1 of your Benched Pokémon."],
  ["Scramble Switch", ["switch", "energy-move"],
    "Switch your Active Pokémon with 1 of your Benched Pokémon. If you do, you may move any amount of Energy from the Pokémon you moved to your Bench to the new Active Pokémon."],
  // Opponent chooses the replacement — a forced switch, not a gust.
  ["Repel", ["forced-switch"], "Switch out your opponent's Active Pokémon to the Bench. (Your opponent chooses the new Active Pokémon.)"],
  // Both players switch: yours is a switch, theirs is forced.
  ["Escape Rope", ["forced-switch", "switch"],
    "Each player switches their Active Pokémon with 1 of their Benched Pokémon. Your opponent switches first. (If a player does not have a Benched Pokémon, they don't switch Pokémon.)"],
  ["Scoop Up Cyclone", ["scoop"], "Put 1 of your Pokémon and all attached cards into your hand."],
  ["Energy Switch", ["energy-move"], "Move a Basic Energy from 1 of your Pokémon to another of your Pokémon."],
  ["Glass Trumpet", ["energy-accel"],
    "You can use this card only if you have any Tera Pokémon in play. Choose up to 2 of your Benched {C} Pokémon and attach a Basic Energy card from your discard pile to each of them."],
  ["Night Stretcher", ["recover"], "Put a Pokémon or a Basic Energy card from your discard pile into your hand."],
  ["Super Rod", ["recover"],
    "Shuffle up to 3 in any combination of Pokémon and Basic Energy cards from your discard pile into your deck."],
  ["Potion", ["heal"], "Heal 30 damage from 1 of your Pokémon."],
  ["Unfair Stamp", ["draw", "hand-refresh", "disrupt:hand"],
    "You can use this card only if any of your Pokémon were Knocked Out during your opponent's last turn. Each player shuffles their hand into their deck. Then, you draw 5 cards, and your opponent draws 2 cards."],
  // Only the opponent's hand moves, and only the opponent draws.
  ["Special Red Card", ["disrupt:hand"],
    "You can use this card only if your opponent has 3 or fewer Prize cards remaining. Your opponent shuffles their hand and puts it on the bottom of their deck. If they put any cards on the bottom of their deck in this way, they draw 3 cards."],
  ["Meddling Memo", ["disrupt:hand"],
    "Your opponent counts the cards in their hand, shuffles those cards, and puts them on the bottom of their deck. If they do, they draw that many cards."],
  ["Hand Trimmer", ["disrupt:hand"],
    "Each player discards cards from their hand until they have 5 cards in their hand. Your opponent discards first. (If a player has 5 or fewer cards in their hand, they do not discard.)"],
  ["Crushing Hammer", ["disrupt:energy"], "Flip a coin. If heads, discard an Energy from 1 of your opponent's Pokémon."],
  ["Tool Scrapper", ["disrupt:tool-stadium"],
    "Choose up to 2 Pokémon Tools attached to Pokémon (yours or your opponent's) and discard them."],
  ["Blowtorch", ["disrupt:energy", "disrupt:tool-stadium"],
    "You can use this card only if you discard a Basic {R} Energy card from your hand. Discard a Pokémon Tool or Special Energy card from 1 of your opponent's Pokémon, or discard a Stadium in play."],
  ["Canceling Cologne", ["lock"],
    "Until the end of your turn, your opponent's Active Pokémon has no Abilities. (This includes Pokémon that come into play during that turn.)"],
  ["Premium Power Pro", ["damage-boost"],
    "During this turn, attacks used by your {F} Pokémon do 30 more damage to your opponent's Active Pokémon (before applying Weakness and Resistance)."],
  ["Team Rocket's Venture Bomb", ["damage-place"],
    "Flip a coin. If heads, put 2 damage counters on 1 of your opponent's Pokémon. If tails, put 2 damage counters on your Active Pokémon."],
  ["Rare Candy", ["evolve"],
    "Choose 1 of your Basic Pokémon in play. If you have a Stage 2 card in your hand that evolves from that Pokémon, put that card onto the Basic Pokémon to evolve it, skipping the Stage 1. You can't use this card during your first turn or on a Basic Pokémon that was put into play this turn."],
  // A fossil is played as a Pokémon; "can't retreat" is about itself.
  ["Antique Dome Fossil", [],
    "Play this card as if it were a 60-HP Basic {C} Pokémon. This card can't be affected by any Special Conditions and can't retreat. At any time during your turn, you may discard this card from play."],
];

describe("tagEffectText — Supporters", () => {
  for (const [name, tags, effect] of SUPPORTERS) {
    test(`${name} → [${tags.join(", ")}]`, () => {
      expect(tagEffectText(effect)).toEqual(tags);
    });
  }
});

describe("tagEffectText — Items", () => {
  for (const [name, tags, effect] of ITEMS) {
    test(`${name} → [${tags.join(", ")}]`, () => {
      expect(tagEffectText(effect)).toEqual(tags);
    });
  }
});

describe("tagEffectText", () => {
  test("returns tags in registry order regardless of text order", () => {
    const tags = tagEffectText("Heal 30 damage from 1 of your Pokémon. Draw 2 cards.");
    expect(tags).toEqual(["draw", "heal"]);
  });

  test("empty text has no tags", () => {
    expect(tagEffectText("")).toEqual([]);
  });

  // Ability / attack wordings, ahead of those being tagged on cards.
  test("forced-switch covers the 'have your opponent switch' and 'opponent chooses' wordings", () => {
    expect(tagEffectText("Once during your turn, you may have your opponent switch their Active Pokémon with 1 of their Benched Pokémon."))
      .toEqual(["forced-switch"]);
    expect(tagEffectText("Your opponent chooses 1 of their Benched Pokémon and switches it with their Active Pokémon. The new Active Pokémon is now Asleep."))
      .toEqual(["forced-switch"]);
  });

  test("switching your own attacker out is a switch, not a forced-switch", () => {
    expect(tagEffectText("Your opponent's Active Pokémon is now Poisoned. Switch this Pokémon with 1 of your Benched Pokémon."))
      .not.toContain("forced-switch");
  });
});

describe("tagCard", () => {
  const draw3 = "Draw 3 cards.";

  test("tags Supporters and Items", () => {
    expect(tagCard({ name: "Cheren", category: "Trainer", trainerType: "Supporter", effect: draw3 })).toEqual(["draw"]);
    expect(tagCard({ name: "Nugget", category: "Trainer", trainerType: "Item", effect: draw3 })).toEqual(["draw"]);
  });

  test("leaves Tools, Stadiums, Pokémon and Energy untagged for now", () => {
    expect(tagCard({ name: "X", category: "Trainer", trainerType: "Tool", effect: draw3 })).toEqual([]);
    expect(tagCard({ name: "X", category: "Trainer", trainerType: "Stadium", effect: draw3 })).toEqual([]);
    expect(tagCard({ name: "X", category: "Pokemon", effect: draw3 })).toEqual([]);
    expect(tagCard({ name: "X", category: "Energy", effect: draw3 })).toEqual([]);
  });

  test("a Trainer with no effect text has no tags", () => {
    expect(tagCard({ name: "Ultra Ball", category: "Trainer", trainerType: "Item" })).toEqual([]);
  });

  test("applies an override by name, ignoring the name's parenthetical", () => {
    const effect = "Search your deck for up to 2 Rare Fossil cards and put them onto your Bench. Then, shuffle your deck.";
    expect(tagEffectText(effect)).toEqual(["search:any"]);
    expect(tagCard({ name: "Cara Liss", category: "Trainer", trainerType: "Supporter", effect })).toEqual(["search:item"]);
    expect(tagCard({ name: "Cara Liss (Alt)", category: "Trainer", trainerType: "Supporter", effect })).toEqual(["search:item"]);
  });
});

describe("registry", () => {
  test("tag ids are unique and every tag sits in a known facet", () => {
    const ids = EFFECT_TAGS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const facets = new Set<string>(EFFECT_FACETS.map((f) => f.id));
    for (const t of EFFECT_TAGS) expect(facets.has(t.facet)).toBe(true);
  });

  test("every facet has at least one tag", () => {
    for (const f of EFFECT_FACETS) {
      expect(EFFECT_TAGS.some((t) => t.facet === f.id)).toBe(true);
    }
  });

  test("overrides only name real tags", () => {
    for (const [name, o] of Object.entries(EFFECT_TAG_OVERRIDES)) {
      for (const t of [...(o.add ?? []), ...(o.remove ?? [])]) {
        expect(`${name}: ${t} ${isEffectTag(t)}`).toBe(`${name}: ${t} true`);
      }
    }
  });

  test("effectTagDef looks a tag up, and is undefined for a stale id", () => {
    expect(effectTagDef("gust")?.label).toBe("Gust");
    expect(effectTagDef("not-a-tag")).toBeUndefined();
  });
});

describe("hasEffectTag", () => {
  const tags = ["draw", "search:pokemon", "disrupt:hand"];

  test("matches an exact tag", () => {
    expect(hasEffectTag(tags, "draw")).toBe(true);
    expect(hasEffectTag(tags, "search:pokemon")).toBe(true);
    expect(hasEffectTag(tags, "gust")).toBe(false);
  });

  test("a bare prefix matches its family", () => {
    expect(hasEffectTag(tags, "search")).toBe(true);
    expect(hasEffectTag(tags, "disrupt")).toBe(true);
    expect(hasEffectTag(tags, "search:energy")).toBe(false);
  });

  test("a prefix is a whole segment, not a substring", () => {
    expect(hasEffectTag(["energy-accel"], "energy")).toBe(false);
    expect(hasEffectTag(["draw"], "dra")).toBe(false);
  });

  test("untagged cards match nothing", () => {
    expect(hasEffectTag(undefined, "draw")).toBe(false);
    expect(hasEffectTag([], "draw")).toBe(false);
  });
});

describe("facetLabelsOf", () => {
  test("one label per facet, in registry order", () => {
    expect(facetLabelsOf(["disrupt:hand", "hand-refresh", "draw"])).toEqual(["Draw", "Disruption"]);
  });

  test("untagged cards have no facet", () => {
    expect(facetLabelsOf(undefined)).toEqual([]);
    expect(facetLabelsOf([])).toEqual([]);
    expect(EFFECT_FACETS.map((f) => f.label)).not.toContain(UNTAGGED_FACET_LABEL);
  });
});
