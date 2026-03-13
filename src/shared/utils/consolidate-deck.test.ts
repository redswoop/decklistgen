import { describe, it, expect } from "bun:test";
import { consolidateDeckCards } from "./consolidate-deck.js";
import type { DeckCard } from "../types/deck.js";
import type { Card } from "../types/card.js";

function makeCard(setCode: string, localId: string, name = "Test"): Card {
  return { id: `${setCode}-${localId}`, setCode, localId, name } as Card;
}

function makeDC(setCode: string, localId: string, count: number, name = "Test"): DeckCard {
  return { count, card: makeCard(setCode, localId, name) };
}

describe("consolidateDeckCards", () => {
  it("merges duplicate entries, sums counts", () => {
    const cards = [
      makeDC("SV06", "10", 2),
      makeDC("SV06", "10", 1),
    ];
    const result = consolidateDeckCards(cards);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3);
    expect(result[0].card.setCode).toBe("SV06");
  });

  it("preserves unique entries unchanged", () => {
    const cards = [
      makeDC("SV06", "10", 2),
      makeDC("SV06", "20", 1),
      makeDC("SV07", "10", 3),
    ];
    const result = consolidateDeckCards(cards);
    expect(result).toHaveLength(3);
    expect(result[0].count).toBe(2);
    expect(result[1].count).toBe(1);
    expect(result[2].count).toBe(3);
  });

  it("handles empty array", () => {
    expect(consolidateDeckCards([])).toEqual([]);
  });

  it("preserves order (first occurrence keeps its position)", () => {
    const cards = [
      makeDC("A", "1", 1, "Alpha"),
      makeDC("B", "2", 1, "Beta"),
      makeDC("A", "1", 2, "Alpha"),
      makeDC("C", "3", 1, "Charlie"),
    ];
    const result = consolidateDeckCards(cards);
    expect(result).toHaveLength(3);
    expect(result[0].card.setCode).toBe("A");
    expect(result[0].count).toBe(3);
    expect(result[1].card.setCode).toBe("B");
    expect(result[2].card.setCode).toBe("C");
  });
});
