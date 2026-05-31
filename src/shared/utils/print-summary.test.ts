import { describe, expect, test } from "bun:test";
import type { Card, CardDetail } from "../types/card.js";
import {
  countPrintCards,
  summarizePrint,
  type PrintCountEntry,
} from "./print-summary.js";

function card(over: Partial<Card>): Card {
  return {
    id: "x",
    category: "Pokemon",
    name: "Card",
    ...over,
  } as Card;
}

const NO_FILTER = { exclude: new Set<string>(), noBasicEnergy: false };

describe("summarizePrint", () => {
  test("even fill is complete with no empty slots", () => {
    expect(summarizePrint(18, 9)).toEqual({
      cardCount: 18,
      sheets: 2,
      emptySlots: 0,
      incomplete: false,
    });
  });

  test("partial last sheet reports empty slots and is incomplete", () => {
    // 60 cards at 9/sheet → 7 sheets, last sheet uses 6, 3 empty.
    expect(summarizePrint(60, 9)).toEqual({
      cardCount: 60,
      sheets: 7,
      emptySlots: 3,
      incomplete: true,
    });
  });

  test("single card on a fresh sheet is incomplete", () => {
    expect(summarizePrint(1, 9)).toEqual({
      cardCount: 1,
      sheets: 1,
      emptySlots: 8,
      incomplete: true,
    });
  });

  test("zero cards yields an empty, complete summary", () => {
    expect(summarizePrint(0, 9)).toEqual({
      cardCount: 0,
      sheets: 0,
      emptySlots: 0,
      incomplete: false,
    });
  });
});

describe("countPrintCards", () => {
  const entries: PrintCountEntry[] = [
    { card: card({ category: "Pokemon" }), count: 3 },
    { card: card({ category: "Trainer", trainerType: "Item" }), count: 4 },
  ];

  test("all copies sums the counts", () => {
    expect(countPrintCards(entries, NO_FILTER, false)).toBe(7);
  });

  test("one-each counts one per distinct card", () => {
    expect(countPrintCards(entries, NO_FILTER, true)).toBe(2);
  });

  test("count is at least 1 per included card even if count is 0", () => {
    const zero: PrintCountEntry[] = [{ card: card({}), count: 0 }];
    expect(countPrintCards(zero, NO_FILTER, false)).toBe(1);
  });

  test("excluded categories are dropped from the count", () => {
    const opts = { exclude: new Set(["items"]), noBasicEnergy: false };
    expect(countPrintCards(entries, opts, false)).toBe(3); // pokemon only
  });

  test("noBasicEnergy drops basic energy but keeps special energy", () => {
    const basic = card({ id: "grass", category: "Energy" });
    const specialCard = card({ id: "jet", category: "Energy" });
    const specialDetail = { effect: "Attach to..." } as CardDetail;
    const mix: PrintCountEntry[] = [
      { card: basic, count: 5 },
      { card: specialCard, detail: specialDetail, count: 2 },
    ];
    const opts = { exclude: new Set<string>(), noBasicEnergy: true };
    expect(countPrintCards(mix, opts, false)).toBe(2); // special survives
  });

  test("specialenergy exclusion drops special energy but keeps basic", () => {
    const basic = card({ id: "grass", category: "Energy" });
    const specialCard = card({ id: "jet", category: "Energy" });
    const specialDetail = { effect: "Attach to..." } as CardDetail;
    const mix: PrintCountEntry[] = [
      { card: basic, count: 5 },
      { card: specialCard, detail: specialDetail, count: 2 },
    ];
    const opts = { exclude: new Set(["specialenergy"]), noBasicEnergy: false };
    expect(countPrintCards(mix, opts, false)).toBe(5); // basic survives
  });
});
