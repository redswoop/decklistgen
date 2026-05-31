import { describe, expect, test } from "bun:test";
import { CARD_W_IN, CARD_H_IN } from "./print-grid.js";
import {
  CARD_GAP_IN,
  cropMarkLayout,
  markDimsForGrid,
  pageGridShape,
} from "./print-crop-marks.js";

describe("pageGridShape", () => {
  test("a full page keeps the requested cols/rows", () => {
    expect(pageGridShape(9, 3, 3)).toEqual({ cols: 3, rows: 3 });
  });

  test("more cards than fit clamps to the page grid", () => {
    expect(pageGridShape(20, 3, 3)).toEqual({ cols: 3, rows: 3 });
  });

  test("a single row's worth shrinks to one row", () => {
    expect(pageGridShape(2, 3, 3)).toEqual({ cols: 2, rows: 1 });
  });

  test("a partial multi-row page keeps full cols and rounds up rows", () => {
    // 6 cards on a 3×3 page → 3×2.
    expect(pageGridShape(6, 3, 3)).toEqual({ cols: 3, rows: 2 });
  });

  test("zero cards falls back to a 1×1 cell", () => {
    expect(pageGridShape(0, 3, 3)).toEqual({ cols: 1, rows: 1 });
  });
});

describe("markDimsForGrid", () => {
  test("a roomy page uses the full mark size", () => {
    // A small grid on a big sheet leaves slack well past the desired pad.
    const { markLen, markGap } = markDimsForGrid(3, 4, 13, 19);
    expect(markLen).toBeCloseTo(0.18, 5);
    expect(markGap).toBeCloseTo(0.05, 5);
  });

  test("a tight grid scales the marks down proportionally", () => {
    // Grid nearly fills the page → little slack → marks shrink, gap floor 0.05.
    const { markLen, markGap } = markDimsForGrid(8.4, 10.9, 8.5, 11);
    expect(markLen).toBeLessThan(0.18);
    expect(markGap).toBeLessThan(0.05);
    // Length:gap ratio is preserved by the shared scale factor.
    expect(markLen / markGap).toBeCloseTo(0.18 / 0.05, 5);
  });
});

describe("cropMarkLayout", () => {
  test("grid size includes inter-card gaps", () => {
    const l = cropMarkLayout(3, 3, 8.5, 11, CARD_GAP_IN);
    expect(l.gridW).toBeCloseTo(3 * CARD_W_IN + 2 * CARD_GAP_IN, 6);
    expect(l.gridH).toBeCloseTo(3 * CARD_H_IN + 2 * CARD_GAP_IN, 6);
  });

  test("svg viewport pads the grid by `pad` on every side", () => {
    const l = cropMarkLayout(3, 3, 8.5, 11);
    expect(l.svgW).toBeCloseTo(l.gridW + l.pad * 2, 6);
    expect(l.svgH).toBeCloseTo(l.gridH + l.pad * 2, 6);
  });

  test("a 1×1 page draws only the four corner Ls (8 segments, no ticks)", () => {
    const l = cropMarkLayout(1, 1, 8.5, 11);
    // 4 corners × 2 legs = 8 lines; no internal gaps so no ticks.
    expect(l.lines).toHaveLength(8);
  });

  test("internal tick count matches the gaps between cards", () => {
    // 3×3 → corners(8) + vertical gaps(2 cols→2 gaps × top&bottom = 4)
    //              + horizontal gaps(2 rows→2 gaps × left&right = 4) = 16.
    const l = cropMarkLayout(3, 3, 8.5, 11);
    expect(l.lines).toHaveLength(8 + 4 + 4);
  });

  test("internal ticks land in the center of the inter-card gap", () => {
    const l = cropMarkLayout(2, 1, 8.5, 11, CARD_GAP_IN);
    // The one vertical gap is between col 0 and col 1.
    const expectedX = CARD_W_IN + 0.5 * CARD_GAP_IN;
    const topTick = l.lines.find(
      (ln) => Math.abs(ln.x1 - expectedX) < 1e-9 && ln.y1 < 0,
    );
    expect(topTick).toBeDefined();
    expect(topTick!.x2).toBeCloseTo(expectedX, 9);
  });

  test("zero gap puts ticks exactly on the shared card edge", () => {
    const l = cropMarkLayout(2, 1, 8.5, 11, 0);
    expect(l.gridW).toBeCloseTo(2 * CARD_W_IN, 6);
    // The internal tick sits at the shared edge (x = CARD_W_IN); corner legs
    // live at x = 0 and x = gridW, so match the interior x specifically.
    const tick = l.lines.find(
      (ln) => ln.y1 < 0 && Math.abs(ln.x1 - CARD_W_IN) < 1e-9,
    );
    expect(tick).toBeDefined();
  });
});
