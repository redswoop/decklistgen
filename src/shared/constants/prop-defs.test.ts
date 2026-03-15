import { describe, test, expect } from "bun:test";
import { PROP_DEFS, SUB_PROP_DEFS, ENERGY_TYPES, BOX_MODEL_KEYS, FILL_KEYS, getImagePropDefs } from "./prop-defs.js";

describe("prop-defs", () => {
  test("ENERGY_TYPES has 11 entries", () => {
    expect(ENERGY_TYPES.length).toBe(11);
    expect(ENERGY_TYPES).toContain("Fire");
    expect(ENERGY_TYPES).toContain("Colorless");
  });

  test("PROP_DEFS has box and image types", () => {
    expect(Object.keys(PROP_DEFS)).toContain("box");
    expect(Object.keys(PROP_DEFS)).toContain("image");
  });

  test("box PROP_DEFS has anchorX and anchorY with isPosition", () => {
    const boxDefs = PROP_DEFS.box;
    const anchorX = boxDefs.find((d) => d.key === "anchorX");
    const anchorY = boxDefs.find((d) => d.key === "anchorY");
    expect(anchorX).toBeDefined();
    expect(anchorX!.isPosition).toBe(true);
    expect(anchorY).toBeDefined();
    expect(anchorY!.isPosition).toBe(true);
  });

  test("SUB_PROP_DEFS has text, image, and box", () => {
    expect(Object.keys(SUB_PROP_DEFS)).toContain("text");
    expect(Object.keys(SUB_PROP_DEFS)).toContain("image");
    expect(Object.keys(SUB_PROP_DEFS)).toContain("box");
  });

  test("text SUB_PROP_DEFS includes all expected keys", () => {
    const textDefs = SUB_PROP_DEFS.text;
    const keys = textDefs.map((d) => d.key);
    expect(keys).toContain("text");
    expect(keys).toContain("fontSize");
    expect(keys).toContain("fontFamily");
    expect(keys).toContain("fill");
    expect(keys).toContain("marginTop");
    expect(keys).toContain("vAlign");
  });

  test("all prop defs have required fields", () => {
    for (const [type, defs] of Object.entries({ ...PROP_DEFS, ...SUB_PROP_DEFS })) {
      for (const def of defs) {
        expect(def.key).toBeTruthy();
        expect(def.label).toBeTruthy();
        expect(["number", "range", "select", "text", "color"]).toContain(def.type);
        if (def.type === "select") {
          expect(def.options).toBeDefined();
          expect(def.options!.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test("getImagePropDefs returns energy-only props for energy src", () => {
    const defs = getImagePropDefs("energy");
    const keys = defs.map(d => d.key);
    expect(keys).toContain("src");
    expect(keys).toContain("energyType");
    expect(keys).toContain("radius");
    expect(keys).not.toContain("suffix");
    expect(keys).not.toContain("height");
    expect(keys).not.toContain("clipToCard");
    // Should include common layout defs
    expect(keys).toContain("grow");
    expect(keys).toContain("hAlign");
    expect(keys).toContain("marginTop");
    expect(keys).toContain("vAlign");
  });

  test("getImagePropDefs returns logo-only props for logo src", () => {
    const defs = getImagePropDefs("logo");
    const keys = defs.map(d => d.key);
    expect(keys).toContain("src");
    expect(keys).toContain("suffix");
    expect(keys).toContain("height");
    expect(keys).toContain("clipToCard");
    expect(keys).not.toContain("energyType");
    expect(keys).not.toContain("radius");
  });

  test("BOX_MODEL_KEYS has all 8 margin/padding keys", () => {
    expect(Object.keys(BOX_MODEL_KEYS).length).toBe(8);
    expect(BOX_MODEL_KEYS.marginTop).toBe(true);
    expect(BOX_MODEL_KEYS.paddingLeft).toBe(true);
  });

  test("FILL_KEYS has fill, fillOpacity, and opacity", () => {
    expect(Object.keys(FILL_KEYS).length).toBe(3);
    expect(FILL_KEYS.fill).toBe(true);
    expect(FILL_KEYS.fillOpacity).toBe(true);
    expect(FILL_KEYS.opacity).toBe(true);
  });
});
