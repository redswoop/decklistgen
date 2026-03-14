import { describe, test, expect } from "bun:test";
import { BigLogoElement } from "./big-logo.js";
import { createElement, createDefaultElements, renderElements } from "./index.js";

describe("BigLogoElement", () => {
  test("render contains data-element-id", () => {
    const el = new BigLogoElement("big-logo-1");
    const svg = el.render();
    expect(svg).toContain('data-element-id="big-logo-1"');
  });

  test("render contains opacity attribute", () => {
    const el = new BigLogoElement("big-logo-1", { opacity: 0.5 });
    const svg = el.render();
    expect(svg).toContain('opacity="0.5"');
  });

  test("render contains clip-path", () => {
    const el = new BigLogoElement("big-logo-1");
    const svg = el.render();
    expect(svg).toContain('clip-path="url(#card-clip)"');
  });

  test("render contains embedded image", () => {
    const el = new BigLogoElement("big-logo-1");
    const svg = el.render();
    expect(svg).toContain("data:image/png;base64,");
  });

  test("render with unknown suffix returns empty group", () => {
    const el = new BigLogoElement("big-logo-1", { suffix: "UNKNOWN" });
    const svg = el.render();
    expect(svg).toContain('data-element-id="big-logo-1"');
    expect(svg).not.toContain("<image");
  });

  test("propDefs has expected structure", () => {
    const el = new BigLogoElement("big-logo-1");
    const defs = el.propDefs();
    expect(defs.length).toBe(5);

    const xDef = defs.find(d => d.key === "x");
    expect(xDef).toBeDefined();
    expect(xDef!.isPosition).toBe(true);
    expect(xDef!.type).toBe("number");

    const opacityDef = defs.find(d => d.key === "opacity");
    expect(opacityDef).toBeDefined();
    expect(opacityDef!.type).toBe("range");
    expect(opacityDef!.min).toBe(0);
    expect(opacityDef!.max).toBe(1);

    const suffixDef = defs.find(d => d.key === "suffix");
    expect(suffixDef).toBeDefined();
    expect(suffixDef!.type).toBe("select");
    expect(suffixDef!.options).toContain("VSTAR-big");
  });

  test("toJSON round-trip", () => {
    const el = new BigLogoElement("big-logo-1", { x: 10, y: 20, height: 300, opacity: 0.8, suffix: "V" });
    const json = el.toJSON();
    expect(json.type).toBe("big-logo");
    expect(json.id).toBe("big-logo-1");
    expect(json.props.x).toBe(10);
    expect(json.props.suffix).toBe("V");

    const restored = createElement(json);
    expect(restored.id).toBe("big-logo-1");
    expect(restored.props.x).toBe(10);
    expect(restored.render()).toBe(el.render());
  });

  test("default props match vstar.ts hardcoded values", () => {
    const el = new BigLogoElement("big-logo-1");
    expect(el.props.x).toBe(-50);
    expect(el.props.y).toBe(-38);
    expect(el.props.height).toBe(280);
    expect(el.props.opacity).toBe(0.7);
    expect(el.props.suffix).toBe("VSTAR-big");
  });
});

describe("element registry", () => {
  test("createDefaultElements returns big-logo, hp-cluster, name-cluster, and attack", () => {
    const elements = createDefaultElements();
    expect(elements.length).toBe(4);
    expect(elements[0].type).toBe("big-logo");
    expect(elements[0].id).toBe("big-logo-1");
    expect(elements[1].type).toBe("packed-row");
    expect(elements[1].id).toBe("hp-cluster-1");
    expect(elements[2].type).toBe("packed-row");
    expect(elements[2].id).toBe("name-cluster-1");
    expect(elements[3].type).toBe("packed-row");
    expect(elements[3].id).toBe("attack-1");
  });

  test("renderElements produces combined SVG", () => {
    const elements = createDefaultElements();
    const svg = renderElements(elements);
    expect(svg).toContain('data-element-id="big-logo-1"');
  });

  test("createElement throws on unknown type", () => {
    expect(() => createElement({ type: "nope", id: "x", props: {} })).toThrow("Unknown element type");
  });

  test("createElement handles packed-row with children", () => {
    const state = {
      type: "packed-row",
      id: "row-1",
      props: { anchorX: 100, anchorY: 50, direction: "ltr" },
      children: [
        { type: "text" as const, props: { text: "HP", fontSize: 18 } },
      ],
    };
    const el = createElement(state);
    expect(el.type).toBe("packed-row");
    expect(el.id).toBe("row-1");
    const svg = el.render();
    expect(svg).toContain('data-element-id="row-1"');
    expect(svg).toContain(">HP</text>");
  });
});
