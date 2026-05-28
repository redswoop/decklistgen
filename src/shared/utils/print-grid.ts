export type PrintPaper = "letter" | "super-b";
export type PrintOrientation = "portrait" | "landscape";

export const CARD_W_IN = 2.5;
export const CARD_H_IN = 3.5;

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

export function gridForPaper(paper: PrintPaper, orientation: PrintOrientation): PrintGrid {
  const sheet = PAPER_SIZES_IN[paper];
  const pageW = orientation === "landscape" ? sheet.h : sheet.w;
  const pageH = orientation === "landscape" ? sheet.w : sheet.h;
  const usableW = pageW - PAGE_MARGIN_IN * 2;
  const usableH = pageH - PAGE_MARGIN_IN * 2;
  const cols = Math.max(1, Math.floor(usableW / CARD_W_IN));
  const rows = Math.max(1, Math.floor(usableH / CARD_H_IN));
  return { cols, rows, cardsPerSheet: cols * rows, pageW, pageH, usableW, usableH };
}
