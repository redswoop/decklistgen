import { CARD_W_IN, CARD_H_IN } from "./print-grid.js";

/**
 * Cricut cut file for a printed sheet.
 *
 * Emits one SVG whose single compound <path> holds one rounded-rect subpath
 * per card cell, in the exact geometry the print sheet lays out. One path (not
 * N rects) matters: Design Space auto-arranges loose shapes on the mat, but
 * keeps a compound path together and cuts every subpath.
 *
 * The SVG's canvas is the grid's bounding box, not the page, because Design
 * Space sizes an import by its path bbox and discards page space. Placement on
 * the mat is therefore an explicit step: put the group's top-left at the print
 * origin (0.25in / 6.35mm) with the paper in the mat corner. That value is
 * returned as `originMm` and written into the SVG's <desc> for the human.
 */

const MM_PER_IN = 25.4;

/** Corner radius of a real Pokémon card. Rounded corners are also what stops a
 *  freshly cut card from snagging on the sleeve mouth. */
export const CARD_CORNER_RADIUS_MM = 3;

/**
 * Measured result of a test cut, mm from the paper's edges. The user cuts an
 * uncorrected sheet, then calipers where the blade actually went:
 *   firstLeft / firstTop   — card 1's left / top cut edge
 *   lastRight / lastBottom — the last column's right / last row's bottom edge
 * Compared against where the ink is, this yields a per-axis scale and the spot
 * Design Space really drops the group's corner — whatever the machine, mat or
 * Design Space are doing between import and blade.
 */
export interface CutCalibration {
  firstLeft: number;
  lastRight: number;
  firstTop: number;
  lastBottom: number;
}

/** Linear model of the cut chain: paper = corner + scale × design. */
export interface CutCorrection {
  scaleX: number;
  scaleY: number;
  /** Where the group's bbox corner lands on the paper, mm. */
  cornerX: number;
  cornerY: number;
}

export interface CutSvgOptions {
  cols: number;
  rows: number;
  /** Gap between cards, inches (the crop-mark gap, or 0 for flush). */
  gap: number;
  /** Print origin from the sheet's top-left, inches. */
  originIn: number;
  cardW?: number;
  cardH?: number;
  cornerRadiusMm?: number;
  /** Pre-distort the file so the cut lands on the ink. See solveCutCorrection. */
  correction?: CutCorrection;
}

export interface CutSvg {
  svg: string;
  /** Bounding box of all cuts, mm. Design Space shows this as the import size. */
  widthMm: number;
  heightMm: number;
  /** Where to place the group's top-left on the mat, mm from the mat corner. */
  originMm: number;
  cutCount: number;
  /** True when an anchor hole was added so the bbox corner lands where Design
   *  Space drops it while the cards land on the ink. */
  anchored: boolean;
  /** Set when the correction can't be expressed (corner lands past the ink). */
  warning: string | null;
}

/** Side of the square anchor hole punched in the waste margin, mm. */
export const ANCHOR_MM = 1.5;
/** Below this the anchor buys nothing; the cards' own corner is close enough. */
const ANCHOR_MIN_MM = 0.15;

/**
 * Solve scale + corner from a test cut. `expected` is where the ink is: the
 * print origin and the full grid extent, mm.
 */
export function solveCutCorrection(
  cal: CutCalibration,
  expected: { originMm: number; widthMm: number; heightMm: number },
): CutCorrection {
  return {
    scaleX: (cal.lastRight - cal.firstLeft) / expected.widthMm,
    scaleY: (cal.lastBottom - cal.firstTop) / expected.heightMm,
    cornerX: cal.firstLeft,
    cornerY: cal.firstTop,
  };
}

export const IDENTITY_CORRECTION = (originMm: number): CutCorrection => ({
  scaleX: 1,
  scaleY: 1,
  cornerX: originMm,
  cornerY: originMm,
});

const mm = (inches: number) => inches * MM_PER_IN;
const fmt = (v: number) => v.toFixed(3).replace(/\.?0+$/, "");

/** One closed rounded-rect subpath, clockwise, starting after the top-left corner. */
function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  if (rr <= 0) return `M${fmt(x)} ${fmt(y)} h${fmt(w)} v${fmt(h)} h${fmt(-w)} Z`;
  const sw = w - 2 * rr;
  const sh = h - 2 * rr;
  return [
    `M${fmt(x + rr)} ${fmt(y)}`,
    `h${fmt(sw)}`,
    `a${fmt(rr)} ${fmt(rr)} 0 0 1 ${fmt(rr)} ${fmt(rr)}`,
    `v${fmt(sh)}`,
    `a${fmt(rr)} ${fmt(rr)} 0 0 1 ${fmt(-rr)} ${fmt(rr)}`,
    `h${fmt(-sw)}`,
    `a${fmt(rr)} ${fmt(rr)} 0 0 1 ${fmt(-rr)} ${fmt(-rr)}`,
    `v${fmt(-sh)}`,
    `a${fmt(rr)} ${fmt(rr)} 0 0 1 ${fmt(rr)} ${fmt(-rr)}`,
    "Z",
  ].join(" ");
}

export function cutSvgForGrid(opts: CutSvgOptions): CutSvg {
  const cardW = mm(opts.cardW ?? CARD_W_IN);
  const cardH = mm(opts.cardH ?? CARD_H_IN);
  const gap = mm(opts.gap);
  const r = opts.cornerRadiusMm ?? CARD_CORNER_RADIUS_MM;
  const originMm = mm(opts.originIn);
  const c = opts.correction ?? IDENTITY_CORRECTION(originMm);

  // Paper-space → design-space. Design (0,0) is the bbox corner, which the cut
  // chain drops at (cornerX, cornerY) on the paper and scales by (scaleX, scaleY).
  const dx = (paperX: number) => (paperX - c.cornerX) / c.scaleX;
  const dy = (paperY: number) => (paperY - c.cornerY) / c.scaleY;

  const inkW = opts.cols * cardW + (opts.cols - 1) * gap;
  const inkH = opts.rows * cardH + (opts.rows - 1) * gap;

  // Where card 1 must sit in design space so it lands on the ink.
  const firstX = dx(originMm);
  const firstY = dy(originMm);
  let warning: string | null = null;
  if (firstX < -ANCHOR_MIN_MM || firstY < -ANCHOR_MIN_MM) {
    warning =
      "The cutter drops the group past the print origin; a corner anchor can't pull it back. " +
      "Seat the paper further into the mat corner, or move the print origin outward.";
  }
  const anchored = !warning && (firstX > ANCHOR_MIN_MM || firstY > ANCHOR_MIN_MM);
  // Without an anchor the cards' own corner is the bbox corner; snap to 0.
  const baseX = anchored ? firstX : 0;
  const baseY = anchored ? firstY : 0;

  const subpaths: string[] = [];
  if (anchored) {
    // Tiny square hole in the waste margin: it IS the bbox corner. The cutter
    // drops it where it always drops the corner; the cards ride the offset.
    subpaths.push(`M0 0 h${fmt(ANCHOR_MM / c.scaleX)} v${fmt(ANCHOR_MM / c.scaleY)} h${fmt(-ANCHOR_MM / c.scaleX)} Z`);
  }
  const dW = cardW / c.scaleX;
  const dH = cardH / c.scaleY;
  const dGapX = gap / c.scaleX;
  const dGapY = gap / c.scaleY;
  for (let row = 0; row < opts.rows; row++) {
    for (let col = 0; col < opts.cols; col++) {
      subpaths.push(
        roundedRectPath(baseX + col * (dW + dGapX), baseY + row * (dH + dGapY), dW, dH, r / Math.min(c.scaleX, c.scaleY)),
      );
    }
  }

  const widthMm = baseX + inkW / c.scaleX;
  const heightMm = baseY + inkH / c.scaleY;

  const corrected = opts.correction
    ? ` Corrected for a cutter that lands the corner at ${fmt(c.cornerX)},${fmt(c.cornerY)}mm ` +
      `and scales ${fmt(c.scaleX)} x ${fmt(c.scaleY)}${anchored ? "; the small square is an alignment anchor, discard it" : ""}.`
    : "";
  const desc =
    `Cricut cut file: ${opts.cols}x${opts.rows} cards, ${fmt(cardW)}x${fmt(cardH)}mm on the paper, ` +
    `${gap > 0 ? `${fmt(gap)}mm gap` : "flush"}, ${fmt(r)}mm corners. ` +
    `Place the group's top-left at X ${fmt(originMm)}mm, Y ${fmt(originMm)}mm on the mat ` +
    `with the paper in the mat corner. Expected size ${fmt(widthMm)} x ${fmt(heightMm)}mm.` +
    corrected;

  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(widthMm)}mm" height="${fmt(heightMm)}mm" ` +
    `viewBox="0 0 ${fmt(widthMm)} ${fmt(heightMm)}">\n` +
    `  <desc>${desc}</desc>\n` +
    `  <path fill="none" stroke="#000" stroke-width="0.1" d="${subpaths.join(" ")}"/>\n` +
    `</svg>\n`;

  return {
    svg,
    widthMm,
    heightMm,
    originMm,
    cutCount: subpaths.length - (anchored ? 1 : 0),
    anchored,
    warning,
  };
}

/** Descriptive filename so a folder of cut files stays legible. */
export function cutSvgFilename(opts: {
  paper: string;
  orientation: string;
  cols: number;
  rows: number;
  gap: number;
  cardW?: number;
  cardH?: number;
}): string {
  const w = Math.round(mm(opts.cardW ?? CARD_W_IN));
  const h = Math.round(mm(opts.cardH ?? CARD_H_IN));
  const spacing = opts.gap > 0 ? "cropgap" : "flush";
  return `cut-${opts.paper}-${opts.orientation}-${opts.cols}x${opts.rows}-${w}x${h}mm-${spacing}.svg`;
}
