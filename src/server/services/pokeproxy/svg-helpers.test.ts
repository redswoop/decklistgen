import { describe, expect, it } from "bun:test";
import { renderTextLineWithEnergy } from "./svg-helpers.js";
import { ENERGY_COLORS } from "./constants.js";
import type { EnergyPalette } from "./constants.js";

describe("renderTextLineWithEnergy", () => {
  it("uses default ENERGY_COLORS when no palette provided", () => {
    const lines: string[] = [];
    renderTextLineWithEnergy(lines, "Cost {R} energy", 10, 20, 16, "Arial", "#222", "");
    const output = lines.join("");
    expect(output).toContain(ENERGY_COLORS["R"]);
  });

  it("uses provided palette when given", () => {
    const custom: EnergyPalette = { R: "#ff0000", G: "#00ff00" };
    const lines: string[] = [];
    renderTextLineWithEnergy(lines, "Needs {R} and {G}", 10, 20, 16, "Arial", "#222", "", undefined, custom);
    const output = lines.join("");
    expect(output).toContain("#ff0000");
    expect(output).toContain("#00ff00");
    expect(output).not.toContain(ENERGY_COLORS["R"]);
  });

  it("falls back to #888 for unknown energy letters", () => {
    const lines: string[] = [];
    renderTextLineWithEnergy(lines, "Unknown {Z}", 10, 20, 16, "Arial", "#222", "");
    const output = lines.join("");
    expect(output).toContain("#888");
  });

  it("renders Dragon N as filled circle instead of font glyph", () => {
    const lines: string[] = [];
    renderTextLineWithEnergy(lines, "{N}", 10, 20, 16, "Arial", "#222", "");
    const output = lines.join("");
    expect(output).toContain("&#x25CF;");
    expect(output).not.toContain('font-family="EssentiarumTCG"');
  });

  it("applies justifyWidth when provided", () => {
    const lines: string[] = [];
    renderTextLineWithEnergy(lines, "Hello world", 10, 20, 16, "Arial", "#222", "", 500);
    const output = lines.join("");
    expect(output).toContain('textLength="500"');
    expect(output).toContain('lengthAdjust="spacing"');
  });

  it("does not add textLength when justifyWidth is undefined", () => {
    const lines: string[] = [];
    renderTextLineWithEnergy(lines, "Hello world", 10, 20, 16, "Arial", "#222", "");
    const output = lines.join("");
    expect(output).not.toContain("textLength");
  });
});
