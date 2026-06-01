export type PrintPaper = "letter" | "super-b";
export type PrintOrientation = "portrait" | "landscape";

/** Printable card sizes. "standard" is the regulation 2.5"×3.5"; "jumbo" is the
 *  oversized promo size (132mm × 185mm), printed one-per-page. */
export type CardSize = "standard" | "jumbo";

const MM_PER_IN = 25.4;

export const CARD_DIMS_IN: Record<CardSize, { w: number; h: number }> = {
  standard: { w: 2.5, h: 3.5 },
  jumbo: { w: 132 / MM_PER_IN, h: 185 / MM_PER_IN },
};

// Back-compat aliases for the regulation card size (most callers).
export const CARD_W_IN = CARD_DIMS_IN.standard.w;
export const CARD_H_IN = CARD_DIMS_IN.standard.h;

const PAPER_SIZES_IN: Record<PrintPaper, { w: number; h: number }> = {
  letter: { w: 8.5, h: 11 },
  "super-b": { w: 13, h: 19 },
};

const PAGE_MARGIN_IN = 0.25;

export interface PrintGrid {
  cols: number;
  rows: number;
  cardsPerSheet: number;
  pageW: number;
  pageH: number;
  usableW: number;
  usableH: number;
}

export function gridForPaper(
  paper: PrintPaper,
  orientation: PrintOrientation,
  size: CardSize = "standard",
): PrintGrid {
  const sheet = PAPER_SIZES_IN[paper];
  const card = CARD_DIMS_IN[size];
  const pageW = orientation === "landscape" ? sheet.h : sheet.w;
  const pageH = orientation === "landscape" ? sheet.w : sheet.h;
  const usableW = pageW - PAGE_MARGIN_IN * 2;
  const usableH = pageH - PAGE_MARGIN_IN * 2;
  const cols = Math.max(1, Math.floor(usableW / card.w));
  const rows = Math.max(1, Math.floor(usableH / card.h));
  return { cols, rows, cardsPerSheet: cols * rows, pageW, pageH, usableW, usableH };
}
