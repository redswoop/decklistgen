import { describe, test, expect, beforeEach } from "bun:test";
import { PackedRowElement } from "./packed-row.js";
import { TextItem, TypeDotItem, SuffixLogoItem, WrappedTextItem } from "./sub-elements.js";
import { createElement, createNode, createDefaultElements } from "./index.js";
import { resetIconIds } from "../type-icons.js";
import { measureWidth } from "../text.js";

beforeEach(() => {
  resetIconIds();
});

describe("PackedRowElement", () => {
  test("empty row renders empty <g>", () => {
    const row = new PackedRowElement(undefined, undefined, undefined, "row-1");
    const svg = row.render(0, 0);
    expect(svg).toBe('<g data-element-id="row-1"></g>');
  });

  test("row without id omits data-element-id", () => {
    const row = new PackedRowElement();
    const svg = row.render(0, 0);
    expect(svg).toBe('<g></g>');
  });

  test("row with TextItem renders <text> at correct position", () => {
    const row = new PackedRowElement(
      { anchorX: 100, anchorY: 50, direction: "ltr" },
      [new TextItem({ text: "HP", fontSize: 20, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top" })],
      undefined,
      "row-1",
    );
    const svg = row.render(100, 50);
    expect(svg).toContain('transform="translate(100,50)"');
    expect(svg).toContain("<text");
    expect(svg).toContain('dominant-baseline="hanging"');
    expect(svg).toContain(">HP</text>");
  });

  test("row with TypeDotItem renders icon markup", () => {
    const row = new PackedRowElement(
      { anchorX: 0, anchorY: 0, direction: "ltr" },
      [new TypeDotItem({ energyType: "Fire", radius: 20, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top" })],
      undefined,
      "row-1",
    );
    const svg = row.render(0, 0);
    expect(svg).toContain('data-element-id="row-1"');
    expect(svg).toContain("circle"); // type icon renders circles
  });

  test("toJSON round-trip", () => {
    const row = new PackedRowElement(
      { anchorX: 100, anchorY: 50, direction: "rtl" },
      [
        new TextItem({ text: "HP", fontSize: 18, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top" }),
        new TypeDotItem({ energyType: "Water", radius: 15, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }),
      ],
      undefined,
      "row-1",
    );

    const json = row.toJSON();
    expect(json.type).toBe("packed-row");
    expect(json.id).toBe("row-1");
    expect(json.children).toHaveLength(2);
    expect(json.children![0].type).toBe("text");
    expect(json.children![0].props.text).toBe("HP");
    expect(json.children![1].type).toBe("type-dot");
    expect(json.children![1].props.energyType).toBe("Water");

    // Rebuild from JSON and check render matches
    resetIconIds();
    const svg1 = row.render(100, 50);
    resetIconIds();
    const restored = createElement(json) as PackedRowElement;
    const svg2 = restored.render(100, 50);
    expect(svg2).toBe(svg1);
  });

  test("toJSON preserves bind maps", () => {
    const row = new PackedRowElement(
      {},
      [new TextItem({ text: "280", fontSize: 50 }, { text: "hp" })],
      undefined,
      "row-1",
    );
    const json = row.toJSON();
    expect(json.children![0].bind).toEqual({ text: "hp" });
  });

  test("propDefs has isPosition on anchorX/anchorY", () => {
    const row = new PackedRowElement(undefined, undefined, undefined, "row-1");
    const defs = row.propDefs();
    const anchorX = defs.find(d => d.key === "anchorX");
    const anchorY = defs.find(d => d.key === "anchorY");
    expect(anchorX).toBeDefined();
    expect(anchorX!.isPosition).toBe(true);
    expect(anchorY).toBeDefined();
    expect(anchorY!.isPosition).toBe(true);
  });

  test("fill renders background rect", () => {
    const row = new PackedRowElement(
      { anchorX: 0, anchorY: 0, direction: "ltr", fill: "#333", fillOpacity: 0.2, rx: 5 },
      [new TextItem({ text: "Hi", fontSize: 20, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top" })],
      undefined,
      "row-1",
    );
    const svg = row.render(0, 0);
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
    const row = new PackedRowElement(
      { anchorX: 0, anchorY: 0, direction: "ltr" },
      [new TextItem({ text: "Hi", fontSize: 20, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top" })],
      undefined,
      "row-1",
    );
    const svg = row.render(0, 0);
    expect(svg).not.toContain('<rect');
  });

  test("container padding insets children from background edge", () => {
    const row = new PackedRowElement(
      { anchorX: 0, anchorY: 0, direction: "ltr", paddingLeft: 10, paddingTop: 5, paddingRight: 10, paddingBottom: 5, fill: "#333", fillOpacity: 1, rx: 0 },
      [new TextItem({ text: "Hi", fontSize: 20, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top", grow: 0, hAlign: "start" })],
      undefined,
      "row-1",
    );
    const svg = row.render(0, 0);
    // Text should be offset by container padding
    expect(svg).toContain('x="10"'); // padLeft
    expect(svg).toContain('y="5"');  // padTop
  });

  test("container padding with fixed width — children get inner width", () => {
    const row = new PackedRowElement(
      { anchorX: 0, anchorY: 0, direction: "ltr", width: 200, paddingLeft: 20, paddingRight: 20, fill: "#333", fillOpacity: 1, rx: 0 },
      [new TextItem({ text: "X", fontSize: 20, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, grow: 1, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top" })],
      undefined,
      "row-1",
    );
    const svg = row.render(0, 0);
    // Background rect should be full 200px wide
    expect(svg).toContain('width="200"');
  });

  test("container margin offsets translate from anchor", () => {
    const row = new PackedRowElement(
      { anchorX: 100, anchorY: 50, direction: "ltr", marginLeft: 5, marginTop: 3 },
      [new TextItem({ text: "Hi", fontSize: 20, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top", grow: 0, hAlign: "start" })],
      undefined,
      "row-1",
    );
    const svg = row.render(100, 50);
    // Translate should be anchor + margin: (105, 53)
    expect(svg).toContain('translate(105,53)');
  });

  test("width + grow stretches background rect to full width", () => {
    const row = new PackedRowElement(
      { anchorX: 0, anchorY: 0, direction: "ltr", width: 500, fill: "#333", fillOpacity: 0.1, rx: 0 },
      [
        new TextItem({ text: "Name", fontSize: 20, fontFamily: "title", fontWeight: "bold", fill: "#000", opacity: 1, grow: 1, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top" }),
        new TextItem({ text: "60", fontSize: 20, fontFamily: "title", fontWeight: "bold", fill: "#c00", opacity: 1, grow: 0, hAlign: "end", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "top" }),
      ],
      undefined,
      "row-1",
    );
    const svg = row.render(0, 0);
    // Background rect should span full 500px width
    expect(svg).toContain('width="500"');
    // Both text elements should render
    expect(svg).toContain(">Name</text>");
    expect(svg).toContain(">60</text>");
  });

  test("HP cluster default renders all 3 children", () => {
    const elements = createDefaultElements();
    const hpCluster = elements.find(e => e.id === "hp-cluster-1") as PackedRowElement;
    expect(hpCluster).toBeDefined();
    expect(hpCluster.children).toHaveLength(3);
    expect(hpCluster.children[0].type).toBe("text");
    expect(hpCluster.children[1].type).toBe("text");
    expect(hpCluster.children[2].type).toBe("type-dot");

    const svg = hpCluster.render(514, 42);
    expect(svg).toContain(">HP</text>");
    expect(svg).toContain(">280</text>");
    expect(svg).toContain("circle"); // type dot
  });

  test("measure returns packed dimensions including padding", () => {
    const row = new PackedRowElement(
      { direction: "ltr", paddingTop: 5, paddingBottom: 5, paddingLeft: 10, paddingRight: 10 },
      [new TextItem({ text: "Hi", fontSize: 20, fontFamily: "title" })],
    );
    const { width, height } = row.measure();
    const textWidth = measureWidth("title", "Hi", 20);
    expect(width).toBe(10 + textWidth + 10); // padL + content + padR
    expect(height).toBe(5 + 20 + 5); // padT + content + padB
  });

  test("measure with empty children returns zero", () => {
    const row = new PackedRowElement({ direction: "ltr" });
    expect(row.measure()).toEqual({ width: 0, height: 0 });
  });
});

describe("TextItem", () => {
  test("measure returns expected width from measureWidth", () => {
    const item = new TextItem({ text: "Hello", fontSize: 24, fontFamily: "title" });
    const { width, height } = item.measure();
    const expected = measureWidth("title", "Hello", 24);
    expect(width).toBeCloseTo(expected, 1);
    expect(height).toBe(24);
  });

  test("measure uses body font when specified", () => {
    const item = new TextItem({ text: "Test", fontSize: 16, fontFamily: "body" });
    const { width } = item.measure();
    const expected = measureWidth("body", "Test", 16);
    expect(width).toBeCloseTo(expected, 1);
  });

  test("render produces SVG text element", () => {
    const item = new TextItem({ text: "HP", fontSize: 18, fontFamily: "title", fontWeight: "bold", fill: "#fff", opacity: 0.8 });
    const svg = item.render(10, 20);
    expect(svg).toContain('x="10"');
    expect(svg).toContain('y="20"');
    expect(svg).toContain('font-size="18"');
    expect(svg).toContain('fill="#fff"');
    expect(svg).toContain('opacity="0.8"');
    expect(svg).toContain(">HP</text>");
  });

  test("render with stroke renders stroke attributes", () => {
    const item = new TextItem({ text: "Name", fontSize: 48, fill: "#fff", stroke: "#000", strokeWidth: 2.5 });
    const svg = item.render(0, 0);
    expect(svg).toContain('stroke="#000"');
    expect(svg).toContain('stroke-width="2.5"');
    expect(svg).toContain('stroke-linejoin="round"');
    expect(svg).toContain('paint-order:stroke fill');
  });

  test("render without stroke omits stroke attributes", () => {
    const item = new TextItem({ text: "Name", fontSize: 24 });
    const svg = item.render(0, 0);
    expect(svg).not.toContain("stroke=");
    expect(svg).not.toContain("paint-order");
  });

  test("render with filter renders filter attribute", () => {
    const item = new TextItem({ text: "Name", fontSize: 24, filter: "title-shadow" });
    const svg = item.render(0, 0);
    expect(svg).toContain('filter="url(#title-shadow)"');
  });

  test("render with filter=none omits filter attribute", () => {
    const item = new TextItem({ text: "Name", fontSize: 24, filter: "none" });
    const svg = item.render(0, 0);
    expect(svg).not.toContain('filter="url');
  });

  test("render with textAnchor renders text-anchor attribute", () => {
    const item = new TextItem({ text: "Name", fontSize: 24, textAnchor: "middle" });
    const svg = item.render(0, 0);
    expect(svg).toContain('text-anchor="middle"');
  });

  test("toJSON includes all props", () => {
    const item = new TextItem({ text: "X", fontSize: 12 }, { text: "hp" });
    const json = item.toJSON();
    expect(json.type).toBe("text");
    expect(json.props.text).toBe("X");
    expect(json.props.fontSize).toBe(12);
    expect(json.bind).toEqual({ text: "hp" });
  });
});

describe("TypeDotItem", () => {
  test("measure returns diameter", () => {
    const item = new TypeDotItem({ radius: 20 });
    const { width, height } = item.measure();
    expect(width).toBe(40);
    expect(height).toBe(40);
  });

  test("render produces icon markup", () => {
    const item = new TypeDotItem({ energyType: "Water", radius: 15 });
    const svg = item.render(10, 10);
    expect(svg).toContain("circle");
  });

  test("toJSON includes bind", () => {
    const item = new TypeDotItem({ energyType: "Fire", radius: 28 }, { energyType: "types[0]" });
    const json = item.toJSON();
    expect(json.type).toBe("type-dot");
    expect(json.props.energyType).toBe("Fire");
    expect(json.bind).toEqual({ energyType: "types[0]" });
  });
});

describe("SuffixLogoItem", () => {
  test("measure returns correct dimensions from renderSuffixLogo", () => {
    const item = new SuffixLogoItem({ suffix: "VSTAR", height: 55 });
    const { width, height } = item.measure();
    expect(height).toBe(55);
    expect(width).toBeGreaterThan(0);
  });

  test("render produces <image> element", () => {
    const item = new SuffixLogoItem({ suffix: "V", height: 40 });
    const svg = item.render(10, 20);
    expect(svg).toContain("<image");
    expect(svg).toContain('x="10"');
    expect(svg).toContain('y="20"');
    expect(svg).toContain("data:image/png;base64,");
  });

  test("render with filter includes filter attr", () => {
    const item = new SuffixLogoItem({ suffix: "ex", height: 40, filter: "title-shadow" });
    const svg = item.render(0, 0);
    expect(svg).toContain('filter="url(#title-shadow)"');
  });

  test("render with filter=none omits filter attr", () => {
    const item = new SuffixLogoItem({ suffix: "ex", height: 40, filter: "none" });
    const svg = item.render(0, 0);
    expect(svg).not.toContain("filter=");
  });

  test("toJSON round-trip", () => {
    const item = new SuffixLogoItem({ suffix: "ex", height: 40 }, { suffix: "_nameSuffix" });
    const json = item.toJSON();
    expect(json.type).toBe("suffix-logo");
    expect(json.props.suffix).toBe("ex");
    expect(json.props.height).toBe(40);
    expect(json.bind).toEqual({ suffix: "_nameSuffix" });

    const restored = createNode(json);
    expect(restored).toBeInstanceOf(SuffixLogoItem);
    expect(restored.props.suffix).toBe("ex");
  });

  test("unknown suffix renders empty string", () => {
    const item = new SuffixLogoItem({ suffix: "UNKNOWN", height: 40 });
    const svg = item.render(0, 0);
    expect(svg).toBe("");
  });
});

describe("createNode factory", () => {
  test("text creates TextItem", () => {
    const el = createNode({ type: "text", props: { text: "Hi", fontSize: 20 } });
    expect(el).toBeInstanceOf(TextItem);
    expect(el.type).toBe("text");
  });

  test("type-dot creates TypeDotItem", () => {
    const el = createNode({ type: "type-dot", props: { energyType: "Grass", radius: 10 } });
    expect(el).toBeInstanceOf(TypeDotItem);
    expect(el.type).toBe("type-dot");
  });

  test("suffix-logo creates SuffixLogoItem", () => {
    const el = createNode({ type: "suffix-logo", props: { suffix: "V", height: 30 } });
    expect(el).toBeInstanceOf(SuffixLogoItem);
    expect(el.type).toBe("suffix-logo");
  });

  test("wrapped-text creates WrappedTextItem", () => {
    const el = createNode({ type: "wrapped-text", props: { text: "Hello", fontSize: 20 } });
    expect(el).toBeInstanceOf(WrappedTextItem);
    expect(el.type).toBe("wrapped-text");
  });

  test("packed-row-item creates PackedRowElement (alias)", () => {
    const el = createNode({ type: "packed-row-item", props: { direction: "ltr" }, children: [
      { type: "text", props: { text: "A", fontSize: 20 } },
    ]});
    expect(el).toBeInstanceOf(PackedRowElement);
    expect(el.type).toBe("packed-row");
  });

  test("unknown type throws", () => {
    expect(() => createNode({ type: "nope", props: {} })).toThrow("Unknown element type");
  });
});

describe("Name cluster default", () => {
  test("name cluster renders text + suffix logo", () => {
    const elements = createDefaultElements();
    const nameCluster = elements.find(e => e.id === "name-cluster-1") as PackedRowElement;
    expect(nameCluster).toBeDefined();
    expect(nameCluster.children).toHaveLength(2);
    expect(nameCluster.children[0].type).toBe("text");
    expect(nameCluster.children[1].type).toBe("suffix-logo");

    const svg = nameCluster.render(30, 62);
    expect(svg).toContain(">Arcanine</text>");
    expect(svg).toContain("<image");
  });
});
