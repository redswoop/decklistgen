import { describe, test, expect, beforeEach } from "bun:test";
import type { Card } from "../../shared/types/card.js";
import { makeRng } from "../../shared/utils/hand-sim.js";
import { useDecklist } from "./useDecklist.js";
import { useHandTester } from "./useHandTester.js";

// Minimal Card factory.
let _id = 0;
function card(partial: Partial<Card>): Card {
  return {
    id: partial.id ?? `c-${_id++}`,
    localId: partial.localId ?? "1",
    name: partial.name ?? "Card",
    imageBase: "",
    category: "Pokemon",
    rarity: "Common",
    energyTypes: [],
    setId: "x",
    setCode: partial.setCode ?? "X",
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

const basic = (id: string) => card({ id, name: id, category: "Pokemon", stage: "Basic" });

/** Set the working deck directly (bypasses persistence, which no-ops without localStorage). */
function setDeck(entries: Array<{ card: Card; count: number }>) {
  const { items } = useDecklist();
  items.value = entries.map((e, i) => ({
    setCode: e.card.setCode,
    localId: String(i),
    count: e.count,
    imageUrl: "",
    card: e.card,
  }));
}

beforeEach(() => {
  setDeck([]);
});

describe("useHandTester", () => {
  test("newHand draws 7 going first, sets turn 1", () => {
    setDeck([{ card: basic("Pika"), count: 60 }]);
    const t = useHandTester(makeRng(1));
    t.setOrder("first");
    t.newHand();
    expect(t.hand.value.length).toBe(7);
    expect(t.rest.value.length).toBe(53);
    expect(t.turn.value).toBe(1);
    expect(t.mulliganCount.value).toBe(0);
  });

  test("going second draws 8 on the opener", () => {
    setDeck([{ card: basic("Pika"), count: 60 }]);
    const t = useHandTester(makeRng(1));
    t.setOrder("second");
    t.newHand();
    expect(t.hand.value.length).toBe(8);
    expect(t.rest.value.length).toBe(52);
  });

  test("drawNext adds one card and bumps the turn", () => {
    setDeck([{ card: basic("Pika"), count: 60 }]);
    const t = useHandTester(makeRng(2));
    t.setOrder("first");
    t.newHand();
    t.drawNext();
    expect(t.hand.value.length).toBe(8);
    expect(t.turn.value).toBe(2);
  });

  test("mulligan increments count and redraws an opener", () => {
    setDeck([{ card: basic("Pika"), count: 60 }]);
    const t = useHandTester(makeRng(3));
    t.setOrder("first");
    t.newHand();
    t.mulligan();
    expect(t.mulliganCount.value).toBe(1);
    expect(t.turn.value).toBe(1);
    expect(t.hand.value.length).toBe(7);
  });

  test("wasMulligan flips for a deck with no Basics", () => {
    const supporter = card({ id: "Sup", category: "Trainer", trainerType: "Supporter" });
    setDeck([{ card: supporter, count: 60 }]);
    const t = useHandTester(makeRng(4));
    t.setOrder("first");
    t.newHand();
    expect(t.wasMulligan.value).toBe(true);
  });

  test("partial deck (<60) still deals — gated only on empty", () => {
    setDeck([{ card: basic("Pika"), count: 30 }]);
    const t = useHandTester(makeRng(5));
    t.newHand();
    expect(t.deckSize.value).toBe(30);
    expect(t.isComplete.value).toBe(false);
    expect(t.isEmpty.value).toBe(false);
    expect(t.hand.value.length).toBe(7);
  });

  test("empty deck: newHand no-ops, isEmpty true", () => {
    setDeck([]);
    const t = useHandTester(makeRng(6));
    t.newHand();
    expect(t.isEmpty.value).toBe(true);
    expect(t.hand.value.length).toBe(0);
    expect(t.turn.value).toBe(0);
  });

  test("deckCards reflects live edits to the working deck", () => {
    setDeck([{ card: basic("Pika"), count: 4 }]);
    const t = useHandTester(makeRng(7));
    expect(t.deckSize.value).toBe(4);
    setDeck([{ card: basic("Pika"), count: 4 }, { card: basic("Eevee"), count: 2 }]);
    expect(t.deckSize.value).toBe(6);
  });

  test("setOrder redraws when a hand is on the table", () => {
    setDeck([{ card: basic("Pika"), count: 60 }]);
    const t = useHandTester(makeRng(8));
    t.setOrder("first");
    t.newHand();
    expect(t.hand.value.length).toBe(7);
    t.setOrder("second");
    expect(t.playOrder.value).toBe("second");
    expect(t.hand.value.length).toBe(8); // redrawn as going-second
  });
});
