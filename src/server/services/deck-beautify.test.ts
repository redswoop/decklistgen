import { describe, test, expect } from "bun:test";
import type { Card } from "../../shared/types/card.js";
import type { DeckCard } from "../../shared/types/deck.js";
import { beautifyDeckCards, spreadRoundRobin } from "./deck-beautify.js";
import { makeRng } from "../../shared/utils/hand-sim.js";

function card(id: string, name: string, over: Partial<Card> = {}): Card {
  const [setCode, localId] = id.split("-");
  return {
    id, localId, name, setCode, setId: setCode, setName: setCode, era: "sv",
    imageBase: `https://img/${id}`, category: "Pokemon", rarity: "Common", energyTypes: [],
    isFullArt: false, isEx: false, isV: false, isVmax: false, isVstar: false, isAncient: false,
    isFuture: false, isTera: false, hasFoil: false, isPrintUnfriendly: false, mechanicsHash: "h1",
    illustrator: "A", ...over,
  };
}

const pikaCommon = card("A-1", "Pikachu");
const pikaIR = card("B-7", "Pikachu", { rarity: "Illustration Rare", illustrator: "B" });
const pikaSIR = card("C-9", "Pikachu", { rarity: "Special Illustration Rare", illustrator: "C" });
const pikaPromo = card("P-1", "Pikachu", { rarity: "Promo", illustrator: "D", isPrintUnfriendly: true });
const raikouOther = card("D-2", "Raikou", { mechanicsHash: "h2" });
const raikou = card("D-1", "Raikou", { mechanicsHash: "h1" });

const variants: Record<string, Card[]> = {
  "A-1": [pikaCommon, pikaIR, pikaSIR, pikaPromo],
  "B-7": [pikaCommon, pikaIR, pikaSIR, pikaPromo],
  "D-1": [raikou],
  "D-2": [raikouOther],
};
const lookup = (id: string) => variants[id] ?? [];

describe("beautifyDeckCards", () => {
  test("best: all copies land on the single highest-rarity art", () => {
    const deck: DeckCard[] = [{ count: 4, card: pikaCommon }];
    const { cards, changes } = beautifyDeckCards(deck, lookup, { mode: "best", excludeRarities: [] });
    expect(cards).toEqual([{ count: 4, card: pikaSIR }]);
    expect(changes[0].to).toEqual([{ cardId: "C-9", count: 4 }]);
  });

  test("diverse: copies spread across distinct arts, deterministic under a seeded rng", () => {
    const deck: DeckCard[] = [{ count: 4, card: pikaCommon }];
    const a = beautifyDeckCards(deck, lookup, { mode: "diverse", excludeRarities: [] }, makeRng(7));
    const b = beautifyDeckCards(deck, lookup, { mode: "diverse", excludeRarities: [] }, makeRng(7));
    expect(a.cards).toEqual(b.cards);
    expect(a.cards.reduce((n, c) => n + c.count, 0)).toBe(4);
    // 3 print-friendly arts for 4 copies → counts 2/1/1
    expect(a.cards.map((c) => c.count).sort()).toEqual([1, 1, 2]);
  });

  test("print-unfriendly and excluded rarities are filtered out", () => {
    const deck: DeckCard[] = [{ count: 2, card: pikaCommon }];
    const r = beautifyDeckCards(deck, lookup, { mode: "best", excludeRarities: ["Special Illustration Rare"] });
    expect(r.cards[0].card.id).toBe("B-7");
    const r2 = beautifyDeckCards(deck, lookup, { mode: "best", excludeRarities: [], excludePrintUnfriendly: false });
    // Promo isn't ranked above SIR, but it is now eligible for the diverse spread
    const r3 = beautifyDeckCards(deck, lookup, { mode: "diverse", excludeRarities: [], excludePrintUnfriendly: false }, makeRng(1));
    expect(r2.cards[0].card.id).toBe("C-9");
    expect(r3.cards.length).toBe(2);
  });

  test("merges two stacks of the same card before replacing", () => {
    const deck: DeckCard[] = [{ count: 2, card: pikaCommon }, { count: 2, card: pikaIR }];
    const { cards, changes } = beautifyDeckCards(deck, lookup, { mode: "best", excludeRarities: [] });
    expect(cards).toEqual([{ count: 4, card: pikaSIR }]);
    expect(changes).toHaveLength(1);
    expect(changes[0].from.sort()).toEqual(["A:1", "B:7"]);
  });

  test("same-name cards with different text stay separate and untouched when no variant exists", () => {
    const deck: DeckCard[] = [{ count: 1, card: raikou }, { count: 1, card: raikouOther }];
    const { cards, changes } = beautifyDeckCards(deck, lookup, { mode: "best", excludeRarities: [] });
    expect(cards.map((c) => c.card.id).sort()).toEqual(["D-1", "D-2"]);
    expect(changes).toHaveLength(2);
    expect(changes.every((c) => c.skipped === undefined)).toBe(true);
  });

  test("a group with no eligible variant is skipped and reported", () => {
    const lonely = card("Z-1", "Zapdos", { imageBase: "" });
    const { cards, changes } = beautifyDeckCards([{ count: 3, card: lonely }], () => [lonely], { mode: "best", excludeRarities: [] });
    expect(cards).toEqual([{ count: 3, card: lonely }]);
    expect(changes[0].skipped).toBe("no eligible variant");
  });

  test("does not mutate the input", () => {
    const deck: DeckCard[] = [{ count: 4, card: pikaCommon }];
    beautifyDeckCards(deck, lookup, { mode: "best", excludeRarities: [] });
    expect(deck).toEqual([{ count: 4, card: pikaCommon }]);
  });
});

describe("spreadRoundRobin", () => {
  test("distributes remainder to the first variants", () => {
    const out = spreadRoundRobin([pikaCommon, pikaIR, pikaSIR], 5);
    expect(out.map((o) => o.count)).toEqual([2, 2, 1]);
  });
  test("drops variants that would get zero copies", () => {
    expect(spreadRoundRobin([pikaCommon, pikaIR, pikaSIR], 2)).toHaveLength(2);
    expect(spreadRoundRobin([], 2)).toEqual([]);
  });
});
