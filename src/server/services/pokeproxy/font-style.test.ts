import { describe, test, expect } from "bun:test";
import { getFontStyle } from "./type-icons.js";
import { measureWidth } from "./text.js";
import { TextElement } from "./elements/text-element.js";
import { FONT_TITLE, FONT_BODY } from "./constants.js";

describe("bundled font @font-face block", () => {
  const style = getFontStyle();

  test("embeds EssentiarumTCG as opentype", () => {
    expect(style).toContain('font-family: "EssentiarumTCG"');
    expect(style).toContain('format("opentype")');
  });

  test("embeds Inter Black (weight 900)", () => {
    expect(style).toContain('font-family: "Inter"');
    expect(style).toContain("font-weight: 900");
    // base64 data URL marker for the Inter Black payload
    expect(style).toMatch(/font-weight: 900;\s*src: url\("data:font\/ttf;base64,[A-Za-z0-9+/=]{1000,}/);
  });

  test("embeds Inter Bold (weight 700)", () => {
    expect(style).toContain("font-weight: 700");
    expect(style).toMatch(/font-weight: 700;\s*src: url\("data:font\/ttf;base64,[A-Za-z0-9+/=]{1000,}/);
  });
});

describe("FONT_TITLE / FONT_BODY stacks", () => {
  test("title stack prefers Inter", () => {
    expect(FONT_TITLE.startsWith("'Inter'")).toBe(true);
  });

  test("body stack prefers Inter", () => {
    expect(FONT_BODY.startsWith("'Inter'")).toBe(true);
  });
});

describe("text measurement is platform-independent", () => {
  // Pinned widths from Inter Black/Bold at unitsPerEm=2048. If these shift,
  // it means the bundled font file changed (or the wrong font is loaded),
  // which would cause the deployed proxy cards to drift from local renders.
  test("title widths match Inter Black at 32px", () => {
    const w = measureWidth("title", "Charizard", 32);
    // Inter Black at 32px renders "Charizard" at ~166px. Tolerance is wide
    // enough to survive minor font-table revisions but tight enough to catch
    // a wrong-font regression (Liberation Sans Bold would give ~144).
    expect(w).toBeGreaterThan(155);
    expect(w).toBeLessThan(180);
  });

  test("body widths match Inter Bold at 18px", () => {
    const w = measureWidth("body", "Discard 2 Energy.", 18);
    // Inter Bold at 18px renders this string at ~150px.
    expect(w).toBeGreaterThan(140);
    expect(w).toBeLessThan(165);
  });

  test("title (Black 900) is meaningfully wider than body (Bold 700)", () => {
    const t = measureWidth("title", "ABCDEF", 32);
    const b = measureWidth("body", "ABCDEF", 32);
    expect(t).toBeGreaterThan(b);
  });
});

describe("TextElement font-weight selection", () => {
  test("title text renders with font-weight=900", () => {
    const item = new TextElement({
      text: "Charizard",
      fontSize: 32,
      fontFamily: "title",
      fontWeight: "bold",
      fill: "#000",
      opacity: 1,
    });
    const svg = item.render(0, 0);
    expect(svg).toContain('font-weight="900"');
  });

  test("body text preserves the spec'd font-weight", () => {
    const bold = new TextElement({
      text: "Rule text.",
      fontSize: 16,
      fontFamily: "body",
      fontWeight: "bold",
      fill: "#000",
      opacity: 1,
    });
    expect(bold.render(0, 0)).toContain('font-weight="bold"');

    const normal = new TextElement({
      text: "Rule text.",
      fontSize: 16,
      fontFamily: "body",
      fontWeight: "normal",
      fill: "#000",
      opacity: 1,
    });
    expect(normal.render(0, 0)).toContain('font-weight="normal"');
  });

  test("wrapped title text also renders with font-weight=900", () => {
    const item = new TextElement({
      text: "A very long card name that wraps",
      fontSize: 32,
      fontFamily: "title",
      fontWeight: "bold",
      fill: "#000",
      opacity: 1,
      wrap: 1,
    });
    const svg = item.render(0, 0);
    expect(svg).toContain('font-weight="900"');
  });
});
