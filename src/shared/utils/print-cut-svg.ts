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
}

export interface CutSvg {
  svg: string;
  /** Bounding box of all cuts, mm. Design Space shows this as the import size. */
  widthMm: number;
  heightMm: number;
  /** Where to place the group's top-left on the mat, mm from the mat corner. */
  originMm: number;
  cutCount: number;
}

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

  const widthMm = opts.cols * cardW + (opts.cols - 1) * gap;
  const heightMm = opts.rows * cardH + (opts.rows - 1) * gap;

  const subpaths: string[] = [];
  for (let row = 0; row < opts.rows; row++) {
    for (let col = 0; col < opts.cols; col++) {
      subpaths.push(roundedRectPath(col * (cardW + gap), row * (cardH + gap), cardW, cardH, r));
    }
  }

  const desc =
    `Cricut cut file: ${opts.cols}x${opts.rows} cards, ${fmt(cardW)}x${fmt(cardH)}mm, ` +
    `${gap > 0 ? `${fmt(gap)}mm gap` : "flush"}, ${fmt(r)}mm corners. ` +
    `Place the group's top-left at X ${fmt(originMm)}mm, Y ${fmt(originMm)}mm on the mat ` +
    `with the paper in the mat corner. Expected size ${fmt(widthMm)} x ${fmt(heightMm)}mm.`;

  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(widthMm)}mm" height="${fmt(heightMm)}mm" ` +
    `viewBox="0 0 ${fmt(widthMm)} ${fmt(heightMm)}">\n` +
    `  <desc>${desc}</desc>\n` +
    `  <path fill="none" stroke="#000" stroke-width="0.1" d="${subpaths.join(" ")}"/>\n` +
    `</svg>\n`;

  return { svg, widthMm, heightMm, originMm, cutCount: subpaths.length };
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
