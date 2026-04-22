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

  it("merges same card with and without artCard override", () => {
    const card = makeCard("SCR", "173", "Terapagos ex");
    const artCard = makeCard("SV06", "50", "Terapagos ex");
    const cards: DeckCard[] = [
      { count: 2, card, artCard },
      { count: 1, card },
    ];
    const result = consolidateDeckCards(cards);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3);
    expect(result[0].artCard).toBeDefined(); // first entry's artCard preserved
  });

  it("merges same card with different artCard overrides", () => {
    const card = makeCard("SCR", "173", "Terapagos ex");
    const artA = makeCard("SV06", "50", "Terapagos ex");
    const artB = makeCard("SV07", "99", "Terapagos ex");
    const cards: DeckCard[] = [
      { count: 1, card, artCard: artA },
      { count: 2, card, artCard: artB },
    ];
    const result = consolidateDeckCards(cards);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3);
    // First occurrence wins
    expect(result[0].artCard?.id).toBe(artA.id);
  });

  it("does NOT merge different cards even if both have artCards", () => {
    const cardA = makeCard("SCR", "173", "Terapagos ex");
    const cardB = makeCard("SCR", "174", "Charizard ex");
    const art = makeCard("SV06", "50", "Art");
    const cards: DeckCard[] = [
      { count: 2, card: cardA, artCard: art },
      { count: 1, card: cardB, artCard: art },
    ];
    const result = consolidateDeckCards(cards);
    expect(result).toHaveLength(2);
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
