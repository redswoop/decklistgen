import { describe, it, expect } from "bun:test";
import { groupDeckCardsForBeautify } from "./beautify-groups.js";
import type { Card } from "../types/card.js";
import type { DeckCard } from "../types/deck.js";

function card(setCode: string, localId: string, name: string, mechanicsHash: string): Card {
  return { id: `${setCode}-${localId}`, setCode, localId, name, mechanicsHash } as Card;
}

function dc(count: number, c: Card): DeckCard {
  return { count, card: c };
}

describe("groupDeckCardsForBeautify", () => {
  it("keeps same-name cards with different mechanics in separate groups", () => {
    const groups = groupDeckCardsForBeautify([
      dc(2, card("30th-c", "012", "Raikou", "hash-classic")),
      dc(2, card("me01", "048", "Raikou", "hash-mega")),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.mechanicsHash).sort()).toEqual(["hash-classic", "hash-mega"]);
    for (const g of groups) {
      expect(g.totalCount).toBe(2);
      expect(g.entries).toHaveLength(1);
    }
  });

  it("merges reprints of the same card and records every stack to remove", () => {
    const groups = groupDeckCardsForBeautify([
      dc(3, card("sv01", "181", "Nest Ball", "hash-nest")),
      dc(1, card("me01", "131", "Ultra Ball", "hash-ultra")),
      dc(1, card("sv04", "255", "Nest Ball", "hash-nest")),
    ]);
    expect(groups).toHaveLength(2);
    const nest = groups.find((g) => g.name === "Nest Ball")!;
    expect(nest.totalCount).toBe(4);
    expect(nest.cardId).toBe("sv01-181");
    expect(nest.entries).toEqual([
      { setCode: "sv01", localId: "181" },
      { setCode: "sv04", localId: "255" },
    ]);
  });

  it("ignores zero-count stacks", () => {
    const groups = groupDeckCardsForBeautify([
      dc(0, card("sv01", "181", "Nest Ball", "hash-nest")),
      dc(2, card("me01", "131", "Ultra Ball", "hash-ultra")),
    ]);
    expect(groups.map((g) => g.name)).toEqual(["Ultra Ball"]);
  });
});
