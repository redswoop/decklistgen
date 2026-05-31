import { describe, expect, test } from "bun:test";
import { formatCardCountLabel } from "./card-count-label.js";

describe("formatCardCountLabel", () => {
  test("shows 'X of Y' when refinement narrows the universe", () => {
    expect(formatCardCountLabel(16, 200)).toBe("showing 16 of 200");
  });

  test("shows plain count when nothing is filtered out", () => {
    expect(formatCardCountLabel(200, 200)).toBe("200 cards");
  });

  test("shows plain count when universe is unknown (null)", () => {
    expect(formatCardCountLabel(16, null)).toBe("16 cards");
  });

  test("never shows 'X of Y' when universe is smaller than refined", () => {
    // Defensive: stale universe count shouldn't produce a nonsense "16 of 5".
    expect(formatCardCountLabel(16, 5)).toBe("16 cards");
  });

  test("pluralizes correctly", () => {
    expect(formatCardCountLabel(1, null)).toBe("1 card");
    expect(formatCardCountLabel(0, null)).toBe("0 cards");
  });
});
