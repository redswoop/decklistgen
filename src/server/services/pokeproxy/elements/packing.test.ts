import { describe, test, expect } from "bun:test";
import { packRow } from "./packing.js";
import type { PackItem } from "./packing.js";

function item(overrides: Partial<PackItem> = {}): PackItem {
  return {
    contentWidth: 100,
    contentHeight: 50,
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    vAlign: "top",
    ...overrides,
  };
}

describe("packRow", () => {
  test("empty items returns zero dimensions", () => {
    const result = packRow([], "ltr");
    expect(result.positions).toEqual([]);
    expect(result.totalWidth).toBe(0);
    expect(result.totalHeight).toBe(0);
  });

  test("single item LTR — positioned at origin", () => {
    const result = packRow([item()], "ltr");
    expect(result.positions).toEqual([{ x: 0, y: 0 }]);
    expect(result.totalWidth).toBe(100);
    expect(result.totalHeight).toBe(50);
  });

  test("single item with margin", () => {
    const result = packRow([item({ marginLeft: 10, marginRight: 5, marginTop: 8, marginBottom: 4 })], "ltr");
    expect(result.positions).toEqual([{ x: 10, y: 8 }]);
    expect(result.totalWidth).toBe(115); // 10 + 100 + 5
    expect(result.totalHeight).toBe(62); // 50 + 8 + 4
  });

  test("single item with padding", () => {
    const result = packRow([item({ paddingLeft: 10, paddingRight: 5, paddingTop: 8, paddingBottom: 4 })], "ltr");
    expect(result.positions).toEqual([{ x: 10, y: 8 }]);
    expect(result.totalWidth).toBe(115); // 10 + 100 + 5
    expect(result.totalHeight).toBe(62); // 50 + 8 + 4
  });

  test("single item with margin + padding", () => {
    const result = packRow([item({ marginLeft: 5, paddingLeft: 3, marginRight: 2, paddingRight: 4 })], "ltr");
    expect(result.positions).toEqual([{ x: 8, y: 0 }]); // marginLeft + paddingLeft
    expect(result.totalWidth).toBe(114); // 5 + 3 + 100 + 4 + 2
  });

  test("two items LTR — second follows first", () => {
    const result = packRow([item({ contentWidth: 60 }), item({ contentWidth: 40 })], "ltr");
    expect(result.positions[0].x).toBe(0);
    expect(result.positions[1].x).toBe(60);
    expect(result.totalWidth).toBe(100);
  });

  test("two items LTR with margin between", () => {
    const result = packRow([
      item({ contentWidth: 60, marginRight: 10 }),
      item({ contentWidth: 40, marginLeft: 5 }),
    ], "ltr");
    expect(result.positions[0].x).toBe(0);
    expect(result.positions[1].x).toBe(75); // 60 + 10 + 5
    expect(result.totalWidth).toBe(115); // 60 + 10 + 5 + 40
  });

  test("RTL — items pack in reverse but positions match original order", () => {
    const result = packRow([
      item({ contentWidth: 60 }),
      item({ contentWidth: 40 }),
    ], "rtl");
    expect(result.positions[0].x).toBe(40);
    expect(result.positions[1].x).toBe(0);
    expect(result.totalWidth).toBe(100);
  });

  test("RTL with 3 items", () => {
    const result = packRow([
      item({ contentWidth: 30 }),
      item({ contentWidth: 50 }),
      item({ contentWidth: 20 }),
    ], "rtl");
    expect(result.positions[0].x).toBe(70);
    expect(result.positions[1].x).toBe(20);
    expect(result.positions[2].x).toBe(0);
    expect(result.totalWidth).toBe(100);
  });

  test("vAlign top", () => {
    const result = packRow([
      item({ contentHeight: 30, vAlign: "top" }),
      item({ contentHeight: 50, vAlign: "top" }),
    ], "ltr");
    expect(result.positions[0].y).toBe(0);
    expect(result.positions[1].y).toBe(0);
    expect(result.totalHeight).toBe(50);
  });

  test("vAlign bottom", () => {
    const result = packRow([
      item({ contentHeight: 30, vAlign: "bottom" }),
      item({ contentHeight: 50, vAlign: "bottom" }),
    ], "ltr");
    expect(result.positions[0].y).toBe(20); // 50 - 30
    expect(result.positions[1].y).toBe(0);
    expect(result.totalHeight).toBe(50);
  });

  test("vAlign middle", () => {
    const result = packRow([
      item({ contentHeight: 30, vAlign: "middle" }),
      item({ contentHeight: 50, vAlign: "middle" }),
    ], "ltr");
    expect(result.positions[0].y).toBe(10); // (50 - 30) / 2
    expect(result.positions[1].y).toBe(0);
    expect(result.totalHeight).toBe(50);
  });

  test("mixed vAlign values", () => {
    const result = packRow([
      item({ contentHeight: 20, vAlign: "top" }),
      item({ contentHeight: 20, vAlign: "middle" }),
      item({ contentHeight: 20, vAlign: "bottom" }),
      item({ contentHeight: 60 }), // tallest
    ], "ltr");
    expect(result.totalHeight).toBe(60);
    expect(result.positions[0].y).toBe(0);      // top
    expect(result.positions[1].y).toBe(20);      // middle: (60-20)/2
    expect(result.positions[2].y).toBe(40);      // bottom: 60-20
  });

  test("margin affects vertical alignment", () => {
    const result = packRow([
      item({ contentHeight: 20, marginTop: 5, marginBottom: 5, vAlign: "bottom" }),
      item({ contentHeight: 40 }),
    ], "ltr");
    // Row height = max(20+5+5, 40) = 40
    // bottom: contentY = 40 - 5 - 0 - 20 = 15
    expect(result.positions[0].y).toBe(15);
    expect(result.totalHeight).toBe(40);
  });

  test("padding affects vertical alignment", () => {
    const result = packRow([
      item({ contentHeight: 20, paddingTop: 5, paddingBottom: 5, vAlign: "bottom" }),
      item({ contentHeight: 40 }),
    ], "ltr");
    // Row height = max(20+5+5, 40) = 40
    // bottom: contentY = 40 - 0 - 5 - 20 = 15
    expect(result.positions[0].y).toBe(15);
    expect(result.totalHeight).toBe(40);
  });

  test("margin + padding combined vertical alignment", () => {
    const result = packRow([
      item({ contentHeight: 20, marginTop: 3, paddingTop: 2, marginBottom: 3, paddingBottom: 2, vAlign: "top" }),
      item({ contentHeight: 50 }),
    ], "ltr");
    // outerH for item 0 = 3+2+20+2+3 = 30, item 1 = 50
    // rowHeight = 50
    // top: contentY = marginTop + paddingTop = 3 + 2 = 5
    expect(result.positions[0].y).toBe(5);
    expect(result.totalHeight).toBe(50);
  });

  test("padding insets content without affecting sibling spacing when margin is zero", () => {
    // Two items: first has padding, second has none
    const result = packRow([
      item({ contentWidth: 40, paddingLeft: 5, paddingRight: 5 }),
      item({ contentWidth: 40 }),
    ], "ltr");
    // First item: cursor advances by 0+5+40+5+0 = 50
    // Second item: contentX = 50+0+0 = 50
    expect(result.positions[0].x).toBe(5); // paddingLeft
    expect(result.positions[1].x).toBe(50);
    expect(result.totalWidth).toBe(90); // 50 + 40
  });
});
