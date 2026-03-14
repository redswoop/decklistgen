import { describe, test, expect, beforeEach } from "bun:test";
import { BoxElement } from "./box.js";
import { TextElement } from "./text-element.js";
import { ImageElement } from "./image-element.js";
import { createElement, createNode, createDefaultElements, renderElements } from "./index.js";
import { resetIconIds } from "../type-icons.js";
import { measureWidth } from "../text.js";
import { CARD_H } from "../constants.js";

beforeEach(() => {
  resetIconIds();
});

describe("BoxElement row mode", () => {
  test("empty box renders empty <g>", () => {
    const box = new BoxElement(undefined, undefined, undefined, "box-1");
    const svg = box.render(0, 0);
    expect(svg).toBe('<g data-element-id="box-1"></g>');
  });

  test("box without id omits data-element-id", () => {
    const box = new BoxElement();
    const svg = box.render(0, 0);
    expect(svg).toBe('<g></g>');
  });

  test("row box with TextElement renders at correct position", () => {
    const box = new BoxElement(
      { anchorX: 100, anchorY: 50, direction: "row" },
      [new TextElement({ text: "HP", fontSize: 20, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top" })],
      undefined,
      "box-1",
    );
    const svg = box.render(100, 50);
    expect(svg).toContain('transform="translate(100,50)"');
    expect(svg).toContain("<text");
    expect(svg).toContain('dominant-baseline="hanging"');
    expect(svg).toContain(">HP</text>");
  });

  test("row-reverse box renders elements in reverse order", () => {
    const box = new BoxElement(
      { direction: "row-reverse" },
      [
        new TextElement({ text: "A", fontSize: 20 }),
        new TextElement({ text: "B", fontSize: 20 }),
      ],
    );
    const svg = box.render(0, 0);
    expect(svg).toContain(">A</text>");
    expect(svg).toContain(">B</text>");
  });

  test("fill renders background rect", () => {
    const box = new BoxElement(
      { anchorX: 0, anchorY: 0, direction: "row", fill: "#333", fillOpacity: 0.2, rx: 5 },
      [new TextElement({ text: "Hi", fontSize: 20, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top" })],
      undefined,
      "box-1",
    );
    const svg = box.render(0, 0);
    expect(svg).toContain('<rect');
    expect(svg).toContain('fill="#333"');
    expect(svg).toContain('opacity="0.2"');
    expect(svg).toContain('rx="5"');
    // Rect should come before children
    const rectIdx = svg.indexOf("<rect");
    const textIdx = svg.indexOf("<text");
    expect(rectIdx).toBeLessThan(textIdx);
  });

  test("no fill renders no background rect", () => {
    const box = new BoxElement(
      { direction: "row" },
      [new TextElement({ text: "Hi", fontSize: 20 })],
    );
    const svg = box.render(0, 0);
    expect(svg).not.toContain('<rect');
  });

  test("container padding insets children", () => {
    const box = new BoxElement(
      { direction: "row", paddingLeft: 10, paddingTop: 5, paddingRight: 10, paddingBottom: 5, fill: "#333", fillOpacity: 1, rx: 0 },
      [new TextElement({ text: "Hi", fontSize: 20, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top", grow: 0, hAlign: "start" })],
      undefined,
      "box-1",
    );
    const svg = box.render(0, 0);
    expect(svg).toContain('x="10"'); // padLeft
    expect(svg).toContain('y="5"');  // padTop
  });

  test("container margin offsets translate from anchor", () => {
    const box = new BoxElement(
      { anchorX: 100, anchorY: 50, direction: "row", marginLeft: 5, marginTop: 3 },
      [new TextElement({ text: "Hi", fontSize: 20 })],
      undefined,
      "box-1",
    );
    const svg = box.render(100, 50);
    expect(svg).toContain('translate(105,53)');
  });

  test("measure returns packed dimensions including padding", () => {
    const box = new BoxElement(
      { direction: "row", paddingTop: 5, paddingBottom: 5, paddingLeft: 10, paddingRight: 10 },
      [new TextElement({ text: "Hi", fontSize: 20, fontFamily: "title" })],
    );
    const { width, height } = box.measure();
    const textWidth = measureWidth("title", "Hi", 20);
    expect(width).toBe(10 + textWidth + 10);
    expect(height).toBe(5 + 20 + 5);
  });

  test("measure with empty children returns zero", () => {
    const box = new BoxElement({ direction: "row" });
    expect(box.measure()).toEqual({ width: 0, height: 0 });
  });

  test("width + grow stretches background rect", () => {
    const box = new BoxElement(
      { direction: "row", width: 500, fill: "#333", fillOpacity: 0.1, rx: 0 },
      [
        new TextElement({ text: "Name", fontSize: 20, grow: 1, hAlign: "start" }),
        new TextElement({ text: "60", fontSize: 20, grow: 0, hAlign: "end" }),
      ],
      undefined,
      "box-1",
    );
    const svg = box.render(0, 0);
    expect(svg).toContain('width="500"');
    expect(svg).toContain(">Name</text>");
    expect(svg).toContain(">60</text>");
  });
});

describe("BoxElement column mode", () => {
  test("empty column box renders empty <g>", () => {
    const box = new BoxElement({ direction: "column" }, undefined, undefined, "box-1");
    const svg = box.render(0, 0);
    expect(svg).toBe('<g data-element-id="box-1"></g>');
  });

  test("column with TextElement renders at correct position with padding", () => {
    const box = new BoxElement(
      {
        anchorX: 20, anchorY: 100, width: 400, direction: "column",
        paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10,
      },
      [new TextElement({ text: "Hello", fontSize: 24, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", wrap: 0, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top", grow: 0, hAlign: "start" })],
      undefined,
      "box-1",
    );
    const svg = box.render(20, 100);
    expect(svg).toContain('translate(20,100)');
    expect(svg).toContain("<text");
    expect(svg).toContain(">Hello</text>");
    expect(svg).toContain('x="10"');
    expect(svg).toContain('y="10"');
  });

  test("column with two children — second child below first + gap", () => {
    const box = new BoxElement(
      { width: 400, gap: 5, direction: "column" },
      [
        new TextElement({ text: "A", fontSize: 20, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }),
        new TextElement({ text: "B", fontSize: 20, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }),
      ],
      undefined,
      "box-1",
    );
    const svg = box.render(0, 0);
    expect(svg).toContain('data-child-index="0"');
    expect(svg).toContain('data-child-index="1"');
    expect(svg).toContain('y="25"'); // 20 + 5 gap
  });

  test("column passes allocatedWidth to wrapped TextElement", () => {
    const longText = "This is a long text that should wrap to multiple lines when given a narrow width constraint for the container";
    const box = new BoxElement(
      { width: 300, direction: "column" },
      [new TextElement({
        text: longText, fontSize: 20, fontFamily: "body", fontWeight: "bold",
        fill: "#000", opacity: 1, filter: "none", wrap: 1,
        marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
        paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
        vAlign: "top", grow: 0, hAlign: "start",
      })],
      undefined,
      "box-1",
    );
    const svg = box.render(0, 0);
    const tspanCount = (svg.match(/<tspan/g) || []).length;
    expect(tspanCount).toBeGreaterThan(1);
  });

  test("column with fill renders background rect", () => {
    const box = new BoxElement(
      {
        width: 500, direction: "column",
        paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10,
        fill: "#333", fillOpacity: 0.2, rx: 5,
      },
      [new TextElement({ text: "Hi", fontSize: 20 })],
      undefined,
      "box-1",
    );
    const svg = box.render(0, 0);
    expect(svg).toContain('<rect');
    expect(svg).toContain('width="500"');
    expect(svg).toContain('fill="#333"');
    expect(svg).toContain('height="40"'); // padT(10) + fontSize(20) + padB(10) = 40
  });

  test("column measure returns total dimensions including padding", () => {
    const box = new BoxElement(
      { width: 400, gap: 5, direction: "column", paddingTop: 10, paddingBottom: 10 },
      [
        new TextElement({ text: "A", fontSize: 20, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }),
        new TextElement({ text: "B", fontSize: 20, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }),
      ],
    );
    const { width, height } = box.measure();
    expect(width).toBe(400);
    expect(height).toBe(65); // padT(10) + child1(20) + gap(5) + child2(20) + padB(10)
  });

  test("column measure with empty children returns padding only", () => {
    const box = new BoxElement({ width: 200, direction: "column", paddingTop: 5, paddingBottom: 5 });
    const { width, height } = box.measure();
    expect(width).toBe(200);
    expect(height).toBe(10);
  });
});

describe("BoxElement toJSON round-trip", () => {
  test("row box round-trip", () => {
    const box = new BoxElement(
      { anchorX: 100, anchorY: 50, direction: "row-reverse" },
      [
        new TextElement({ text: "HP", fontSize: 18 }),
        new ImageElement({ src: "energy", energyType: "Water", radius: 15, vAlign: "middle" }),
      ],
      undefined,
      "box-1",
    );
    const json = box.toJSON();
    expect(json.type).toBe("box");
    expect(json.id).toBe("box-1");
    expect(json.children).toHaveLength(2);

    resetIconIds();
    const svg1 = box.render(100, 50);
    resetIconIds();
    const restored = createElement(json) as BoxElement;
    const svg2 = restored.render(100, 50);
    expect(svg2).toBe(svg1);
  });

  test("column box round-trip", () => {
    const box = new BoxElement(
      { anchorX: 20, anchorY: 100, width: 600, gap: 4, direction: "column",
        paddingTop: 4, paddingRight: 8, paddingBottom: 8, paddingLeft: 8,
        fill: "#333", fillOpacity: 0.1, rx: 5 },
      [
        new BoxElement(
          { direction: "row" },
          [new TextElement({ text: "Attack", fontSize: 28, grow: 1, hAlign: "start" })],
        ),
        new TextElement({
          text: "Does 20 damage.", fontSize: 20, fontFamily: "body", fontWeight: "bold",
          fill: "#222", opacity: 1, filter: "none", wrap: 1,
          marginTop: 4,
        }),
      ],
      undefined,
      "box-1",
    );
    const json = box.toJSON();
    expect(json.type).toBe("box");
    expect(json.children).toHaveLength(2);
    expect(json.children![0].type).toBe("box");
    expect(json.children![1].type).toBe("text");

    resetIconIds();
    const svg1 = box.render(20, 100);
    resetIconIds();
    const restored = createElement(json) as BoxElement;
    const svg2 = restored.render(20, 100);
    expect(svg2).toBe(svg1);
  });

  test("toJSON preserves bind maps", () => {
    const box = new BoxElement(
      {},
      [new TextElement({ text: "280", fontSize: 50 }, { text: "hp" })],
      undefined,
      "box-1",
    );
    const json = box.toJSON();
    expect(json.children![0].bind).toEqual({ text: "hp" });
  });
});

describe("BoxElement propDefs", () => {
  test("propDefs has isPosition on anchorX/anchorY", () => {
    const box = new BoxElement(undefined, undefined, undefined, "box-1");
    const defs = box.propDefs();
    const anchorX = defs.find(d => d.key === "anchorX");
    const anchorY = defs.find(d => d.key === "anchorY");
    expect(anchorX).toBeDefined();
    expect(anchorX!.isPosition).toBe(true);
    expect(anchorY).toBeDefined();
    expect(anchorY!.isPosition).toBe(true);
  });
});

describe("renderElements vAnchor", () => {
  test("vAnchor bottom: anchorY is distance from card bottom", () => {
    const box = new BoxElement(
      {
        anchorX: 20, anchorY: 440, width: 400, direction: "column", vAnchor: "bottom",
        paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10,
      },
      [new TextElement({ text: "Hello", fontSize: 24, wrap: 0 })],
      undefined,
      "box-1",
    );
    const svg = renderElements([box]);
    // height = padTop(10) + fontSize(24) + padBottom(10) = 44
    // y = CARD_H(1050) - anchorY(440) - height(44) = 566
    expect(svg).toContain('translate(20,566)');
  });

  test("vAnchor top (default) passes y unchanged", () => {
    const box = new BoxElement(
      {
        anchorX: 20, anchorY: 100, width: 400, direction: "column",
        paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10,
      },
      [new TextElement({ text: "Hello", fontSize: 24 })],
      undefined,
      "box-1",
    );
    const svg = renderElements([box]);
    expect(svg).toContain('translate(20,100)');
  });
});

describe("grow inside column box", () => {
  test("grow distributes extra width when column passes allocatedWidth to render", () => {
    const row = new BoxElement(
      { direction: "row" },
      [
        new TextElement({ text: "A", fontSize: 20, grow: 1, hAlign: "start", marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }),
        new TextElement({ text: "B", fontSize: 20, grow: 0, hAlign: "end", marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }),
      ],
    );
    const column = new BoxElement(
      { width: 400, direction: "column" },
      [row],
    );

    const svg = column.render(0, 0);
    const textMatches = [...svg.matchAll(/x="([0-9.]+)"[^>]*>[AB]<\/text>/g)];
    expect(textMatches).toHaveLength(2);
    const xA = Number(textMatches[0][1]);
    const xB = Number(textMatches[1][1]);
    expect(xB).toBeGreaterThan(300);
    expect(xA).toBeLessThan(100);
  });
});

describe("deep nesting", () => {
  test("box inside box inside box (3+ levels)", () => {
    const innerRow = new BoxElement(
      { direction: "row" },
      [
        new TextElement({ text: "Deep", fontSize: 16 }),
        new TextElement({ text: "Nesting", fontSize: 16 }),
      ],
    );

    const middleColumn = new BoxElement(
      { width: 300, direction: "column" },
      [
        innerRow,
        new TextElement({ text: "Below", fontSize: 14, hAlign: "start" }),
      ],
    );

    const outerRow = new BoxElement(
      { direction: "row" },
      [
        new TextElement({ text: "Outer", fontSize: 20 }),
        middleColumn,
      ],
      undefined,
      "deep-test",
    );

    const svg = outerRow.render(0, 0);
    expect(svg).toContain('data-element-id="deep-test"');
    expect(svg).toContain(">Outer</text>");
    expect(svg).toContain(">Deep</text>");
    expect(svg).toContain(">Nesting</text>");
    expect(svg).toContain(">Below</text>");

    const { width, height } = outerRow.measure();
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);

    const json = outerRow.toJSON();
    expect(json.children).toHaveLength(2);
    expect(json.children![1].type).toBe("box");
    expect(json.children![1].children).toHaveLength(2);
    expect(json.children![1].children![0].type).toBe("box");

    const restored = createNode(json) as BoxElement;
    const svg2 = restored.render(0, 0);
    expect(svg2).toBe(svg);
  });
});

describe("default elements", () => {
  test("createDefaultElements returns image, box, box, box, box", () => {
    const elements = createDefaultElements();
    expect(elements.length).toBe(5);
    expect(elements[0].type).toBe("image");
    expect(elements[0].id).toBe("big-logo-1");
    expect(elements[1].type).toBe("box");
    expect(elements[1].id).toBe("hp-cluster-1");
    expect(elements[2].type).toBe("box");
    expect(elements[2].id).toBe("name-cluster-1");
    expect(elements[3].type).toBe("box");
    expect(elements[3].id).toBe("evolves-from-1");
    expect(elements[4].type).toBe("box");
    expect(elements[4].id).toBe("attack-block-1");
  });

  test("HP cluster renders all 3 children", () => {
    const elements = createDefaultElements();
    const hpCluster = elements.find(e => e.id === "hp-cluster-1") as BoxElement;
    expect(hpCluster).toBeDefined();
    expect(hpCluster.children).toHaveLength(3);
    expect(hpCluster.children[0].type).toBe("text");
    expect(hpCluster.children[1].type).toBe("text");
    expect(hpCluster.children[2].type).toBe("image");

    const svg = hpCluster.render(514, 42);
    expect(svg).toContain(">HP</text>");
    expect(svg).toContain(">280</text>");
    expect(svg).toContain("circle");
  });

  test("name cluster renders text + logo", () => {
    const elements = createDefaultElements();
    const nameCluster = elements.find(e => e.id === "name-cluster-1") as BoxElement;
    expect(nameCluster).toBeDefined();
    expect(nameCluster.children).toHaveLength(2);
    expect(nameCluster.children[0].type).toBe("text");
    expect(nameCluster.children[1].type).toBe("image");

    const svg = nameCluster.render(30, 62);
    expect(svg).toContain(">Arcanine</text>");
    expect(svg).toContain("<image");
  });

  test("attack block renders both attacks", () => {
    const elements = createDefaultElements();
    const attackBlock = elements.find(e => e.id === "attack-block-1") as BoxElement;
    expect(attackBlock).toBeDefined();
    expect(attackBlock.type).toBe("box");
    expect(attackBlock.children).toHaveLength(5);

    const svg = attackBlock.render(20, 610);
    expect(svg).toContain(">Raging Claws</text>");
    expect(svg).toContain(">30+</text>");
    expect(svg).toContain(">Bright Flame</text>");
    expect(svg).toContain(">250</text>");
    expect(svg).toContain("circle");
    expect(svg).toContain("<tspan");
    expect(svg).toContain("10 more damage");
    expect(svg).toContain("Discard 2");
  });

  test("renderElements produces combined SVG", () => {
    const elements = createDefaultElements();
    const svg = renderElements(elements);
    expect(svg).toContain('data-element-id="big-logo-1"');
    expect(svg).toContain('data-element-id="attack-block-1"');
    expect(svg).toContain(">Raging Claws</text>");
  });
});

describe("backward compat aliases", () => {
  test("packed-row creates BoxElement with direction: row", () => {
    const el = createNode({
      type: "packed-row", props: { direction: "ltr" },
      children: [{ type: "text", props: { text: "A", fontSize: 20 } }],
    });
    expect(el).toBeInstanceOf(BoxElement);
    expect(el.type).toBe("box");
    expect(el.props.direction).toBe("row");
    const svg = el.render(0, 0);
    expect(svg).toContain(">A</text>");
  });

  test("packed-row with rtl creates BoxElement with direction: row-reverse", () => {
    const el = createNode({
      type: "packed-row", props: { direction: "rtl" },
      children: [{ type: "text", props: { text: "B", fontSize: 20 } }],
    });
    expect(el).toBeInstanceOf(BoxElement);
    expect(el.props.direction).toBe("row-reverse");
  });

  test("packed-row-item creates BoxElement (alias)", () => {
    const el = createNode({
      type: "packed-row-item", props: { direction: "ltr" },
      children: [{ type: "text", props: { text: "A", fontSize: 20 } }],
    });
    expect(el).toBeInstanceOf(BoxElement);
    expect(el.type).toBe("box");
  });

  test("stack creates BoxElement with direction: column", () => {
    const el = createNode({
      type: "stack", props: { width: 400 },
      children: [{ type: "text", props: { text: "A", fontSize: 20 } }],
    });
    expect(el).toBeInstanceOf(BoxElement);
    expect(el.type).toBe("box");
    expect(el.props.direction).toBe("column");
  });

  test("wrapped-text creates TextElement with wrap: 1", () => {
    const el = createNode({ type: "wrapped-text", props: { text: "Hello", fontSize: 20 } });
    expect(el).toBeInstanceOf(TextElement);
    expect(el.type).toBe("text");
    expect(Number(el.props.wrap)).toBe(1);
  });

  test("type-dot creates ImageElement with src: energy", () => {
    const el = createNode({ type: "type-dot", props: { energyType: "Grass", radius: 10 } });
    expect(el).toBeInstanceOf(ImageElement);
    expect(el.type).toBe("image");
    expect(el.props.src).toBe("energy");
  });

  test("suffix-logo creates ImageElement with src: logo", () => {
    const el = createNode({ type: "suffix-logo", props: { suffix: "V", height: 30 } });
    expect(el).toBeInstanceOf(ImageElement);
    expect(el.type).toBe("image");
    expect(el.props.src).toBe("logo");
  });

  test("big-logo creates ImageElement with clipToCard", () => {
    const el = createNode({ type: "big-logo", id: "big-logo-1", props: { x: -50, y: -38, height: 280, opacity: 0.7, suffix: "VSTAR-big" } });
    expect(el).toBeInstanceOf(ImageElement);
    expect(el.type).toBe("image");
    expect(Number(el.props.clipToCard)).toBe(1);
    expect(el.props.src).toBe("logo");
  });

  test("unknown type throws", () => {
    expect(() => createNode({ type: "nope", props: {} })).toThrow("Unknown element type");
  });
});
