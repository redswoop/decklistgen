import { describe, test, expect, beforeEach } from "bun:test";
import { TextElement, expandEnergyTokens } from "./text-element.js";
import { createNode } from "./index.js";
import { resetIconIds } from "../type-icons.js";
import { measureWidth } from "../text.js";
import { ENERGY_COLORS_DARK, ENERGY_COLORS_LIGHT } from "../constants.js";

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

  test("render escapes XML special characters", () => {
    const item = new TextElement({ text: "Scarlet & Violet • 086", fontSize: 20 });
    const svg = item.render(0, 0);
    expect(svg).toContain("Scarlet &amp; Violet");
    expect(svg).not.toContain("Scarlet & Violet");

    const item2 = new TextElement({ text: "Damage < 100 > 50", fontSize: 20 });
    const svg2 = item2.render(0, 0);
    expect(svg2).toContain("&lt;");
    expect(svg2).toContain("&gt;");
  });

  test("wrapped render escapes XML special characters", () => {
    const item = new TextElement({ text: "Scarlet & Violet set info", fontSize: 20, wrap: 1 });
    item.measure(500);
    const svg = item.render(0, 0);
    expect(svg).toContain("Scarlet &amp; Violet");
    expect(svg).not.toContain("Scarlet & Violet");
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

describe("expandEnergyTokens", () => {
  test("replaces {P} with EssentiarumTCG tspan and Psychic color", () => {
    const result = expandEnergyTokens("Costs {P}", 20, ENERGY_COLORS_DARK);
    expect(result).toContain('font-family="EssentiarumTCG"');
    expect(result).toContain(`fill="${ENERGY_COLORS_DARK.P}"`);
    expect(result).toContain('font-size="22"'); // floor(20 * 1.1)
    expect(result).toContain(">P</tspan>");
    expect(result).toContain('dy="-3"'); // baseline alignment offset
    expect(result).toContain('dominant-baseline="auto"');
    expect(result).toStartWith("Costs ");
  });

  test("replaces {N} (Dragon) with filled circle instead of letter", () => {
    const result = expandEnergyTokens("{N}", 20, ENERGY_COLORS_DARK);
    expect(result).toContain("&#x25CF;");
    expect(result).not.toContain('font-family="EssentiarumTCG"');
    expect(result).toContain(`fill="${ENERGY_COLORS_DARK.N}"`);
    expect(result).toContain('dy="-3"');
  });

  test("text with no tokens is returned unchanged", () => {
    const result = expandEnergyTokens("Plain text", 20, ENERGY_COLORS_DARK);
    expect(result).toBe("Plain text");
  });

  test("multiple tokens in one string", () => {
    const result = expandEnergyTokens("{R}{R}{C}", 20, ENERGY_COLORS_DARK);
    expect(result).not.toContain("{R}");
    expect(result).not.toContain("{C}");
    const tspanCount = (result.match(/<tspan/g) || []).length;
    expect(tspanCount).toBe(3);
  });

  test("light palette uses light colors", () => {
    const result = expandEnergyTokens("{P}", 20, ENERGY_COLORS_LIGHT);
    expect(result).toContain(`fill="${ENERGY_COLORS_LIGHT.P}"`);
  });

  test("unknown letter falls back to #888", () => {
    const result = expandEnergyTokens("{Z}", 20, ENERGY_COLORS_DARK);
    expect(result).toContain('fill="#888"');
  });
});

describe("TextElement energy glyphs", () => {
  test("single-line render expands energy tokens", () => {
    const item = new TextElement({ text: "Discard {P} energy", fontSize: 20 });
    const svg = item.render(0, 0);
    expect(svg).toContain('font-family="EssentiarumTCG"');
    expect(svg).toContain(`fill="${ENERGY_COLORS_DARK.P}"`);
    expect(svg).not.toContain("{P}");
  });

  test("wrapped render expands energy tokens per line", () => {
    const item = new TextElement({ text: "Discard {P} energy", fontSize: 20, fontFamily: "body", wrap: 1 });
    item.measure(500);
    const svg = item.render(0, 0);
    expect(svg).toContain('font-family="EssentiarumTCG"');
    expect(svg).not.toContain("{P}");
  });

  test("palette light uses light colors", () => {
    const item = new TextElement({ text: "{R}", fontSize: 20, palette: "light" });
    const svg = item.render(0, 0);
    expect(svg).toContain(`fill="${ENERGY_COLORS_LIGHT.R}"`);
  });

  test("XML escaping works alongside energy tokens", () => {
    const item = new TextElement({ text: "Costs {P} & {R}", fontSize: 20 });
    const svg = item.render(0, 0);
    expect(svg).toContain("&amp;");
    expect(svg).toContain('font-family="EssentiarumTCG"');
    expect(svg).not.toContain("{P}");
    expect(svg).not.toContain("{R}");
  });
});
