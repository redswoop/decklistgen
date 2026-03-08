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

  it("contains dark palette colors (standard section)", () => {
    const svg = renderEnergyPreviewSvg();
    const darkColors = [
      "#2d7a25", "#c0351a", "#1a6db8", "#b89200", "#b8306a",
      "#a86420", "#2a1f3d", "#4a7a8f", "#b840b8", "#3a4e9a", "#5a5a5a",
    ];
    for (const color of darkColors) {
      expect(svg).toContain(color);
    }
  });

  it("contains light palette colors (full-art section)", () => {
    const svg = renderEnergyPreviewSvg();
    const lightColors = [
      "#6bdb5a", "#ff8866", "#5cc0ff", "#ffe04a", "#ff88b0",
      "#ffb84a", "#9080b8", "#a0d8ee", "#ffaaff", "#8899ee", "#b8b8b8",
    ];
    for (const color of lightColors) {
      expect(svg).toContain(color);
    }
  });

  it("has Standard section with light background", () => {
    const svg = renderEnergyPreviewSvg();
    expect(svg).toContain('>Standard</text>');
    expect(svg).toContain('fill="#f5f5f5"');
  });

  it("has Full-art section with dark background", () => {
    const svg = renderEnergyPreviewSvg();
    expect(svg).toContain('>Full-art</text>');
    expect(svg).toContain('fill="#1a1a2e"');
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
    expect(svg).toContain("&#x25CF;");
  });

  it("is a valid SVG with viewBox", () => {
    const svg = renderEnergyPreviewSvg();
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="/);
    expect(svg).toMatch(/<\/svg>$/);
  });
});
