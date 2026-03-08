import { describe, expect, it } from "bun:test";
import { renderEnergyPreviewSvg } from "./energy-preview.js";

describe("renderEnergyPreviewSvg", () => {
  it("contains all 11 energy type names as labels", () => {
    const svg = renderEnergyPreviewSvg();
    const types = [
      "Grass", "Fire", "Water", "Lightning", "Psychic",
      "Fighting", "Darkness", "Metal", "Fairy", "Dragon", "Colorless",
    ];
    for (const t of types) {
      expect(svg).toContain(`>${t}</text>`);
    }
  });

  it("contains EssentiarumTCG font-face", () => {
    const svg = renderEnergyPreviewSvg();
    expect(svg).toContain('font-family: "EssentiarumTCG"');
  });

  it("contains correct energy color values", () => {
    const svg = renderEnergyPreviewSvg();
    const expectedColors = [
      "#439837", "#e4613e", "#3099e1", "#dfbc28", "#e96c8c",
      "#e49021", "#4f4747", "#74b0cb", "#e18ce1", "#576fbc", "#828282",
    ];
    for (const color of expectedColors) {
      expect(svg).toContain(color);
    }
  });

  it("contains inline font glyphs for non-Dragon types", () => {
    const svg = renderEnergyPreviewSvg();
    for (const letter of ["G", "R", "W", "L", "P", "F", "D", "M", "Y", "C"]) {
      expect(svg).toContain(`font-family="EssentiarumTCG"`);
      expect(svg).toContain(`>${letter}</text>`);
    }
  });

  it("uses filled circle for Dragon inline glyph", () => {
    const svg = renderEnergyPreviewSvg();
    // Dragon uses ● (&#x25CF;) instead of font glyph
    expect(svg).toContain("&#x25CF;");
  });

  it("is a valid SVG with viewBox", () => {
    const svg = renderEnergyPreviewSvg();
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="/);
    expect(svg).toMatch(/<\/svg>$/);
  });
});
