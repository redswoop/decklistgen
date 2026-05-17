import { describe, test, expect, beforeEach } from "bun:test";
import { getFontStyle, clearFontStyleCache } from "./type-icons.js";
import { measureWidth } from "./text.js";
import { TextElement } from "./elements/text-element.js";
import { fontStack, resetFontSelection, saveFontSelection } from "./font-family-store.js";

beforeEach(() => {
  resetFontSelection();
  clearFontStyleCache();
});

describe("default selection embeds Inter only", () => {
  test("embeds EssentiarumTCG as opentype", () => {
    const style = getFontStyle();
    expect(style).toContain('font-family: "EssentiarumTCG"');
    expect(style).toContain('format("opentype")');
  });

  test("embeds Inter Black (weight 900)", () => {
    const style = getFontStyle();
    expect(style).toContain('font-family: "Inter"');
    expect(style).toContain("font-weight: 900");
    expect(style).toMatch(/font-weight: 900;\s*src: url\("data:font\/ttf;base64,[A-Za-z0-9+/=]{1000,}/);
  });

  test("embeds Inter Bold (weight 700)", () => {
    const style = getFontStyle();
    expect(style).toContain("font-weight: 700");
    expect(style).toMatch(/font-weight: 700;\s*src: url\("data:font\/ttf;base64,[A-Za-z0-9+/=]{1000,}/);
  });

  test("does NOT embed Gill Sans when not selected", () => {
    const style = getFontStyle();
    expect(style).not.toContain('font-family: "Gill Sans"');
  });
});

describe("@font-face selection changes with font choice", () => {
  test("selecting Gill Sans for title embeds it alongside Inter for body", () => {
    saveFontSelection({ title: "gill-sans", body: "inter" });
    clearFontStyleCache();
    const style = getFontStyle();
    expect(style).toContain('font-family: "Gill Sans"');
    expect(style).toContain('font-family: "Inter"');
    expect(style).toContain('format("opentype")');
  });

  test("selecting Gill Sans for both roles embeds it once (not duplicated)", () => {
    saveFontSelection({ title: "gill-sans", body: "gill-sans" });
    clearFontStyleCache();
    const style = getFontStyle();
    expect(style).toContain('font-family: "Gill Sans"');
    expect(style).not.toContain('font-family: "Inter"');
    // 3 Gill Sans weights bundled: 400/700/900
    const matches = style.match(/font-family: "Gill Sans"/g) ?? [];
    expect(matches.length).toBe(3);
  });

  test("getFontStyle() is cached by selection", () => {
    const a1 = getFontStyle();
    const a2 = getFontStyle();
    expect(a1).toBe(a2);
    saveFontSelection({ title: "gill-sans", body: "gill-sans" });
    const b1 = getFontStyle();
    expect(b1).not.toBe(a1);
  });
});

describe("fontStack() reflects current selection", () => {
  test("default selection returns Inter stack", () => {
    expect(fontStack("title")).toContain("'Inter'");
    expect(fontStack("body")).toContain("'Inter'");
  });

  test("Gill Sans selection returns Gill Sans stack", () => {
    saveFontSelection({ title: "gill-sans", body: "gill-sans" });
    expect(fontStack("title")).toContain("'Gill Sans'");
    expect(fontStack("body")).toContain("'Gill Sans'");
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
