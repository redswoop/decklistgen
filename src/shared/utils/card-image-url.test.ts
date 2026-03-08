import { describe, test, expect } from "bun:test";
import { cardImageUrl } from "./card-image-url.js";

describe("cardImageUrl", () => {
  const base = "https://assets.tcgdex.net/en/sv/sv06.5/036";

  test("appends /high.png for high resolution", () => {
    expect(cardImageUrl(base, "high")).toBe(`${base}/high.png`);
  });

  test("appends /low.png for low resolution", () => {
    expect(cardImageUrl(base, "low")).toBe(`${base}/low.png`);
  });

  test("defaults to high resolution", () => {
    expect(cardImageUrl(base)).toBe(`${base}/high.png`);
  });

  test("returns empty string for empty base", () => {
    expect(cardImageUrl("", "high")).toBe("");
    expect(cardImageUrl("", "low")).toBe("");
  });
});
