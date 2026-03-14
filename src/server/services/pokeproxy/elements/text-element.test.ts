import { describe, test, expect, beforeEach } from "bun:test";
import { TextElement } from "./text-element.js";
import { createNode } from "./index.js";
import { resetIconIds } from "../type-icons.js";
import { measureWidth } from "../text.js";

beforeEach(() => {
  resetIconIds();
});

describe("TextElement single-line", () => {
  test("measure returns expected width from measureWidth", () => {
    const item = new TextElement({ text: "Hello", fontSize: 24, fontFamily: "title" });
    const { width, height } = item.measure();
    const expected = measureWidth("title", "Hello", 24);
    expect(width).toBeCloseTo(expected, 1);
    expect(height).toBe(24);
  });

  test("measure uses body font when specified", () => {
    const item = new TextElement({ text: "Test", fontSize: 16, fontFamily: "body" });
    const { width } = item.measure();
    const expected = measureWidth("body", "Test", 16);
    expect(width).toBeCloseTo(expected, 1);
  });

  test("render produces SVG text element", () => {
    const item = new TextElement({ text: "HP", fontSize: 18, fontFamily: "title", fontWeight: "bold", fill: "#fff", opacity: 0.8 });
    const svg = item.render(10, 20);
    expect(svg).toContain('x="10"');
    expect(svg).toContain('y="20"');
    expect(svg).toContain('font-size="18"');
    expect(svg).toContain('fill="#fff"');
    expect(svg).toContain('opacity="0.8"');
    expect(svg).toContain(">HP</text>");
  });

  test("render with stroke renders stroke attributes", () => {
    const item = new TextElement({ text: "Name", fontSize: 48, fill: "#fff", stroke: "#000", strokeWidth: 2.5 });
    const svg = item.render(0, 0);
    expect(svg).toContain('stroke="#000"');
    expect(svg).toContain('stroke-width="2.5"');
    expect(svg).toContain('stroke-linejoin="round"');
    expect(svg).toContain('paint-order:stroke fill');
  });

  test("render without stroke omits stroke attributes", () => {
    const item = new TextElement({ text: "Name", fontSize: 24 });
    const svg = item.render(0, 0);
    expect(svg).not.toContain("stroke=");
    expect(svg).not.toContain("paint-order");
  });

  test("render with filter renders filter attribute", () => {
    const item = new TextElement({ text: "Name", fontSize: 24, filter: "title-shadow" });
    const svg = item.render(0, 0);
    expect(svg).toContain('filter="url(#title-shadow)"');
  });

  test("render with filter=none omits filter attribute", () => {
    const item = new TextElement({ text: "Name", fontSize: 24, filter: "none" });
    const svg = item.render(0, 0);
    expect(svg).not.toContain('filter="url');
  });

  test("render with textAnchor renders text-anchor attribute", () => {
    const item = new TextElement({ text: "Name", fontSize: 24, textAnchor: "middle" });
    const svg = item.render(0, 0);
    expect(svg).toContain('text-anchor="middle"');
  });

  test("toJSON includes all props", () => {
    const item = new TextElement({ text: "X", fontSize: 12 }, { text: "hp" });
    const json = item.toJSON();
    expect(json.type).toBe("text");
    expect(json.props.text).toBe("X");
    expect(json.props.fontSize).toBe(12);
    expect(json.bind).toEqual({ text: "hp" });
  });
});

describe("TextElement wrapped mode", () => {
  test("measure without allocatedWidth returns single-line dimensions", () => {
    const item = new TextElement({ text: "Hello world", fontSize: 20, fontFamily: "body", wrap: 1 });
    const { width, height } = item.measure();
    const expectedWidth = measureWidth("body", "Hello world", 20);
    expect(width).toBeCloseTo(expectedWidth, 1);
    expect(height).toBe(Math.floor(20 * 1.25));
  });

  test("measure with allocatedWidth returns multi-line height", () => {
    const longText = "This is a longer text that should definitely wrap to multiple lines when measured with a narrow width";
    const item = new TextElement({ text: longText, fontSize: 20, fontFamily: "body", wrap: 1 });
    const { width, height } = item.measure(200);
    expect(width).toBe(200);
    const lineH = Math.floor(20 * 1.25);
    expect(height).toBeGreaterThan(lineH);
    expect(height % lineH).toBe(0);
  });

  test("render produces <text> with <tspan> elements", () => {
    const item = new TextElement({ text: "Short text", fontSize: 20, fontFamily: "body", fontWeight: "bold", fill: "#222", opacity: 1, filter: "none", wrap: 1 });
    item.measure(500);
    const svg = item.render(10, 20);
    expect(svg).toContain("<text");
    expect(svg).toContain("<tspan");
    expect(svg).toContain('x="10"');
    expect(svg).toContain('y="20"');
    expect(svg).toContain('dominant-baseline="hanging"');
  });

  test("render with filter renders filter attribute", () => {
    const item = new TextElement({ text: "Test", fontSize: 20, fontFamily: "body", filter: "shadow", wrap: 1 });
    item.measure(500);
    const svg = item.render(0, 0);
    expect(svg).toContain('filter="url(#shadow)"');
  });

  test("toJSON round-trip", () => {
    const item = new TextElement({ text: "Effect text", fontSize: 18, fontFamily: "body", wrap: 1 }, { text: "attacks[0].effect" });
    const json = item.toJSON();
    expect(json.type).toBe("text");
    expect(json.props.text).toBe("Effect text");
    expect(Number(json.props.wrap)).toBe(1);
    expect(json.bind).toEqual({ text: "attacks[0].effect" });

    const restored = createNode(json);
    expect(restored).toBeInstanceOf(TextElement);
    expect(restored.props.text).toBe("Effect text");
  });
});
