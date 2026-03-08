import { describe, test, expect } from "bun:test";
import { compressText } from "./compress.js";

describe("compressText", () => {
  test("shortens Knocked Out", () => {
    expect(compressText("is Knocked Out")).toBe("is KO'd");
  });

  test("shortens evolution trigger", () => {
    const input = "When you play this Pokémon from your hand to evolve 1 of your Pokémon during your turn, you may draw 3 cards.";
    expect(compressText(input)).toBe("On evolve: draw 3 cards.");
  });

  test("shortens search + shuffle", () => {
    const input = "Search your deck for a Basic Pokémon and put it onto your Bench. Then, shuffle your deck.";
    expect(compressText(input)).toBe("Search deck for a Basic Pokémon and put it onto your Bench. Shuffle deck.");
  });

  test("shortens Prize cards", () => {
    expect(compressText("Take 2 Prize cards")).toBe("Take 2 Prizes");
  });

  test("shortens this Pokémon", () => {
    expect(compressText("Heal 30 damage from this Pokémon.")).toBe("Heal 30 damage from it.");
  });

  test("cleans up double spaces", () => {
    expect(compressText("(before applying Weakness and Resistance) Does 20 damage."))
      .toBe("Does 20 damage.");
  });

  test("passes through text with no matches", () => {
    expect(compressText("Draw 3 cards.")).toBe("Draw 3 cards.");
  });
});
