import { describe, it, expect } from "bun:test";
import { checkDeckLegality, LEGAL_DECK_SIZE } from "./deck-legality.js";
import type { DeckEntry } from "./deck-legality.js";
import type { Card } from "../types/card.js";

function makeCard(id: string, name: string, overrides: Partial<Card> = {}): Card {
  return {
    id,
    name,
    rarity: "Common",
    category: "Pokemon",
    mechanicsHash: "x",
    ...overrides,
  } as Card;
}

function entry(id: string, name: string, count: number, overrides: Partial<Card> = {}): DeckEntry {
  return { count, card: makeCard(id, name, overrides) };
}

function basicEnergy(id: string, name: string, count: number): DeckEntry {
  return entry(id, name, count, { category: "Energy", mechanicsHash: "basic" });
}

/** A legal 60-card deck: 4x10 distinct Pokemon + 20 basic energy. */
function legalDeck(): DeckEntry[] {
  const pokemon = Array.from({ length: 10 }, (_, i) =>
    entry(`sv01-${i + 1}`, `Pokemon ${i + 1}`, 4),
  );
  return [...pokemon, basicEnergy("sve-1", "Basic Fire Energy", 20)];
}

describe("checkDeckLegality", () => {
  it("passes a legal 60-card deck", () => {
    expect(checkDeckLegality(legalDeck())).toEqual([]);
  });

  it("warns when the deck is under 60 cards", () => {
    const issues = checkDeckLegality([entry("sv01-1", "Pikachu", 3)]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ rule: "deck-size", severity: "warning" });
    expect(issues[0].message).toBe(`3/${LEGAL_DECK_SIZE} cards — add 57 more`);
  });

  it("warns when the deck is over 60 cards", () => {
    const deck = [...legalDeck(), entry("sv01-99", "Extra", 2)];
    const issues = checkDeckLegality(deck);
    expect(issues).toHaveLength(1);
    expect(issues[0].rule).toBe("deck-size");
    expect(issues[0].message).toContain("remove 2");
  });

  it("ignores zero-count entries", () => {
    const deck = [...legalDeck(), entry("sv01-99", "Ghost", 0)];
    expect(checkDeckLegality(deck)).toEqual([]);
  });

  it("flags more than 4 copies of a name", () => {
    const issues = checkDeckLegality([entry("sv01-172", "Rare Candy", 5)]);
    const copy = issues.find((i) => i.rule === "copy-limit");
    expect(copy).toMatchObject({ severity: "error", cardIds: ["sv01-172"] });
    expect(copy!.message).toBe("5× Rare Candy — max 4 copies per name");
  });

  it("combines reprints of the same name across sets", () => {
    const issues = checkDeckLegality([
      entry("sv01-172", "Rare Candy", 3),
      entry("sv04-191", "Rare Candy", 2),
    ]);
    const copy = issues.find((i) => i.rule === "copy-limit");
    expect(copy).toBeDefined();
    expect(copy!.cardIds).toEqual(["sv01-172", "sv04-191"]);
  });

  it("allows exactly 4 copies", () => {
    const issues = checkDeckLegality([entry("sv01-172", "Rare Candy", 4)]);
    expect(issues.filter((i) => i.rule === "copy-limit")).toEqual([]);
  });

  it("exempts basic energy from the copy limit", () => {
    const issues = checkDeckLegality([basicEnergy("sve-1", "Basic Fire Energy", 20)]);
    expect(issues.filter((i) => i.rule === "copy-limit")).toEqual([]);
  });

  it("does not exempt special energy from the copy limit", () => {
    const issues = checkDeckLegality([
      entry("sv01-191", "Luminous Energy", 5, { category: "Energy", mechanicsHash: "lum" }),
    ]);
    expect(issues.some((i) => i.rule === "copy-limit")).toBe(true);
  });

  it("flags two different Radiant Pokemon", () => {
    const issues = checkDeckLegality([
      entry("swsh10-46", "Radiant Charizard", 1, { rarity: "Radiant Rare" }),
      entry("swsh9-11", "Radiant Heatran", 1, { rarity: "Radiant Rare" }),
    ]);
    const radiant = issues.find((i) => i.rule === "radiant");
    expect(radiant).toMatchObject({ severity: "error" });
    expect(radiant!.message).toContain("Radiant Charizard, Radiant Heatran");
    expect(radiant!.cardIds).toEqual(["swsh10-46", "swsh9-11"]);
  });

  it("flags two copies of the same Radiant", () => {
    const issues = checkDeckLegality([
      entry("swsh10-46", "Radiant Charizard", 2, { rarity: "Radiant Rare" }),
    ]);
    expect(issues.some((i) => i.rule === "radiant")).toBe(true);
    // the stricter radiant rule covers it; no duplicate copy-limit report
    expect(issues.some((i) => i.rule === "copy-limit")).toBe(false);
  });

  it("allows a single Radiant", () => {
    const issues = checkDeckLegality([
      entry("swsh10-46", "Radiant Charizard", 1, { rarity: "Radiant Rare" }),
    ]);
    expect(issues.some((i) => i.rule === "radiant")).toBe(false);
  });

  it("flags two ACE SPEC cards", () => {
    const issues = checkDeckLegality([
      entry("sv05-83", "Master Ball", 1, { rarity: "ACE SPEC Rare", category: "Trainer" }),
      entry("sv05-84", "Prime Catcher", 1, { rarity: "ACE SPEC Rare", category: "Trainer" }),
    ]);
    const ace = issues.find((i) => i.rule === "ace-spec");
    expect(ace).toMatchObject({ severity: "error" });
    expect(ace!.message).toContain("only 1 ACE SPEC card allowed per deck");
  });

  it("orders hard errors before the size warning", () => {
    const issues = checkDeckLegality([
      entry("sv01-172", "Rare Candy", 5),
    ]);
    expect(issues.map((i) => i.severity)).toEqual(["error", "warning"]);
  });

  it("tolerates cards missing the rarity field (old localStorage decks)", () => {
    const issues = checkDeckLegality([
      { count: 2, card: { id: "x-1", name: "Old Card", mechanicsHash: "x" } as Card },
    ]);
    expect(issues.some((i) => i.rule === "deck-size")).toBe(true);
  });
});
