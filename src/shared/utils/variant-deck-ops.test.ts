import { describe, it, expect } from "bun:test";
import { addVariant, removeVariant, swapVariant } from "./variant-deck-ops.js";
import type { Card } from "../types/card.js";
import type { DeckCard } from "../types/deck.js";

function card(setCode: string, localId: string, name = `${setCode}-${localId}`): Card {
  return { id: `${setCode}-${localId}`, name, setCode, localId } as Card;
}
function entry(setCode: string, localId: string, count: number): DeckCard {
  return { count, card: card(setCode, localId) };
}
const total = (cards: DeckCard[]) => cards.reduce((s, dc) => s + dc.count, 0);

describe("addVariant", () => {
  it("increments an existing printing", () => {
    const out = addVariant([entry("svi", "1", 2)], card("svi", "1"));
    expect(out).toHaveLength(1);
    expect(out[0].count).toBe(3);
  });

  it("appends a new printing", () => {
    const out = addVariant([entry("svi", "1", 2)], card("obf", "5"));
    expect(total(out)).toBe(3);
    expect(out.some((dc) => dc.card.setCode === "obf")).toBe(true);
  });
});

describe("removeVariant", () => {
  it("decrements an existing printing", () => {
    const out = removeVariant([entry("svi", "1", 2)], card("svi", "1"));
    expect(out[0].count).toBe(1);
  });

  it("drops the entry when the last copy is removed", () => {
    const out = removeVariant([entry("svi", "1", 1), entry("obf", "5", 2)], card("svi", "1"));
    expect(out.some((dc) => dc.card.setCode === "svi")).toBe(false);
    expect(total(out)).toBe(2);
  });
});

describe("swapVariant", () => {
  it("moves all copies of the from-printing onto the target", () => {
    const cards = [entry("svi", "1", 3), entry("obf", "5", 1)];
    const out = swapVariant(cards, { setCode: "svi", localId: "1" }, card("pal", "9"));
    expect(out.some((dc) => dc.card.setCode === "svi")).toBe(false);
    const target = out.find((dc) => dc.card.setCode === "pal");
    expect(target?.count).toBe(3);
    expect(total(out)).toBe(4); // count preserved
  });

  it("merges into an existing target printing", () => {
    const cards = [entry("svi", "1", 2), entry("pal", "9", 1)];
    const out = swapVariant(cards, { setCode: "svi", localId: "1" }, card("pal", "9"));
    expect(out).toHaveLength(1);
    expect(out[0].count).toBe(3);
  });

  it("sums multiple from-entries before moving", () => {
    const cards = [entry("svi", "1", 2), entry("svi", "1", 1)];
    const out = swapVariant(cards, { setCode: "svi", localId: "1" }, card("pal", "9"));
    expect(out).toHaveLength(1);
    expect(out[0].count).toBe(3);
  });
});
