import { describe, test, expect, beforeEach } from "bun:test";
import { ImageElement } from "./image-element.js";
import { createElement, createNode } from "./index.js";
import { resetIconIds } from "../type-icons.js";

beforeEach(() => {
  resetIconIds();
});

describe("ImageElement energy mode", () => {
  test("measure returns diameter", () => {
    const item = new ImageElement({ src: "energy", radius: 20 });
    const { width, height } = item.measure();
    expect(width).toBe(40);
    expect(height).toBe(40);
  });

  test("render produces icon markup", () => {
    const item = new ImageElement({ src: "energy", energyType: "Water", radius: 15 });
    const svg = item.render(10, 10);
    expect(svg).toContain("circle");
  });

  test("toJSON includes bind", () => {
    const item = new ImageElement({ src: "energy", energyType: "Fire", radius: 28 }, { energyType: "types[0]" });
    const json = item.toJSON();
    expect(json.type).toBe("image");
    expect(json.props.energyType).toBe("Fire");
    expect(json.bind).toEqual({ energyType: "types[0]" });
  });
});

describe("ImageElement logo mode", () => {
  test("measure returns correct dimensions", () => {
    const item = new ImageElement({ src: "logo", suffix: "VSTAR", height: 55 });
    const { width, height } = item.measure();
    expect(height).toBe(55);
    expect(width).toBeGreaterThan(0);
  });

  test("render produces <image> element", () => {
    const item = new ImageElement({ src: "logo", suffix: "V", height: 40 });
    const svg = item.render(10, 20);
    expect(svg).toContain("<image");
    expect(svg).toContain("data:image/png;base64,");
  });

  test("render with filter includes filter attr", () => {
    const item = new ImageElement({ src: "logo", suffix: "ex", height: 40, filter: "title-shadow" });
    const svg = item.render(0, 0);
    expect(svg).toContain('filter="url(#title-shadow)"');
  });

  test("render with filter=none omits filter attr", () => {
    const item = new ImageElement({ src: "logo", suffix: "ex", height: 40, filter: "none" });
    const svg = item.render(0, 0);
    expect(svg).not.toContain("filter=");
  });

  test("unknown suffix renders empty string", () => {
    const item = new ImageElement({ src: "logo", suffix: "UNKNOWN", height: 40 });
    const svg = item.render(0, 0);
    expect(svg).toBe("");
  });

  test("toJSON round-trip", () => {
    const item = new ImageElement({ src: "logo", suffix: "ex", height: 40 }, { suffix: "_nameSuffix" });
    const json = item.toJSON();
    expect(json.type).toBe("image");
    expect(json.props.suffix).toBe("ex");
    expect(json.props.height).toBe(40);
    expect(json.bind).toEqual({ suffix: "_nameSuffix" });

    const restored = createNode(json);
    expect(restored).toBeInstanceOf(ImageElement);
    expect(restored.props.suffix).toBe("ex");
  });
});

describe("ImageElement clipToCard mode (big-logo replacement)", () => {
  test("render with clipToCard wraps in clip-path group", () => {
    const el = new ImageElement({ src: "logo", suffix: "VSTAR-big", height: 280, opacity: 0.7, clipToCard: 1 }, undefined, "big-logo-1");
    const svg = el.render(-50, -38);
    expect(svg).toContain('data-element-id="big-logo-1"');
    expect(svg).toContain('opacity="0.7"');
    expect(svg).toContain('clip-path="url(#card-clip)"');
    expect(svg).toContain("data:image/png;base64,");
  });

  test("render with unknown suffix + clipToCard returns empty group", () => {
    const el = new ImageElement({ src: "logo", suffix: "UNKNOWN", height: 280, clipToCard: 1 }, undefined, "big-logo-1");
    const svg = el.render(-50, -38);
    expect(svg).toContain('data-element-id="big-logo-1"');
    expect(svg).not.toContain("<image");
  });

  test("render without id omits data-element-id", () => {
    const el = new ImageElement({ src: "logo", suffix: "VSTAR-big", height: 280, opacity: 0.7, clipToCard: 1 });
    const svg = el.render(-50, -38);
    expect(svg).not.toContain("data-element-id");
  });

  test("measure returns logo dimensions", () => {
    const el = new ImageElement({ src: "logo", suffix: "VSTAR-big", height: 280, clipToCard: 1 });
    const { width, height } = el.measure();
    expect(width).toBeGreaterThan(0);
    expect(height).toBe(280);
  });

  test("propDefs includes expected fields for logo src", () => {
    const el = new ImageElement({ src: "logo", suffix: "VSTAR-big", height: 280 }, undefined, "big-logo-1");
    const defs = el.propDefs();
    const srcDef = defs.find(d => d.key === "src");
    expect(srcDef).toBeDefined();
    expect(srcDef!.type).toBe("select");

    const suffixDef = defs.find(d => d.key === "suffix");
    expect(suffixDef).toBeDefined();
    expect(suffixDef!.options).toContain("VSTAR-big");

    const opacityDef = defs.find(d => d.key === "opacity");
    expect(opacityDef).toBeDefined();
    expect(opacityDef!.type).toBe("range");
  });

  test("propDefs shows energy fields when src=energy", () => {
    const el = new ImageElement({ src: "energy", energyType: "Fire", radius: 28 });
    const defs = el.propDefs();
    const energyDef = defs.find(d => d.key === "energyType");
    expect(energyDef).toBeDefined();
    const radiusDef = defs.find(d => d.key === "radius");
    expect(radiusDef).toBeDefined();
    // Should not have logo-specific fields
    const suffixDef = defs.find(d => d.key === "suffix");
    expect(suffixDef).toBeUndefined();
  });
});
