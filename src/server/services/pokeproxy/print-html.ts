/**
 * Generates a printable HTML page from SVG or image card content.
 */

import {
  CARD_H_IN,
  CARD_W_IN,
  gridForPaper,
  type PrintOrientation,
  type PrintPaper,
} from "../../../shared/utils/print-grid.js";

export type { PrintOrientation, PrintPaper };

export interface PrintHtmlOptions {
  paper?: PrintPaper;
  orientation?: PrintOrientation;
}

const MARK_LEN_IN = 0.18;
const MARK_GAP_IN = 0.05;
const MARK_STROKE_IN = 0.005;
const MARK_SAFETY_IN = 0.08;
const MARK_MIN_PAD_IN = 0.05;
// 0.5mm gap between cards. Ticks fall in the center, so one cut splits two
// adjacent cards (each loses 0.25mm of border — visually nothing).
const CARD_GAP_IN = 0.5 / 25.4;

function pageGridShape(cardCount: number, cols: number, rows: number): { cols: number; rows: number } {
  if (cardCount >= cols * rows) return { cols, rows };
  if (cardCount <= 0) return { cols: 1, rows: 1 };
  if (cardCount <= cols) return { cols: cardCount, rows: 1 };
  return { cols, rows: Math.ceil(cardCount / cols) };
}

function renderCropMarks(
  cols: number,
  rows: number,
  markLen: number,
  markGap: number,
  cardGap: number,
): string {
  const W = cols * CARD_W_IN + (cols - 1) * cardGap;
  const H = rows * CARD_H_IN + (rows - 1) * cardGap;
  const PAD = markLen + markGap;
  const lines: string[] = [];

  const line = (x1: number, y1: number, x2: number, y2: number) =>
    lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);

  const corners: Array<[number, number, number, number]> = [
    [0, 0, -1, -1],
    [W, 0, 1, -1],
    [0, H, -1, 1],
    [W, H, 1, 1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    line(cx + dx * markGap, cy, cx + dx * PAD, cy);
    line(cx, cy + dy * markGap, cx, cy + dy * PAD);
  }

  // Internal ticks land in the CENTER of each inter-card gap.
  for (let c = 1; c < cols; c++) {
    const x = c * CARD_W_IN + (c - 0.5) * cardGap;
    line(x, -markGap, x, -PAD);
    line(x, H + markGap, x, H + PAD);
  }

  for (let r = 1; r < rows; r++) {
    const y = r * CARD_H_IN + (r - 0.5) * cardGap;
    line(-markGap, y, -PAD, y);
    line(W + markGap, y, W + PAD, y);
  }

  const svgW = W + PAD * 2;
  const svgH = H + PAD * 2;
  return `<svg class="crop-marks" width="${svgW}in" height="${svgH}in" viewBox="${-PAD} ${-PAD} ${svgW} ${svgH}"><g stroke="#000" stroke-width="${MARK_STROKE_IN}" fill="none" shape-rendering="crispEdges">${lines.join("")}</g></svg>`;
}

function markDimsForGrid(ugw: number, ugh: number, pageW: number, pageH: number) {
  const slackX = (pageW - ugw) / 2;
  const slackY = (pageH - ugh) / 2;
  const maxPad = Math.max(MARK_MIN_PAD_IN, Math.min(slackX, slackY) - MARK_SAFETY_IN);
  const desiredPad = MARK_LEN_IN + MARK_GAP_IN;
  const scale = Math.min(1, maxPad / desiredPad);
  return {
    markLen: MARK_LEN_IN * scale,
    markGap: MARK_GAP_IN * scale,
  };
}

export function generatePrintHtml(
  cards: [number, string][],
  options: PrintHtmlOptions = {},
): string {
  const paper = options.paper ?? "letter";
  const orientation = options.orientation ?? "portrait";
  const { cols, rows, cardsPerSheet, pageW, pageH } = gridForPaper(paper, orientation);
  const pageSize = `${pageW}in ${pageH}in`;

  const flat: string[] = [];
  for (const [count, content] of cards) {
    const clean = content.replace(/<\?xml[^?]*\?>\s*/g, "");
    for (let i = 0; i < count; i++) flat.push(clean);
  }

  const pages: string[][] = [];
  if (flat.length === 0) {
    pages.push([]);
  } else {
    for (let i = 0; i < flat.length; i += cardsPerSheet) {
      pages.push(flat.slice(i, i + cardsPerSheet));
    }
  }

  const parts: string[] = [];
  parts.push(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>PokeProxy - Print Sheet</title>
<style>
  @page { size: ${pageSize}; margin: 0; }
  html, body { margin: 0; padding: 0; }
  .page {
    width: ${pageW}in;
    height: ${pageH}in;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    page-break-after: always;
    overflow: hidden;
  }
  .page:last-child { page-break-after: auto; }
  .card-grid { display: grid; gap: ${CARD_GAP_IN}in; }
  .card {
    width: ${CARD_W_IN}in;
    height: ${CARD_H_IN}in;
    page-break-inside: avoid;
    overflow: hidden;
  }
  .card svg,
  .card img {
    width: 100%;
    height: 100%;
  }
  .card img {
    object-fit: fill;
    display: block;
  }
  .crop-marks {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
</style>
</head>
<body>
`);

  for (const pageCards of pages) {
    const used = pageGridShape(pageCards.length, cols, rows);
    const ugw = used.cols * CARD_W_IN + (used.cols - 1) * CARD_GAP_IN;
    const ugh = used.rows * CARD_H_IN + (used.rows - 1) * CARD_GAP_IN;
    const { markLen, markGap } = markDimsForGrid(ugw, ugh, pageW, pageH);
    const cropMarksSvg = renderCropMarks(used.cols, used.rows, markLen, markGap, CARD_GAP_IN);

    parts.push(
      `<div class="page">\n` +
        `<div class="card-grid" style="grid-template-columns: repeat(${used.cols}, ${CARD_W_IN}in); grid-template-rows: repeat(${used.rows}, ${CARD_H_IN}in); width: ${ugw}in; height: ${ugh}in;">\n`,
    );
    for (const svgClean of pageCards) {
      parts.push(`<div class="card">${svgClean}</div>\n`);
    }
    parts.push(`</div>\n${cropMarksSvg}\n</div>\n`);
  }

  parts.push(`</body>
</html>
`);
  return parts.join("");
}
