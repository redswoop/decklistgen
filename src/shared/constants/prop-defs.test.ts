import { describe, test, expect } from "bun:test";
import {
  PROP_DEFS, SUB_PROP_DEFS, ENERGY_TYPES, BOX_MODEL_KEYS, FILL_KEYS, getImagePropDefs,
  H_ALIGN_OPTIONS, V_ALIGN_OPTIONS, TEXT_ANCHOR_OPTIONS, DIRECTION_OPTIONS,
  V_ANCHOR_OPTIONS, WRAP_OPTIONS, WEIGHT_OPTIONS, FONT_FAMILY_OPTIONS,
  IMAGE_COMMON_DEFS, IMAGE_SRC_DEF, IMAGE_ENERGY_DEFS, IMAGE_LOGO_DEFS,
} from "./prop-defs.js";

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

describe("groups", () => {
  test("root box anchorX/Y have group position", () => {
    const boxDefs = PROP_DEFS.box;
    expect(boxDefs.find(d => d.key === "anchorX")!.group).toBe("position");
    expect(boxDefs.find(d => d.key === "anchorY")!.group).toBe("position");
  });

  test("root box direction/vAnchor/hAnchor have group direction", () => {
    const boxDefs = PROP_DEFS.box;
    expect(boxDefs.find(d => d.key === "direction")!.group).toBe("direction");
    expect(boxDefs.find(d => d.key === "vAnchor")!.group).toBe("direction");
    expect(boxDefs.find(d => d.key === "hAnchor")!.group).toBe("direction");
  });

  test("root box width/gap have group layout", () => {
    const boxDefs = PROP_DEFS.box;
    expect(boxDefs.find(d => d.key === "width")!.group).toBe("layout");
    expect(boxDefs.find(d => d.key === "gap")!.group).toBe("layout");
  });

  test("root box rx has group appearance", () => {
    expect(PROP_DEFS.box.find(d => d.key === "rx")!.group).toBe("appearance");
  });

  test("root image content props have group content", () => {
    const imgDefs = PROP_DEFS.image;
    expect(imgDefs.find(d => d.key === "src")!.group).toBe("content");
    expect(imgDefs.find(d => d.key === "energyType")!.group).toBe("content");
    expect(imgDefs.find(d => d.key === "radius")!.group).toBe("content");
    expect(imgDefs.find(d => d.key === "suffix")!.group).toBe("content");
    expect(imgDefs.find(d => d.key === "height")!.group).toBe("content");
  });

  test("root image appearance props have group appearance", () => {
    const imgDefs = PROP_DEFS.image;
    expect(imgDefs.find(d => d.key === "opacity")!.group).toBe("appearance");
    expect(imgDefs.find(d => d.key === "clipToCard")!.group).toBe("appearance");
    expect(imgDefs.find(d => d.key === "filter")!.group).toBe("appearance");
  });

  test("sub text stroke/strokeWidth have group stroke", () => {
    const textDefs = SUB_PROP_DEFS.text;
    expect(textDefs.find(d => d.key === "stroke")!.group).toBe("stroke");
    expect(textDefs.find(d => d.key === "strokeWidth")!.group).toBe("stroke");
  });

  test("sub text alignment props have group align", () => {
    const textDefs = SUB_PROP_DEFS.text;
    expect(textDefs.find(d => d.key === "textAnchor")!.group).toBe("align");
    expect(textDefs.find(d => d.key === "wrap")!.group).toBe("align");
    expect(textDefs.find(d => d.key === "hAlign")!.group).toBe("align");
    expect(textDefs.find(d => d.key === "vAlign")!.group).toBe("align");
  });

  test("sub text has content/layout/appearance groups", () => {
    const textDefs = SUB_PROP_DEFS.text;
    expect(textDefs.find(d => d.key === "text")!.group).toBe("content");
    expect(textDefs.find(d => d.key === "grow")!.group).toBe("layout");
    expect(textDefs.find(d => d.key === "filter")!.group).toBe("appearance");
  });

  test("sub image has content/layout/appearance groups", () => {
    const imgDefs = SUB_PROP_DEFS.image;
    expect(imgDefs.find(d => d.key === "src")!.group).toBe("content");
    expect(imgDefs.find(d => d.key === "energyType")!.group).toBe("content");
    expect(imgDefs.find(d => d.key === "radius")!.group).toBe("content");
    expect(imgDefs.find(d => d.key === "suffix")!.group).toBe("content");
    expect(imgDefs.find(d => d.key === "height")!.group).toBe("content");
    expect(imgDefs.find(d => d.key === "grow")!.group).toBe("layout");
    expect(imgDefs.find(d => d.key === "opacity")!.group).toBe("appearance");
    expect(imgDefs.find(d => d.key === "clipToCard")!.group).toBe("appearance");
    expect(imgDefs.find(d => d.key === "filter")!.group).toBe("appearance");
  });

  test("sub box direction has group direction", () => {
    expect(SUB_PROP_DEFS.box.find(d => d.key === "direction")!.group).toBe("direction");
  });

  test("sub box hAlign/vAlign have group align", () => {
    expect(SUB_PROP_DEFS.box.find(d => d.key === "hAlign")!.group).toBe("align");
    expect(SUB_PROP_DEFS.box.find(d => d.key === "vAlign")!.group).toBe("align");
  });

  test("sub box has layout/appearance groups", () => {
    const boxDefs = SUB_PROP_DEFS.box;
    expect(boxDefs.find(d => d.key === "width")!.group).toBe("layout");
    expect(boxDefs.find(d => d.key === "gap")!.group).toBe("layout");
    expect(boxDefs.find(d => d.key === "grow")!.group).toBe("layout");
    expect(boxDefs.find(d => d.key === "rx")!.group).toBe("appearance");
  });

  test("repeater direction has group direction", () => {
    expect(SUB_PROP_DEFS.repeater.find(d => d.key === "direction")!.group).toBe("direction");
  });

  test("repeater gap has group layout", () => {
    expect(SUB_PROP_DEFS.repeater.find(d => d.key === "gap")!.group).toBe("layout");
  });

  test("IMAGE_COMMON_DEFS hAlign/vAlign have group align", () => {
    expect(IMAGE_COMMON_DEFS.find(d => d.key === "hAlign")!.group).toBe("align");
    expect(IMAGE_COMMON_DEFS.find(d => d.key === "vAlign")!.group).toBe("align");
  });

  test("IMAGE_COMMON_DEFS grow has group layout", () => {
    expect(IMAGE_COMMON_DEFS.find(d => d.key === "grow")!.group).toBe("layout");
  });

  test("IMAGE building blocks have correct groups", () => {
    expect(IMAGE_SRC_DEF.group).toBe("content");
    for (const def of IMAGE_ENERGY_DEFS) {
      expect(def.group).toBe("content");
    }
    expect(IMAGE_LOGO_DEFS.find(d => d.key === "suffix")!.group).toBe("content");
    expect(IMAGE_LOGO_DEFS.find(d => d.key === "height")!.group).toBe("content");
    expect(IMAGE_LOGO_DEFS.find(d => d.key === "opacity")!.group).toBe("appearance");
    expect(IMAGE_LOGO_DEFS.find(d => d.key === "clipToCard")!.group).toBe("appearance");
    expect(IMAGE_LOGO_DEFS.find(d => d.key === "filter")!.group).toBe("appearance");
  });
});

describe("align option sets", () => {
  test("H_ALIGN_OPTIONS has start/center/end with icons", () => {
    expect(H_ALIGN_OPTIONS).toHaveLength(3);
    expect(H_ALIGN_OPTIONS.map(o => o.value)).toEqual(["start", "center", "end"]);
    for (const opt of H_ALIGN_OPTIONS) {
      expect(opt.icon).toBeTruthy();
      expect(opt.title).toBeTruthy();
    }
  });

  test("V_ALIGN_OPTIONS has top/middle/bottom with icons", () => {
    expect(V_ALIGN_OPTIONS).toHaveLength(3);
    expect(V_ALIGN_OPTIONS.map(o => o.value)).toEqual(["top", "middle", "bottom"]);
  });

  test("TEXT_ANCHOR_OPTIONS has start/middle/end", () => {
    expect(TEXT_ANCHOR_OPTIONS).toHaveLength(3);
    expect(TEXT_ANCHOR_OPTIONS.map(o => o.value)).toEqual(["start", "middle", "end"]);
  });

  test("DIRECTION_OPTIONS has row/row-reverse/column with icons", () => {
    expect(DIRECTION_OPTIONS).toHaveLength(3);
    expect(DIRECTION_OPTIONS.map(o => o.value)).toEqual(["row", "row-reverse", "column"]);
    for (const opt of DIRECTION_OPTIONS) {
      expect(opt.icon).toBeTruthy();
    }
  });

  test("V_ANCHOR_OPTIONS has top/bottom", () => {
    expect(V_ANCHOR_OPTIONS).toHaveLength(2);
    expect(V_ANCHOR_OPTIONS.map(o => o.value)).toEqual(["top", "bottom"]);
  });

  test("WRAP_OPTIONS has 0/1 with text labels", () => {
    expect(WRAP_OPTIONS).toHaveLength(2);
    expect(WRAP_OPTIONS.map(o => o.value)).toEqual(["0", "1"]);
    for (const opt of WRAP_OPTIONS) {
      expect(opt.text).toBeTruthy();
    }
  });

  test("WEIGHT_OPTIONS has normal/bold with text labels", () => {
    expect(WEIGHT_OPTIONS).toHaveLength(2);
    expect(WEIGHT_OPTIONS.map(o => o.value)).toEqual(["normal", "bold"]);
  });

  test("FONT_FAMILY_OPTIONS has title/body with text labels", () => {
    expect(FONT_FAMILY_OPTIONS).toHaveLength(2);
    expect(FONT_FAMILY_OPTIONS.map(o => o.value)).toEqual(["title", "body"]);
  });

  test("all option sets have value and title on every option", () => {
    const allSets = [
      H_ALIGN_OPTIONS, V_ALIGN_OPTIONS, TEXT_ANCHOR_OPTIONS,
      DIRECTION_OPTIONS, V_ANCHOR_OPTIONS, WRAP_OPTIONS,
      WEIGHT_OPTIONS, FONT_FAMILY_OPTIONS,
    ];
    for (const set of allSets) {
      for (const opt of set) {
        expect(opt.value).toBeTruthy();
        expect(opt.title).toBeTruthy();
        expect(opt.icon || opt.text).toBeTruthy();
      }
    }
  });
});
