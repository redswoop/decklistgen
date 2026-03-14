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
    grow: 0,
    hAlign: "start",
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
    expect(result.positions[0].y).toBe(15);
    expect(result.totalHeight).toBe(40);
  });

  test("padding affects vertical alignment", () => {
    const result = packRow([
      item({ contentHeight: 20, paddingTop: 5, paddingBottom: 5, vAlign: "bottom" }),
      item({ contentHeight: 40 }),
    ], "ltr");
    expect(result.positions[0].y).toBe(15);
    expect(result.totalHeight).toBe(40);
  });

  test("margin + padding combined vertical alignment", () => {
    const result = packRow([
      item({ contentHeight: 20, marginTop: 3, paddingTop: 2, marginBottom: 3, paddingBottom: 2, vAlign: "top" }),
      item({ contentHeight: 50 }),
    ], "ltr");
    expect(result.positions[0].y).toBe(5);
    expect(result.totalHeight).toBe(50);
  });

  test("padding insets content without affecting sibling spacing when margin is zero", () => {
    const result = packRow([
      item({ contentWidth: 40, paddingLeft: 5, paddingRight: 5 }),
      item({ contentWidth: 40 }),
    ], "ltr");
    expect(result.positions[0].x).toBe(5); // paddingLeft
    expect(result.positions[1].x).toBe(50);
    expect(result.totalWidth).toBe(90); // 50 + 40
  });
});

describe("packRow grow", () => {
  test("single grow item absorbs all extra space", () => {
    // One 100px item with grow=1, container 500px
    const result = packRow([item({ contentWidth: 100, grow: 1 })], "ltr", 500);
    // Content position unchanged (hAlign=start), cursor advances by 500
    expect(result.positions[0].x).toBe(0);
    expect(result.totalWidth).toBe(500);
  });

  test("grow distributes extra space proportionally", () => {
    // Two items: 100px each, grow=1 and grow=3, container=600
    // Natural total = 200, extra = 400
    // Item 0 gets 100 extra, item 1 gets 300 extra
    const result = packRow([
      item({ contentWidth: 100, grow: 1 }),
      item({ contentWidth: 100, grow: 3 }),
    ], "ltr", 600);
    expect(result.positions[0].x).toBe(0);
    // Item 0 occupies 200 (100 content + 100 extra)
    expect(result.positions[1].x).toBe(200);
    expect(result.totalWidth).toBe(600);
  });

  test("only grow items receive extra space", () => {
    // 3 items: [fixed 50] [grow=1, 50] [fixed 50], container=500
    // Natural = 150, extra = 350, all to middle item
    const result = packRow([
      item({ contentWidth: 50 }),
      item({ contentWidth: 50, grow: 1 }),
      item({ contentWidth: 50 }),
    ], "ltr", 500);
    expect(result.positions[0].x).toBe(0);
    expect(result.positions[1].x).toBe(50);
    // Middle gets 50 + 350 = 400 allocated, so cursor after middle = 50 + 400 = 450
    expect(result.positions[2].x).toBe(450);
    expect(result.totalWidth).toBe(500);
  });

  test("no containerWidth — grow has no effect", () => {
    const result = packRow([
      item({ contentWidth: 100, grow: 1 }),
    ], "ltr");
    expect(result.totalWidth).toBe(100);
  });

  test("containerWidth smaller than natural — no extra distributed", () => {
    const result = packRow([
      item({ contentWidth: 100, grow: 1 }),
      item({ contentWidth: 100, grow: 1 }),
    ], "ltr", 150);
    // Natural = 200 > 150, no extra
    expect(result.positions[0].x).toBe(0);
    expect(result.positions[1].x).toBe(100);
    // totalWidth = max(150, 200) = 200
    expect(result.totalWidth).toBe(200);
  });

  test("containerWidth with no grow items — extra space unused, totalWidth matches container", () => {
    const result = packRow([
      item({ contentWidth: 50 }),
      item({ contentWidth: 50 }),
    ], "ltr", 500);
    expect(result.positions[0].x).toBe(0);
    expect(result.positions[1].x).toBe(50);
    // Items only use 100px but totalWidth = containerWidth
    expect(result.totalWidth).toBe(500);
  });

  test("grow with margins — margins are not stretched", () => {
    // [margin=10, content=40, margin=10] + [grow=1, content=40], container=200
    // Natural = (10+40+10) + 40 = 100, extra = 100 → all to second item
    const result = packRow([
      item({ contentWidth: 40, marginLeft: 10, marginRight: 10 }),
      item({ contentWidth: 40, grow: 1 }),
    ], "ltr", 200);
    expect(result.positions[0].x).toBe(10); // marginLeft
    // After first item: 10+40+10 = 60
    expect(result.positions[1].x).toBe(60);
    // Second item allocated: 40 + 100 = 140
    expect(result.totalWidth).toBe(200);
  });
});

describe("packRow hAlign", () => {
  test("hAlign start — content at left of slot (default)", () => {
    const result = packRow([
      item({ contentWidth: 50, grow: 1 }),
    ], "ltr", 200);
    expect(result.positions[0].x).toBe(0);
  });

  test("hAlign center — content centered in slot", () => {
    // Item: 50px content, grow=1, container=200 → allocated 200px
    // Center: 0 + (200 - 50) / 2 = 75
    const result = packRow([
      item({ contentWidth: 50, grow: 1, hAlign: "center" }),
    ], "ltr", 200);
    expect(result.positions[0].x).toBe(75);
  });

  test("hAlign end — content at right of slot", () => {
    // Item: 50px content, grow=1, container=200 → allocated 200px
    // End: 0 + (200 - 50) = 150
    const result = packRow([
      item({ contentWidth: 50, grow: 1, hAlign: "end" }),
    ], "ltr", 200);
    expect(result.positions[0].x).toBe(150);
  });

  test("hAlign has no effect without grow (no extra space)", () => {
    const result = packRow([
      item({ contentWidth: 50, hAlign: "end" }),
    ], "ltr");
    // No extra space, so end aligns to 0 + (50-50) = 0
    expect(result.positions[0].x).toBe(0);
  });

  test("hAlign with multiple items — each aligns independently", () => {
    // [fixed 40] [grow=1, center, 40px] [fixed 40], container=400
    // Natural = 120, extra = 280 → middle gets 280
    // Middle slot starts at 40, allocated = 40+280 = 320
    // Center: 40 + (320 - 40) / 2 = 40 + 140 = 180
    const result = packRow([
      item({ contentWidth: 40 }),
      item({ contentWidth: 40, grow: 1, hAlign: "center" }),
      item({ contentWidth: 40 }),
    ], "ltr", 400);
    expect(result.positions[0].x).toBe(0);
    expect(result.positions[1].x).toBe(180);
    expect(result.positions[2].x).toBe(360);
  });

  test("grow + hAlign with RTL direction", () => {
    // [grow=1, end, 40px] [fixed 60], container=300
    // Natural = 100, extra = 200 → first item gets 200
    // RTL: packs [1] then [0]
    // [1] at cursor=0, width=60
    // [0] at cursor=60, allocated=240, hAlign=end: 60 + (240-40) = 260
    // Reversed back: positions[0]=260, positions[1]=0
    const result = packRow([
      item({ contentWidth: 40, grow: 1, hAlign: "end" }),
      item({ contentWidth: 60 }),
    ], "rtl", 300);
    expect(result.positions[0].x).toBe(260);
    expect(result.positions[1].x).toBe(0);
    expect(result.totalWidth).toBe(300);
  });
});
