import { describe, test, expect, beforeEach } from "bun:test";
import { StackElement } from "./stack.js";
import { PackedRowElement } from "./packed-row.js";
import { TextItem, TypeDotItem, WrappedTextItem } from "./sub-elements.js";
import { createElement, createNode, createDefaultElements } from "./index.js";
import { resetIconIds } from "../type-icons.js";
import { measureWidth } from "../text.js";

beforeEach(() => {
  resetIconIds();
});

describe("StackElement", () => {
  test("empty stack renders empty <g>", () => {
    const stack = new StackElement(undefined, undefined, undefined, "stack-1");
    const svg = stack.render(0, 0);
    expect(svg).toBe('<g data-element-id="stack-1"></g>');
  });

  test("stack without id omits data-element-id", () => {
    const stack = new StackElement();
    const svg = stack.render(0, 0);
    expect(svg).toBe('<g></g>');
  });

  test("stack with TextItem renders at correct position with padding", () => {
    const stack = new StackElement(
      {
        anchorX: 20, anchorY: 100, width: 400,
        paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10,
      },
      [new TextItem({ text: "Hello", fontSize: 24, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top", grow: 0, hAlign: "start" })],
      undefined,
      "stack-1",
    );
    const svg = stack.render(20, 100);
    expect(svg).toContain('translate(20,100)');
    expect(svg).toContain("<text");
    expect(svg).toContain(">Hello</text>");
    // Text should be at padLeft=10, padTop=10
    expect(svg).toContain('x="10"');
    expect(svg).toContain('y="10"');
  });

  test("stack with two children — second child below first + gap", () => {
    const stack = new StackElement(
      {
        anchorX: 0, anchorY: 0, width: 400, gap: 5,
        paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
      [
        new TextItem({ text: "A", fontSize: 20, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top", grow: 0, hAlign: "start" }),
        new TextItem({ text: "B", fontSize: 20, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top", grow: 0, hAlign: "start" }),
      ],
      undefined,
      "stack-1",
    );
    const svg = stack.render(0, 0);
    // First child at y=0
    expect(svg).toContain('data-child-index="0"');
    expect(svg).toContain('data-child-index="1"');
    // Second child should be at y = first child height (20) + gap (5) = 25
    expect(svg).toContain('y="25"');
  });

  test("stack passes allocatedWidth to WrappedTextItem for wrapping", () => {
    const longText = "This is a long text that should wrap to multiple lines when given a narrow width constraint for the container";
    const stack = new StackElement(
      {
        anchorX: 0, anchorY: 0, width: 300,
        paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
      [new WrappedTextItem({
        text: longText, fontSize: 20, fontFamily: "body", fontWeight: "bold",
        fill: "#000", opacity: 1, filter: "none",
        marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
        paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
        vAlign: "top", grow: 0, hAlign: "start",
      })],
      undefined,
      "stack-1",
    );
    const svg = stack.render(0, 0);
    // Should have multiple tspan elements (wrapped lines)
    const tspanCount = (svg.match(/<tspan/g) || []).length;
    expect(tspanCount).toBeGreaterThan(1);
  });

  test("stack with fill renders background rect sized correctly", () => {
    const stack = new StackElement(
      {
        anchorX: 0, anchorY: 0, width: 500,
        paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10,
        fill: "#333", fillOpacity: 0.2, rx: 5,
      },
      [new TextItem({ text: "Hi", fontSize: 20, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top", grow: 0, hAlign: "start" })],
      undefined,
      "stack-1",
    );
    const svg = stack.render(0, 0);
    expect(svg).toContain('<rect');
    expect(svg).toContain('width="500"');
    expect(svg).toContain('fill="#333"');
    expect(svg).toContain('opacity="0.2"');
    expect(svg).toContain('rx="5"');
    // height = padTop(10) + fontSize(20) + padBottom(10) = 40
    expect(svg).toContain('height="40"');
  });

  test("toJSON round-trip", () => {
    const stack = new StackElement(
      {
        anchorX: 20, anchorY: 100, width: 600, gap: 4,
        paddingTop: 4, paddingRight: 8, paddingBottom: 8, paddingLeft: 8,
        fill: "#333", fillOpacity: 0.1, rx: 5,
      },
      [
        new PackedRowElement(
          { direction: "ltr" },
          [new TextItem({ text: "Attack", fontSize: 28, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", grow: 1, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" })],
        ),
        new WrappedTextItem({
          text: "Does 20 damage.", fontSize: 20, fontFamily: "body", fontWeight: "bold",
          fill: "#222", opacity: 1, filter: "none",
          marginTop: 4, marginRight: 0, marginBottom: 0, marginLeft: 0,
          paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
          vAlign: "top", grow: 0, hAlign: "start",
        }),
      ],
      undefined,
      "stack-1",
    );

    const json = stack.toJSON();
    expect(json.type).toBe("stack");
    expect(json.id).toBe("stack-1");
    expect(json.children).toHaveLength(2);
    expect(json.children![0].type).toBe("packed-row");
    expect(json.children![0].children).toHaveLength(1);
    expect(json.children![1].type).toBe("wrapped-text");

    // Rebuild from JSON and check render matches
    resetIconIds();
    const svg1 = stack.render(20, 100);
    resetIconIds();
    const restored = createElement(json) as StackElement;
    const svg2 = restored.render(20, 100);
    expect(svg2).toBe(svg1);
  });

  test("stack with vAnchor bottom — render() does not adjust internally", () => {
    const stack = new StackElement(
      {
        anchorX: 20, anchorY: 440, width: 400, vAnchor: "bottom",
        paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10,
      },
      [new TextItem({ text: "Hello", fontSize: 24, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top", grow: 0, hAlign: "start" })],
      undefined,
      "stack-1",
    );
    // vAnchor is now interpreted by the parent (renderElements), not by render()
    const svg = stack.render(20, 566);
    expect(svg).toContain('translate(20,566)');
  });

  test("stack with vAnchor top (default) translates at anchorY", () => {
    const stack = new StackElement(
      {
        anchorX: 20, anchorY: 100, width: 400,
        paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10,
      },
      [new TextItem({ text: "Hello", fontSize: 24, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top", grow: 0, hAlign: "start" })],
      undefined,
      "stack-1",
    );
    const svg = stack.render(20, 100);
    expect(svg).toContain('translate(20,100)');
  });

  test("no fill renders no background rect", () => {
    const stack = new StackElement(
      { anchorX: 0, anchorY: 0, width: 400 },
      [new TextItem({ text: "Hi", fontSize: 20, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top", grow: 0, hAlign: "start" })],
      undefined,
      "stack-1",
    );
    const svg = stack.render(0, 0);
    expect(svg).not.toContain('<rect');
  });

  test("measure returns total dimensions including padding", () => {
    const stack = new StackElement(
      {
        width: 400, gap: 5,
        paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10,
      },
      [
        new TextItem({ text: "A", fontSize: 20, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }),
        new TextItem({ text: "B", fontSize: 20, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }),
      ],
    );
    const { width, height } = stack.measure();
    expect(width).toBe(400);
    // padTop(10) + child1(20) + gap(5) + child2(20) + padBottom(10) = 65
    expect(height).toBe(65);
  });

  test("measure with empty children returns padding only", () => {
    const stack = new StackElement({ width: 200, paddingTop: 5, paddingBottom: 5 });
    const { width, height } = stack.measure();
    expect(width).toBe(200);
    expect(height).toBe(10); // padTop + padBottom
  });
});

describe("WrappedTextItem", () => {
  test("measure without allocatedWidth returns single-line dimensions", () => {
    const item = new WrappedTextItem({ text: "Hello world", fontSize: 20, fontFamily: "body" });
    const { width, height } = item.measure();
    const expectedWidth = measureWidth("body", "Hello world", 20);
    expect(width).toBeCloseTo(expectedWidth, 1);
    expect(height).toBe(Math.floor(20 * 1.25));
  });

  test("measure with allocatedWidth returns multi-line height", () => {
    const longText = "This is a longer text that should definitely wrap to multiple lines when measured with a narrow width";
    const item = new WrappedTextItem({ text: longText, fontSize: 20, fontFamily: "body" });
    const { width, height } = item.measure(200);
    expect(width).toBe(200);
    const lineH = Math.floor(20 * 1.25);
    expect(height).toBeGreaterThan(lineH); // multiple lines
    expect(height % lineH).toBe(0); // exact multiple of line height
  });

  test("render produces <text> with <tspan> elements", () => {
    const item = new WrappedTextItem({ text: "Short text", fontSize: 20, fontFamily: "body", fontWeight: "bold", fill: "#222", opacity: 1, filter: "none" });
    item.measure(500); // set allocatedWidth
    const svg = item.render(10, 20);
    expect(svg).toContain("<text");
    expect(svg).toContain("<tspan");
    expect(svg).toContain('x="10"');
    expect(svg).toContain('y="20"');
    expect(svg).toContain('dominant-baseline="hanging"');
  });

  test("render with filter renders filter attribute", () => {
    const item = new WrappedTextItem({ text: "Test", fontSize: 20, fontFamily: "body", filter: "shadow" });
    item.measure(500);
    const svg = item.render(0, 0);
    expect(svg).toContain('filter="url(#shadow)"');
  });

  test("toJSON round-trip", () => {
    const item = new WrappedTextItem({ text: "Effect text", fontSize: 18, fontFamily: "body" }, { text: "attacks[0].effect" });
    const json = item.toJSON();
    expect(json.type).toBe("wrapped-text");
    expect(json.props.text).toBe("Effect text");
    expect(json.bind).toEqual({ text: "attacks[0].effect" });

    const restored = createNode(json);
    expect(restored).toBeInstanceOf(WrappedTextItem);
    expect(restored.props.text).toBe("Effect text");
  });
});

describe("packed-row grow inside stack", () => {
  test("grow distributes extra width when stack passes allocatedWidth to render", () => {
    const row = new PackedRowElement(
      { direction: "ltr" },
      [
        new TextItem({ text: "A", fontSize: 20, grow: 1, hAlign: "start", marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }),
        new TextItem({ text: "B", fontSize: 20, grow: 0, hAlign: "end", marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }),
      ],
    );
    const stack = new StackElement(
      { width: 400, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
      [row],
    );

    const svg = stack.render(0, 0);
    // "B" should be pushed to the right by grow on "A"
    const textMatches = [...svg.matchAll(/x="([0-9.]+)"[^>]*>[AB]<\/text>/g)];
    expect(textMatches).toHaveLength(2);
    const xA = Number(textMatches[0][1]);
    const xB = Number(textMatches[1][1]);
    // B should be near the right edge (400), not packed next to A
    expect(xB).toBeGreaterThan(300);
    expect(xA).toBeLessThan(100);
  });
});

describe("attack-block-1 default element", () => {
  test("renders both header row and description", () => {
    const elements = createDefaultElements();
    const attackBlock = elements.find(e => e.id === "attack-block-1") as StackElement;
    expect(attackBlock).toBeDefined();
    expect(attackBlock.type).toBe("stack");
    expect(attackBlock.children).toHaveLength(5);
    expect(attackBlock.children[0].type).toBe("packed-row");
    expect(attackBlock.children[1].type).toBe("wrapped-text");
    expect(attackBlock.children[2].type).toBe("packed-row");
    expect(attackBlock.children[3].type).toBe("wrapped-text");
    expect(attackBlock.children[4].type).toBe("packed-row"); // weakness/resistance/retreat

    const svg = attackBlock.render(20, 610);
    expect(svg).toContain(">Leaf Blade</text>");
    expect(svg).toContain(">60</text>");
    expect(svg).toContain(">Star Slash</text>");
    expect(svg).toContain(">190</text>");
    expect(svg).toContain("circle"); // energy type dots
    expect(svg).toContain("<tspan"); // wrapped text
    expect(svg).toContain("Does 20 more damage");
    expect(svg).toContain("VSTAR Power");
  });
});

describe("deep nesting", () => {
  test("packed-row inside stack inside packed-row (3+ levels)", () => {
    // Level 1: outer packed-row
    // Level 2: stack (as child of outer packed-row)
    // Level 3: inner packed-row (as child of stack)
    // Level 4: text items (leaves)
    const innerRow = new PackedRowElement(
      { direction: "ltr" },
      [
        new TextItem({ text: "Deep", fontSize: 16, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }),
        new TextItem({ text: "Nesting", fontSize: 16, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }),
      ],
    );

    const middleStack = new StackElement(
      { width: 300 },
      [
        innerRow,
        new TextItem({ text: "Below", fontSize: 14, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, hAlign: "start" }),
      ],
    );

    const outerRow = new PackedRowElement(
      { direction: "ltr" },
      [
        new TextItem({ text: "Outer", fontSize: 20, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }),
        middleStack,
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

    // Verify measure works at depth
    const { width, height } = outerRow.measure();
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);

    // Verify toJSON round-trip at depth
    const json = outerRow.toJSON();
    expect(json.children).toHaveLength(2);
    expect(json.children![1].type).toBe("stack");
    expect(json.children![1].children).toHaveLength(2);
    expect(json.children![1].children![0].type).toBe("packed-row");
    expect(json.children![1].children![0].children).toHaveLength(2);

    // Rebuild from JSON
    const restored = createNode(json) as PackedRowElement;
    const svg2 = restored.render(0, 0);
    expect(svg2).toBe(svg);
  });
});
