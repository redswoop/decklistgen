import { CARD_W_IN, CARD_H_IN } from "./print-grid.js";

/**
 * Crop / registration marks for the print sheet.
 *
 * Ported from the deleted server-side `print-html.ts` SVG renderer (the
 * SVG→CSS migration dropped the feature). Marks are L-shaped guides at the
 * four grid corners plus tick marks centered in every inter-card gap, so a
 * single straight cut splits two adjacent cards. All geometry is in inches,
 * expressed in a coordinate system whose origin is the grid's top-left corner.
 */

/** 0.5mm gap between cards; cut ticks fall in its center. */
export const CARD_GAP_IN = 0.5 / 25.4;

const MARK_LEN_IN = 0.18;
const MARK_GAP_IN = 0.05;
/** Stroke width of the mark lines, in inches. */
export const MARK_STROKE_IN = 0.005;
const MARK_SAFETY_IN = 0.08;
const MARK_MIN_PAD_IN = 0.05;

export interface CropLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface CropMarkLayout {
  lines: CropLine[];
  /** Distance from the grid edge to the mark tip (markLen + markGap). */
  pad: number;
  /** SVG viewport size in inches (grid + pad on every side). */
  svgW: number;
  svgH: number;
  /** Grid content size in inches (cards + inter-card gaps, no marks). */
  gridW: number;
  gridH: number;
  strokeIn: number;
}

/**
 * Shape of a partial last page: shrink the grid to the cards it actually holds
 * so it stays symmetrically centered (e.g. 6 cards on a 3×3 page → 3×2).
 */
export function pageGridShape(
  cardCount: number,
  cols: number,
  rows: number,
): { cols: number; rows: number } {
  if (cardCount >= cols * rows) return { cols, rows };
  if (cardCount <= 0) return { cols: 1, rows: 1 };
  if (cardCount <= cols) return { cols: cardCount, rows: 1 };
  return { cols, rows: Math.ceil(cardCount / cols) };
}

/**
 * Scale the marks down when the centered grid leaves little page slack, so the
 * marks always sit inside the printable area rather than off the sheet edge.
 */
export function markDimsForGrid(
  gridW: number,
  gridH: number,
  pageW: number,
  pageH: number,
): { markLen: number; markGap: number } {
  const slackX = (pageW - gridW) / 2;
  const slackY = (pageH - gridH) / 2;
  const maxPad = Math.max(MARK_MIN_PAD_IN, Math.min(slackX, slackY) - MARK_SAFETY_IN);
  const desiredPad = MARK_LEN_IN + MARK_GAP_IN;
  const scale = Math.min(1, maxPad / desiredPad);
  return { markLen: MARK_LEN_IN * scale, markGap: MARK_GAP_IN * scale };
}

/**
 * Build the crop-mark geometry for one page's grid. `cardGap` is the gap (in
 * inches) between cards; ticks are centered in it.
 */
export function cropMarkLayout(
  cols: number,
  rows: number,
  pageW: number,
  pageH: number,
  cardGap: number = CARD_GAP_IN,
): CropMarkLayout {
  const gridW = cols * CARD_W_IN + (cols - 1) * cardGap;
  const gridH = rows * CARD_H_IN + (rows - 1) * cardGap;
  const { markLen, markGap } = markDimsForGrid(gridW, gridH, pageW, pageH);
  const pad = markLen + markGap;

  const lines: CropLine[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    lines.push({ x1, y1, x2, y2 });

  // L-shaped marks at the four outer grid corners.
  const corners: Array<[number, number, number, number]> = [
    [0, 0, -1, -1],
    [gridW, 0, 1, -1],
    [0, gridH, -1, 1],
    [gridW, gridH, 1, 1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    line(cx + dx * markGap, cy, cx + dx * pad, cy); // horizontal leg
    line(cx, cy + dy * markGap, cx, cy + dy * pad); // vertical leg
  }

  // Internal ticks centered in each inter-card gap, on the top/bottom edges.
  for (let c = 1; c < cols; c++) {
    const x = c * CARD_W_IN + (c - 0.5) * cardGap;
    line(x, -markGap, x, -pad);
    line(x, gridH + markGap, x, gridH + pad);
  }
  // …and on the left/right edges.
  for (let r = 1; r < rows; r++) {
    const y = r * CARD_H_IN + (r - 0.5) * cardGap;
    line(-markGap, y, -pad, y);
    line(gridW + markGap, y, gridW + pad, y);
  }

  return {
    lines,
    pad,
    svgW: gridW + pad * 2,
    svgH: gridH + pad * 2,
    gridW,
    gridH,
    strokeIn: MARK_STROKE_IN,
  };
}
