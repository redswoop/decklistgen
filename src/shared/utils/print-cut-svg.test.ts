import { describe, expect, test } from "bun:test";
import {
  cutSvgForGrid,
  cutSvgFilename,
  solveCutCorrection,
  CARD_CORNER_RADIUS_MM,
  ANCHOR_MM,
} from "./print-cut-svg.js";
import { CARD_GAP_IN } from "./print-crop-marks.js";
import { PAGE_MARGIN_IN } from "./print-grid.js";

const flush = () => cutSvgForGrid({ cols: 3, rows: 3, gap: 0, originIn: PAGE_MARGIN_IN });

describe("cutSvgForGrid", () => {
  test("flush letter 3x3 is 189x261mm with nine cuts placed at 6.35mm", () => {
    const c = flush();
    expect(c.widthMm).toBeCloseTo(189, 6);
    expect(c.heightMm).toBeCloseTo(261, 6);
    expect(c.originMm).toBeCloseTo(6.35, 6);
    expect(c.cutCount).toBe(9);
  });

  test("emits ONE compound path so Design Space keeps the grid together", () => {
    const { svg } = flush();
    expect(svg.match(/<path/g)?.length).toBe(1);
    expect(svg.match(/<rect/g)).toBeNull();
    // Nine closed subpaths inside it.
    expect(svg.match(/Z/g)?.length).toBe(9);
  });

  test("declares mm units with a matching viewBox", () => {
    const { svg } = flush();
    expect(svg).toContain('width="189mm"');
    expect(svg).toContain('height="261mm"');
    expect(svg).toContain('viewBox="0 0 189 261"');
  });

  test("second card starts exactly one card width over when flush", () => {
    const { svg } = flush();
    // Subpath 2 starts at x = 63 + corner radius, y = 0.
    expect(svg).toContain(`M${63 + CARD_CORNER_RADIUS_MM} 0`);
    // Row 2 starts at y = 87.
    expect(svg).toContain(`M${CARD_CORNER_RADIUS_MM} 87`);
  });

  test("honours the crop-mark gap so the cut file matches a marked print", () => {
    const c = cutSvgForGrid({ cols: 3, rows: 3, gap: CARD_GAP_IN, originIn: PAGE_MARGIN_IN });
    const gapMm = CARD_GAP_IN * 25.4;
    expect(c.widthMm).toBeCloseTo(189 + 2 * gapMm, 6);
    expect(c.heightMm).toBeCloseTo(261 + 2 * gapMm, 6);
    expect(c.svg).toContain(`M${(63 + gapMm + CARD_CORNER_RADIUS_MM).toFixed(3).replace(/\.?0+$/, "")} 0`);
  });

  test("rounds corners at the real-card radius by default", () => {
    const { svg } = flush();
    expect(svg).toContain(`a${CARD_CORNER_RADIUS_MM} ${CARD_CORNER_RADIUS_MM} 0 0 1`);
    const sharp = cutSvgForGrid({ cols: 1, rows: 1, gap: 0, originIn: 0, cornerRadiusMm: 0 });
    const d = sharp.svg.match(/ d="([^"]*)"/)![1];
    expect(d).not.toContain("a");
    expect(d).toBe("M0 0 h63 v87 h-63 Z");
  });

  test("writes the mat placement into <desc> for the human", () => {
    const { svg } = flush();
    expect(svg).toMatch(/<desc>.*X 6.35mm, Y 6.35mm.*189 x 261mm.*<\/desc>/);
  });
});

describe("cutSvgFilename", () => {
  test("encodes paper, grid, card size and spacing", () => {
    expect(cutSvgFilename({ paper: "letter", orientation: "portrait", cols: 3, rows: 3, gap: 0 }))
      .toBe("cut-letter-portrait-3x3-63x87mm-flush.svg");
    expect(cutSvgFilename({ paper: "letter", orientation: "portrait", cols: 3, rows: 3, gap: CARD_GAP_IN }))
      .toBe("cut-letter-portrait-3x3-63x87mm-cropgap.svg");
  });
});

describe("cut calibration", () => {
  // Armen's test cut, 2026-09-23: card 1 landed 2.85mm up/left of the ink and
  // every card came out 62.21mm wide (1.25% small) even though Design Space
  // reported the import at the right size.
  const ink = { originMm: 6.35, widthMm: 189, heightMm: 261 };
  const measured = {
    firstLeft: 3.5,
    lastRight: 3.5 + 189 * 0.9875,
    firstTop: 3.5,
    lastBottom: 3.5 + 261 * 0.9875,
  };

  test("solves per-axis scale and the corner the cutter really uses", () => {
    const c = solveCutCorrection(measured, ink);
    expect(c.scaleX).toBeCloseTo(0.9875, 6);
    expect(c.scaleY).toBeCloseTo(0.9875, 6);
    expect(c.cornerX).toBe(3.5);
    expect(c.cornerY).toBe(3.5);
  });

  test("a perfect test cut is the identity: no anchor, same file", () => {
    const c = solveCutCorrection(
      { firstLeft: 6.35, lastRight: 195.35, firstTop: 6.35, lastBottom: 267.35 },
      ink,
    );
    const plain = flush();
    const corrected = cutSvgForGrid({ cols: 3, rows: 3, gap: 0, originIn: 6.35 / 25.4, correction: c });
    expect(corrected.anchored).toBe(false);
    expect(corrected.widthMm).toBeCloseTo(plain.widthMm, 6);
    expect(corrected.svg.match(/Z/g)?.length).toBe(9);
  });

  test("corrected file pre-distorts so the blade lands on the ink", () => {
    const c = solveCutCorrection(measured, ink);
    const out = cutSvgForGrid({ cols: 3, rows: 3, gap: 0, originIn: 6.35 / 25.4, correction: c });
    expect(out.anchored).toBe(true);
    expect(out.warning).toBeNull();
    expect(out.cutCount).toBe(9);
    // 9 cards + 1 anchor.
    expect(out.svg.match(/Z/g)?.length).toBe(10);
    // Anchor is the bbox corner, sized so it cuts ANCHOR_MM on paper.
    expect(out.svg).toContain(`M0 0 h${(ANCHOR_MM / 0.9875).toFixed(3).replace(/\.?0+$/, "")}`);

    // Simulate the cutter: paper = corner + scale × design. Card 1's left edge
    // should land at 6.35 and the last card's right edge at 195.35.
    const d = out.svg.match(/ d="([^"]*)"/)![1];
    const firstCard = d.split(" Z ")[1]; // subpath after the anchor
    const mx = Number(firstCard.match(/^M([\d.]+) /)![1]) - CARD_CORNER_RADIUS_MM / 0.9875;
    expect(3.5 + 0.9875 * mx).toBeCloseTo(6.35, 3);
    expect(3.5 + 0.9875 * out.widthMm).toBeCloseTo(195.35, 3);
    expect(3.5 + 0.9875 * out.heightMm).toBeCloseTo(267.35, 3);
  });

  test("warns when the cutter drops the corner past the ink (anchor can't help)", () => {
    const c = solveCutCorrection(
      { firstLeft: 8, lastRight: 197, firstTop: 8, lastBottom: 269 },
      ink,
    );
    const out = cutSvgForGrid({ cols: 3, rows: 3, gap: 0, originIn: 6.35 / 25.4, correction: c });
    expect(out.warning).toMatch(/past the print origin/);
    expect(out.anchored).toBe(false);
  });
});
