import { describe, it, expect } from "bun:test";
import { pct, imgFor, zoomImgFor } from "./hand-display.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import type { Card } from "../../shared/types/card.js";

describe("pct", () => {
  it("formats a probability as a one-decimal percentage", () => {
    expect(pct(0)).toBe("0.0%");
    expect(pct(1)).toBe("100.0%");
    expect(pct(0.1234)).toBe("12.3%");
  });
});

describe("imgFor / zoomImgFor", () => {
  const card = { imageBase: "https://img/base" } as Card;

  it("imgFor uses the low resolution", () => {
    expect(imgFor(card)).toBe(cardImageUrl("https://img/base", "low"));
  });

  it("zoomImgFor uses the high resolution", () => {
    expect(zoomImgFor(card)).toBe(cardImageUrl("https://img/base", "high"));
  });
});
