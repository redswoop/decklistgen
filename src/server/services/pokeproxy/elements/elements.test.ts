import { describe, test, expect, beforeEach } from "bun:test";
import { BigLogoElement } from "./big-logo.js";
import { StackElement } from "./stack.js";
import { TextItem } from "./sub-elements.js";
import { createElement, createNode, createDefaultElements, renderElements } from "./index.js";
import { resetIconIds } from "../type-icons.js";
import { CARD_H } from "../constants.js";

describe("BigLogoElement", () => {
  test("render contains data-element-id", () => {
    const el = new BigLogoElement(undefined, "big-logo-1");
    const svg = el.render(Number(el.props.x), Number(el.props.y));
    expect(svg).toContain('data-element-id="big-logo-1"');
  });

  test("render contains opacity attribute", () => {
    const el = new BigLogoElement({ opacity: 0.5 }, "big-logo-1");
    const svg = el.render(Number(el.props.x), Number(el.props.y));
    expect(svg).toContain('opacity="0.5"');
  });

  test("render contains clip-path", () => {
    const el = new BigLogoElement(undefined, "big-logo-1");
    const svg = el.render(Number(el.props.x), Number(el.props.y));
    expect(svg).toContain('clip-path="url(#card-clip)"');
  });

  test("render contains embedded image", () => {
    const el = new BigLogoElement(undefined, "big-logo-1");
    const svg = el.render(Number(el.props.x), Number(el.props.y));
    expect(svg).toContain("data:image/png;base64,");
  });

  test("render with unknown suffix returns empty group", () => {
    const el = new BigLogoElement({ suffix: "UNKNOWN" }, "big-logo-1");
    const svg = el.render(Number(el.props.x), Number(el.props.y));
    expect(svg).toContain('data-element-id="big-logo-1"');
    expect(svg).not.toContain("<image");
  });

  test("render without id omits data-element-id", () => {
    const el = new BigLogoElement();
    const svg = el.render(-50, -38);
    expect(svg).not.toContain("data-element-id");
  });

  test("propDefs has expected structure", () => {
    const el = new BigLogoElement(undefined, "big-logo-1");
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
    const el = new BigLogoElement({ x: 10, y: 20, height: 300, opacity: 0.8, suffix: "V" }, "big-logo-1");
    const json = el.toJSON();
    expect(json.type).toBe("big-logo");
    expect(json.id).toBe("big-logo-1");
    expect(json.props.x).toBe(10);
    expect(json.props.suffix).toBe("V");

    const restored = createElement(json);
    expect(restored.id).toBe("big-logo-1");
    expect(restored.props.x).toBe(10);
    expect(restored.render(10, 20)).toBe(el.render(10, 20));
  });

  test("default props match vstar.ts hardcoded values", () => {
    const el = new BigLogoElement(undefined, "big-logo-1");
    expect(el.props.x).toBe(-50);
    expect(el.props.y).toBe(-38);
    expect(el.props.height).toBe(280);
    expect(el.props.opacity).toBe(0.7);
    expect(el.props.suffix).toBe("VSTAR-big");
  });

  test("measure returns logo dimensions", () => {
    const el = new BigLogoElement();
    const { width, height } = el.measure();
    expect(width).toBeGreaterThan(0);
    expect(height).toBe(280);
  });
});

describe("renderElements vAnchor", () => {
  beforeEach(() => {
    resetIconIds();
  });

  test("vAnchor bottom: anchorY is distance from card bottom", () => {
    const stack = new StackElement(
      {
        anchorX: 20, anchorY: 440, width: 400, vAnchor: "bottom",
        paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10,
      },
      [new TextItem({ text: "Hello", fontSize: 24, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top", grow: 0, hAlign: "start" })],
      undefined,
      "stack-1",
    );
    const svg = renderElements([stack]);
    // height = padTop(10) + fontSize(24) + padBottom(10) = 44
    // y = CARD_H(1050) - anchorY(440) - height(44) = 566
    expect(svg).toContain('translate(20,566)');
  });

  test("vAnchor bottom: decreasing anchorY moves element toward card bottom", () => {
    const makeStack = (anchorY: number) => new StackElement(
      { anchorX: 0, anchorY, width: 400, vAnchor: "bottom", paddingTop: 10, paddingBottom: 10 },
      [new TextItem({ text: "Hi", fontSize: 20 })],
    );
    const svgHigh = renderElements([makeStack(200)]);
    const svgLow = renderElements([makeStack(100)]);
    // anchorY=200 → y = 1050-200-40 = 810
    // anchorY=100 → y = 1050-100-40 = 910 (closer to bottom)
    const yHigh = Number(svgHigh.match(/translate\(0,(\d+)\)/)![1]);
    const yLow = Number(svgLow.match(/translate\(0,(\d+)\)/)![1]);
    expect(yLow).toBeGreaterThan(yHigh);
  });

  test("vAnchor top (default) passes y unchanged", () => {
    const stack = new StackElement(
      {
        anchorX: 20, anchorY: 100, width: 400,
        paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10,
      },
      [new TextItem({ text: "Hello", fontSize: 24, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top", grow: 0, hAlign: "start" })],
      undefined,
      "stack-1",
    );
    const svg = renderElements([stack]);
    expect(svg).toContain('translate(20,100)');
  });

  test("default attack-block-1 renders correctly through renderElements", () => {
    const elements = createDefaultElements();
    const svg = renderElements(elements);
    expect(svg).toContain('data-element-id="attack-block-1"');
    expect(svg).toContain(">Raging Claws</text>");
  });
});

describe("element registry", () => {
  test("createDefaultElements returns big-logo, hp-cluster, name-cluster, and attack-block", () => {
    const elements = createDefaultElements();
    expect(elements.length).toBe(4);
    expect(elements[0].type).toBe("big-logo");
    expect(elements[0].id).toBe("big-logo-1");
    expect(elements[1].type).toBe("packed-row");
    expect(elements[1].id).toBe("hp-cluster-1");
    expect(elements[2].type).toBe("packed-row");
    expect(elements[2].id).toBe("name-cluster-1");
    expect(elements[3].type).toBe("stack");
    expect(elements[3].id).toBe("attack-block-1");
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
    const svg = el.render(100, 50);
    expect(svg).toContain('data-element-id="row-1"');
    expect(svg).toContain(">HP</text>");
  });

  test("createNode treats packed-row-item as alias for packed-row", () => {
    const el = createNode({ type: "packed-row-item", props: { direction: "ltr" }, children: [
      { type: "text", props: { text: "A", fontSize: 20 } },
    ]});
    expect(el.type).toBe("packed-row");
    const svg = el.render(0, 0);
    expect(svg).toContain(">A</text>");
  });
});
