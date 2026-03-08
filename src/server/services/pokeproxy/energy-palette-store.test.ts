import { describe, expect, it, beforeEach } from "bun:test";
import { getDarkPalette, getLightPalette, getRawPalettes, savePalettes, resetPalettes } from "./energy-palette-store.js";
import { ENERGY_COLORS_DARK, ENERGY_COLORS_LIGHT } from "./constants.js";

describe("energy-palette-store", () => {
  beforeEach(() => {
    resetPalettes();
  });

  it("returns compiled defaults when no JSON file exists", () => {
    const dark = getDarkPalette();
    const light = getLightPalette();
    expect(dark.G).toBe(ENERGY_COLORS_DARK.G);
    expect(dark.Grass).toBe(ENERGY_COLORS_DARK.Grass);
    expect(light.R).toBe(ENERGY_COLORS_LIGHT.R);
    expect(light.Fire).toBe(ENERGY_COLORS_LIGHT.Fire);
  });

  it("returned palettes have both name and letter keys (22 entries)", () => {
    const dark = getDarkPalette();
    const keys = Object.keys(dark);
    expect(keys.length).toBe(22);
    expect(dark.G).toBe(dark.Grass);
    expect(dark.R).toBe(dark.Fire);
    expect(dark.W).toBe(dark.Water);
  });

  it("savePalettes() persists and can be read back", () => {
    const customDark = { G: "#ff0000", R: "#00ff00" };
    const customLight = { W: "#0000ff" };
    savePalettes(customDark, customLight);

    const dark = getDarkPalette();
    expect(dark.G).toBe("#ff0000");
    expect(dark.Grass).toBe("#ff0000");
    expect(dark.R).toBe("#00ff00");
    expect(dark.Fire).toBe("#00ff00");

    const light = getLightPalette();
    expect(light.W).toBe("#0000ff");
    expect(light.Water).toBe("#0000ff");
  });

  it("resetPalettes() reverts to defaults", () => {
    savePalettes({ G: "#111111" }, { R: "#222222" });
    resetPalettes();

    const dark = getDarkPalette();
    const light = getLightPalette();
    expect(dark.G).toBe(ENERGY_COLORS_DARK.G);
    expect(light.R).toBe(ENERGY_COLORS_LIGHT.R);
  });

  it("partial overrides only change overridden colors", () => {
    savePalettes({ G: "#abcdef" }, {});

    const dark = getDarkPalette();
    expect(dark.G).toBe("#abcdef");
    expect(dark.R).toBe(ENERGY_COLORS_DARK.R);
    expect(dark.W).toBe(ENERGY_COLORS_DARK.W);

    const light = getLightPalette();
    expect(light.G).toBe(ENERGY_COLORS_LIGHT.G); // not overridden in light
  });

  it("getRawPalettes() returns letter-keyed only", () => {
    const raw = getRawPalettes();
    const darkKeys = Object.keys(raw.dark);
    const lightKeys = Object.keys(raw.light);
    expect(darkKeys.length).toBe(11);
    expect(lightKeys.length).toBe(11);
    for (const k of darkKeys) {
      expect(k.length).toBe(1);
    }
  });
});
