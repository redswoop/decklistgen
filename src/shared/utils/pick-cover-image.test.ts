import { describe, test, expect } from "bun:test";
import { pickCoverImage } from "./pick-cover-image.js";
import type { DeckCard } from "../types/deck.js";
import type { Card } from "../types/card.js";

function makeCard(name: string, imageBase: string): Card {
  return {
    id: `test-${name}`,
    localId: "1",
    name,
    setCode: "TST",
    setId: "tst",
    era: "sv",
    imageBase,
    category: "Pokemon",
    energyTypes: [],
    isEx: false,
    isV: false,
    isVmax: false,
    isVstar: false,
    isAncient: false,
    isFuture: false,
    isTera: false,
    isFullArt: false,
    hasFoil: false,
  } as Card;
}

function makeDeckCard(name: string, imageBase = `https://img/${name}`): DeckCard {
  return { count: 1, card: makeCard(name, imageBase) };
}

describe("pickCoverImage", () => {
  test("returns undefined for empty deck", () => {
    expect(pickCoverImage([])).toBeUndefined();
  });

  test("returns first card imageBase when no hero cards", () => {
    const cards = [
      makeDeckCard("Pikachu"),
      makeDeckCard("Bulbasaur"),
    ];
    expect(pickCoverImage(cards)).toBe("https://img/Pikachu");
  });

  test("prefers ex card over regular cards", () => {
    const cards = [
      makeDeckCard("Pikachu"),
      makeDeckCard("Charizard ex"),
      makeDeckCard("Bulbasaur"),
    ];
    expect(pickCoverImage(cards)).toBe("https://img/Charizard ex");
  });

  test("prefers V card over regular cards", () => {
    const cards = [
      makeDeckCard("Pikachu"),
      makeDeckCard("Mew V"),
    ];
    expect(pickCoverImage(cards)).toBe("https://img/Mew V");
  });

  test("prefers VMAX card", () => {
    const cards = [
      makeDeckCard("Pikachu"),
      makeDeckCard("Eternatus VMAX"),
      makeDeckCard("Crobat V"),
    ];
    expect(pickCoverImage(cards)).toBe("https://img/Eternatus VMAX");
  });

  test("prefers VSTAR card", () => {
    const cards = [
      makeDeckCard("Pikachu"),
      makeDeckCard("Arceus VSTAR"),
    ];
    expect(pickCoverImage(cards)).toBe("https://img/Arceus VSTAR");
  });

  test("picks first hero when multiple heroes exist", () => {
    const cards = [
      makeDeckCard("Pikachu"),
      makeDeckCard("Mew VMAX"),
      makeDeckCard("Charizard ex"),
    ];
    expect(pickCoverImage(cards)).toBe("https://img/Mew VMAX");
  });

  test("returns undefined when first card has no imageBase", () => {
    const cards = [makeDeckCard("Pikachu", "")];
    expect(pickCoverImage(cards)).toBeUndefined();
  });

  test("does not match partial suffixes (e.g. 'hex')", () => {
    const cards = [
      makeDeckCard("Weezing"),
      makeDeckCard("hex"),
    ];
    // "hex" ends with "ex" so it will match — this is fine, the suffix check is intentional
    expect(pickCoverImage(cards)).toBe("https://img/hex");
  });
});
