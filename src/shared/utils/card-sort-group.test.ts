import { describe, it, expect } from "bun:test";
import { sortCards, groupCards, chunkCards } from "./card-sort-group.js";
import type { Card } from "../types/card.js";

function card(p: Partial<Card>): Card {
  return {
    id: p.id ?? `${p.setCode ?? "x"}-${p.localId ?? "0"}`,
    name: "Card",
    setCode: "svi",
    setName: "Scarlet & Violet",
    localId: "1",
    category: "Pokemon",
    rarity: "Common",
    energyTypes: [],
    ...p,
  } as Card;
}

describe("sortCards", () => {
  it("sorts alphabetically and reverses on desc", () => {
    const cards = [card({ name: "Zapdos" }), card({ name: "Abra" }), card({ name: "Mew" })];
    expect(sortCards(cards, "alpha", "asc").map((c) => c.name)).toEqual(["Abra", "Mew", "Zapdos"]);
    expect(sortCards(cards, "alpha", "desc").map((c) => c.name)).toEqual(["Zapdos", "Mew", "Abra"]);
  });

  it("sorts by category order then name for 'type'", () => {
    const cards = [
      card({ name: "Potion", category: "Trainer" }),
      card({ name: "Pikachu", category: "Pokemon" }),
      card({ name: "Fire Energy", category: "Energy" }),
    ];
    expect(sortCards(cards, "type", "asc").map((c) => c.category)).toEqual(["Pokemon", "Trainer", "Energy"]);
  });

  it("sorts by set code then numeric localId", () => {
    const cards = [
      card({ setCode: "svi", localId: "10" }),
      card({ setCode: "svi", localId: "2" }),
      card({ setCode: "obf", localId: "5" }),
    ];
    expect(sortCards(cards, "set", "asc").map((c) => `${c.setCode}-${c.localId}`)).toEqual([
      "obf-5", "svi-2", "svi-10",
    ]);
  });

  it("sorts by count descending (most copies first)", () => {
    const a = card({ id: "a", name: "A" });
    const b = card({ id: "b", name: "B" });
    const sorted = sortCards([a, b], "count", "asc", { a: 1, b: 4 });
    expect(sorted.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("does not mutate the input", () => {
    const cards = [card({ name: "B" }), card({ name: "A" })];
    const copy = cards.slice();
    sortCards(cards, "alpha", "asc");
    expect(cards).toEqual(copy);
  });
});

describe("groupCards", () => {
  it("groups by category and sorts group labels alphabetically", () => {
    const cards = [
      card({ name: "Pikachu", category: "Pokemon" }),
      card({ name: "Potion", category: "Trainer" }),
      card({ name: "Raichu", category: "Pokemon" }),
    ];
    const groups = groupCards(cards, "category");
    expect(groups.map(([label, cs]) => [label, cs.length])).toEqual([
      ["Pokemon", 2],
      ["Trainer", 1],
    ]);
  });

  it("groups by set keeping set-code order (no alpha re-sort)", () => {
    const cards = [
      card({ setCode: "svi", setName: "Scarlet & Violet" }),
      card({ setCode: "obf", setName: "Obsidian Flames" }),
    ];
    const groups = groupCards(cards, "set");
    expect(groups.map(([label]) => label)).toEqual([
      "Scarlet & Violet (svi)",
      "Obsidian Flames (obf)",
    ]);
  });

  it("uses trainerType for category grouping when present", () => {
    const cards = [card({ category: "Trainer", trainerType: "Supporter" })];
    expect(groupCards(cards, "category")[0][0]).toBe("Supporter");
  });
});

describe("chunkCards", () => {
  it("splits cards into rows of perRow", () => {
    const cards = [card({ id: "1" }), card({ id: "2" }), card({ id: "3" })];
    const rows = chunkCards(cards, 2);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ type: "cards" });
    expect((rows[0] as { cards: Card[] }).cards).toHaveLength(2);
    expect((rows[1] as { cards: Card[] }).cards).toHaveLength(1);
  });

  it("returns no rows for an empty list", () => {
    expect(chunkCards([], 3)).toEqual([]);
  });
});
