import { describe, test, expect } from "bun:test";
import type { Card } from "../types/card.js";
import {
  makeRng,
  shuffle,
  draw,
  isBasicPokemon,
  isSupporter,
  isItem,
  isEnergy,
  isMulliganHand,
  hasNoSupporterOrItem,
  extraDrawsByTurn,
  dealOpeningHand,
  hypergeometricPmf,
  hypergeometricAtLeast,
  oddsToSeeByTurn,
  runMonteCarlo,
} from "./hand-sim.js";
import { isBasicEnergy } from "./energy.js";

// --- Card factories ---------------------------------------------------------

let _id = 0;
function card(partial: Partial<Card>): Card {
  return {
    id: partial.id ?? `c-${_id++}`,
    localId: "1",
    name: partial.name ?? "Card",
    imageBase: "",
    category: "Pokemon",
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
    mechanicsHash: "",
    illustrator: "",
    ...partial,
  };
}

const basic = (name = "Pikachu") => card({ name, category: "Pokemon", stage: "Basic" });
const noStage = (name = "Mystery") => card({ name, category: "Pokemon" });
const stage1 = (name = "Raichu") => card({ name, category: "Pokemon", stage: "Stage1" });
const supporter = (name = "Research") => card({ name, category: "Trainer", trainerType: "Supporter" });
const item = (name = "Ball") => card({ name, category: "Trainer", trainerType: "Item" });
const tool = (name = "Belt") => card({ name, category: "Trainer", trainerType: "Tool" });
const basicEnergy = (name = "Fire Energy") => card({ name, category: "Energy", mechanicsHash: "basic" });
const specialEnergy = (name = "Double Turbo") => card({ name, category: "Energy", mechanicsHash: "special" });

/** Build a flat deck of `n` copies. */
function copies(make: () => Card, n: number): Card[] {
  return Array.from({ length: n }, () => make());
}

// --- Predicates -------------------------------------------------------------

describe("classification predicates", () => {
  test("isBasicPokemon: Basic, missing stage, case-insensitive", () => {
    expect(isBasicPokemon(basic())).toBe(true);
    expect(isBasicPokemon(noStage())).toBe(true);
    expect(isBasicPokemon(card({ category: "Pokemon", stage: "BASIC" }))).toBe(true);
    expect(isBasicPokemon(stage1())).toBe(false);
    expect(isBasicPokemon(supporter())).toBe(false);
    expect(isBasicPokemon(basicEnergy())).toBe(false);
  });

  test("isSupporter / isItem distinguish trainer subtypes", () => {
    expect(isSupporter(supporter())).toBe(true);
    expect(isSupporter(item())).toBe(false);
    expect(isItem(item())).toBe(true);
    expect(isItem(tool())).toBe(false);
    expect(isItem(supporter())).toBe(false);
  });

  test("isEnergy / isBasicEnergy use category + mechanics hash", () => {
    expect(isEnergy(basicEnergy())).toBe(true);
    expect(isEnergy(specialEnergy())).toBe(true);
    expect(isBasicEnergy(basicEnergy())).toBe(true);
    expect(isBasicEnergy(specialEnergy())).toBe(false);
    expect(isBasicEnergy(basic())).toBe(false);
  });

  test("isMulliganHand: zero Basic Pokémon", () => {
    expect(isMulliganHand([supporter(), item(), basicEnergy()])).toBe(true);
    expect(isMulliganHand([stage1(), supporter()])).toBe(true);
    expect(isMulliganHand([supporter(), basic()])).toBe(false);
    expect(isMulliganHand([noStage()])).toBe(false);
  });

  test("hasNoSupporterOrItem ignores Stadium/Tool (honest narrow heuristic)", () => {
    expect(hasNoSupporterOrItem([basic(), tool(), basicEnergy()])).toBe(true);
    expect(hasNoSupporterOrItem([basic(), supporter()])).toBe(false);
    expect(hasNoSupporterOrItem([basic(), item()])).toBe(false);
  });
});

// --- Shuffle / draw ---------------------------------------------------------

describe("shuffle", () => {
  test("seeded RNG is deterministic", () => {
    const deck = copies(basic, 30);
    const a = shuffle(deck, makeRng(42)).map((c) => c.id);
    const b = shuffle(deck, makeRng(42)).map((c) => c.id);
    expect(a).toEqual(b);
  });

  test("different seeds generally differ", () => {
    const deck = copies(basic, 40).map((c, i) => ({ ...c, id: `c${i}` }));
    const a = shuffle(deck, makeRng(1)).map((c) => c.id);
    const b = shuffle(deck, makeRng(2)).map((c) => c.id);
    expect(a).not.toEqual(b);
  });

  test("is a permutation and does not mutate input", () => {
    const deck = copies(basic, 20).map((c, i) => ({ ...c, id: `c${i}` }));
    const before = deck.map((c) => c.id);
    const out = shuffle(deck, makeRng(7));
    expect(deck.map((c) => c.id)).toEqual(before); // unchanged
    expect(out.map((c) => c.id).sort()).toEqual([...before].sort()); // same multiset
    expect(out.length).toBe(deck.length);
  });
});

describe("draw", () => {
  test("splits hand and rest, clamps to deck size", () => {
    const deck = copies(basic, 10);
    const { hand, rest } = draw(deck, 7);
    expect(hand.length).toBe(7);
    expect(rest.length).toBe(3);
    expect(draw(deck, 99).hand.length).toBe(10);
    expect(draw(deck, 0).hand.length).toBe(0);
  });
});

// --- Play order -------------------------------------------------------------

describe("extraDrawsByTurn", () => {
  test("going first skips turn-1 draw; going second draws turn 1", () => {
    expect(extraDrawsByTurn(1, "first")).toBe(0);
    expect(extraDrawsByTurn(2, "first")).toBe(1);
    expect(extraDrawsByTurn(4, "first")).toBe(3);
    expect(extraDrawsByTurn(1, "second")).toBe(1);
    expect(extraDrawsByTurn(2, "second")).toBe(2);
    expect(extraDrawsByTurn(4, "second")).toBe(4);
  });
});

describe("dealOpeningHand", () => {
  test("going first deals exactly handSize", () => {
    const deck = copies(basic, 60);
    const r = dealOpeningHand(deck, { rng: makeRng(1), order: "first" });
    expect(r.hand.length).toBe(7);
    expect(r.rest.length).toBe(53);
    expect(r.wasMulligan).toBe(false);
  });

  test("going second deals handSize + 1, but mulligan is judged on the opening 7", () => {
    // Deck with exactly one Basic so the opening 7 mulligan outcome is meaningful.
    const deck = [basic("Lone"), ...copies(supporter, 59)];
    const r = dealOpeningHand(deck, { rng: makeRng(3), order: "second" });
    expect(r.hand.length).toBe(8);
    expect(r.rest.length).toBe(52);
    // wasMulligan reflects the first 7 only — the 8th card cannot rescue it.
    const firstSeven = r.hand.slice(0, 7);
    expect(r.wasMulligan).toBe(isMulliganHand(firstSeven));
  });

  test("empty deck yields empty hand", () => {
    const r = dealOpeningHand([], { rng: makeRng(1) });
    expect(r.hand).toEqual([]);
    expect(r.wasMulligan).toBe(false);
  });
});

// --- Hypergeometric ---------------------------------------------------------

describe("hypergeometric", () => {
  test("known value: >=1 of a 4-of in 60, opening 7 ≈ 0.3995", () => {
    expect(hypergeometricAtLeast(60, 4, 7, 1)).toBeCloseTo(0.3995, 3);
  });

  test("known value: a specific 1-of in opening 7 = 7/60", () => {
    expect(hypergeometricAtLeast(60, 1, 7, 1)).toBeCloseTo(7 / 60, 6);
  });

  test("pmf over all k sums to 1", () => {
    let sum = 0;
    for (let k = 0; k <= 7; k++) sum += hypergeometricPmf(60, 4, 7, k);
    expect(sum).toBeCloseTo(1, 9);
  });

  test("atLeast(1) == 1 - pmf(0)", () => {
    expect(hypergeometricAtLeast(60, 4, 7, 1)).toBeCloseTo(1 - hypergeometricPmf(60, 4, 7, 0), 9);
  });

  test("edge cases", () => {
    expect(hypergeometricAtLeast(60, 0, 7, 1)).toBe(0); // no copies → never
    expect(hypergeometricAtLeast(60, 4, 60, 1)).toBeCloseTo(1, 9); // draw whole deck → certain
    expect(hypergeometricAtLeast(60, 4, 7, 0)).toBe(1); // at-least-0 → certain
  });

  test("oddsToSeeByTurn grows with extra draws", () => {
    const t1 = oddsToSeeByTurn(60, 4, 7, 0);
    const t2 = oddsToSeeByTurn(60, 4, 7, 1);
    expect(t2).toBeGreaterThan(t1);
  });
});

// --- Monte Carlo ------------------------------------------------------------

describe("runMonteCarlo", () => {
  test("empty deck → zeroed result", () => {
    const r = runMonteCarlo({ deck: [], iterations: 100, rng: makeRng(1) });
    expect(r.deckSize).toBe(0);
    expect(r.mulliganRate).toBe(0);
    expect(r.byCard).toEqual([]);
  });

  test("all-Basic deck never mulligans", () => {
    const r = runMonteCarlo({ deck: copies(basic, 60), iterations: 2000, rng: makeRng(5) });
    expect(r.mulliganRate).toBe(0);
    expect(r.avgMulligansPerGame).toBe(0);
    expect(r.infiniteMulligan).toBe(false);
    expect(r.oddsBasic).toBeCloseTo(1, 9);
  });

  test("zero-Basic deck: infinite mulligan flagged, loop terminates (capped)", () => {
    const r = runMonteCarlo({
      deck: copies(supporter, 60),
      iterations: 50,
      rng: makeRng(9),
      maxMulligans: 20,
    });
    expect(r.infiniteMulligan).toBe(true);
    expect(r.mulliganRate).toBe(1);
    // capped: every game hits the ceiling without finding a keepable hand
    expect(r.avgMulligansPerGame).toBe(20);
    expect(r.noSupporterOrItemRate).toBe(0); // no kept hands → guarded to 0
  });

  test("MC mulliganRate matches closed-form 1 - oddsBasic (unconditioned)", () => {
    // 12 Basics, rest non-Pokémon — a normal-ish basic count.
    const deck = [...copies(basic, 12), ...copies(supporter, 20), ...copies(basicEnergy, 28)];
    const r = runMonteCarlo({ deck, iterations: 20000, rng: makeRng(123) });
    const closed = 1 - hypergeometricAtLeast(60, 12, 7, 1);
    expect(r.mulliganRate).toBeCloseTo(closed, 2);
    expect(r.oddsBasic).toBeCloseTo(hypergeometricAtLeast(60, 12, 7, 1), 9);
  });

  test("byCard groups copies by id and is sorted by copy count", () => {
    const fourOf = copies(() => card({ id: "four", name: "Four" }), 4);
    const oneOf = [card({ id: "one", name: "One" })];
    const deck = [...copies(basic, 55), ...fourOf, ...oneOf];
    const r = runMonteCarlo({ deck, iterations: 10, rng: makeRng(1), turns: 3 });
    const four = r.byCard.find((c) => c.cardId === "four")!;
    const one = r.byCard.find((c) => c.cardId === "one")!;
    expect(four.copies).toBe(4);
    expect(one.copies).toBe(1);
    expect(four.byTurn.length).toBe(3);
    // more copies → higher odds at the same turn
    expect(four.byTurn[0]).toBeGreaterThan(one.byTurn[0]);
  });

  test("going second yields higher by-turn odds than going first", () => {
    const deck = [...copies(basic, 50), ...copies(() => card({ id: "key", name: "Key" }), 4), ...copies(supporter, 6)];
    const first = runMonteCarlo({ deck, iterations: 10, rng: makeRng(1), order: "first" });
    const second = runMonteCarlo({ deck, iterations: 10, rng: makeRng(1), order: "second" });
    const keyFirst = first.byCard.find((c) => c.cardId === "key")!;
    const keySecond = second.byCard.find((c) => c.cardId === "key")!;
    // turn 1: going second has drawn one extra card
    expect(keySecond.byTurn[0]).toBeGreaterThan(keyFirst.byTurn[0]);
  });
});
