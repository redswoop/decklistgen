/**
 * Cricut Design Space "Print Then Cut" done without Design Space printing.
 *
 * Design Space prints a Letter Print Then Cut job as ONE 300 dpi raster,
 * 2209 × 3080 px, placed 36 pt from the left and 40 pt from the top of the page
 * (`530.16 0 0 739.2 36 12.8 cm`). Its four registration marks are 300 × 300 px
 * blocks in the raster's corners, and an uploaded sheet lands at a fixed raster
 * offset with no resampling. All of this was measured from a real Design Space
 * print (2026-09-25, see PRINT_SHEET.md) and is reproduced here pixel for pixel:
 * we draw the same raster with our own cards, lift it a few mm so the lower
 * marks clear the printer's bottom dead zone, and hand the printer a lossless
 * PDF. Design Space is only used for the cut, with a one-time fixture image the
 * same size as the sheet, so the cut job is identical for every printed page.
 *
 * Letter only for now. Everything is a profile so A3 can follow once measured.
 */

const PT_PER_IN = 72;
const MM_PER_IN = 25.4;

export interface CricutLayout {
  id: "letter-6up";
  dpi: number;
  /** Page size, pt. */
  pageWPt: number;
  pageHPt: number;
  /** Design Space's print raster, px. */
  rasterW: number;
  rasterH: number;
  /** Where Design Space places the raster on the page: left edge and top edge, pt. */
  rasterLeftPt: number;
  rasterTopPt: number;
  /** Registration mark blocks in the raster corners, px. */
  markPx: number;
  /** Pixel-exact copy of Design Space's marks, transparent elsewhere, raster-sized. */
  marksAsset: string;
  /** Where the uploaded sheet lands inside the raster, px. */
  sheetX: number;
  sheetY: number;
  cols: number;
  rows: number;
  /** One card slot (landscape), px. */
  cardW: number;
  cardH: number;
  /** Gutter between slots, px. */
  gap: number;
  /** Bleed ring drawn around each card, px (Design Space uses 8–10). */
  bleed: number;
  /** Default lift of the whole raster up the page, mm. */
  liftMm: number;
  /** Card corner radius, mm. */
  cornerMm: number;
}

export const CRICUT_LETTER_6UP: CricutLayout = {
  id: "letter-6up",
  dpi: 300,
  pageWPt: 612,
  pageHPt: 792,
  rasterW: 2209,
  rasterH: 3080,
  rasterLeftPt: 36,
  rasterTopPt: 40,
  markPx: 300,
  marksAsset: "/cricut/ds-marks-letter.png",
  sheetX: 0,
  sheetY: 377,
  cols: 2,
  rows: 3,
  cardW: 1028,
  cardH: 744,
  gap: 47,
  bleed: 10,
  liftMm: 8,
  cornerMm: 3,
};

export const CRICUT_LAYOUT = CRICUT_LETTER_6UP;

export function cricutCardsPerSheet(layout: CricutLayout = CRICUT_LAYOUT): number {
  return layout.cols * layout.rows;
}

/** The sheet Design Space must hold (the upload / fixture), px. */
export function cricutSheetPx(layout: CricutLayout = CRICUT_LAYOUT): { w: number; h: number } {
  return {
    w: layout.cols * layout.cardW + (layout.cols - 1) * layout.gap,
    h: layout.rows * layout.cardH + (layout.rows - 1) * layout.gap,
  };
}

/** The width/height to type into Design Space's Edit bar, cm, 2 decimals. */
export function cricutSheetCm(layout: CricutLayout = CRICUT_LAYOUT): { w: string; h: string } {
  const px = cricutSheetPx(layout);
  const cm = (p: number) => ((p / layout.dpi) * 2.54).toFixed(2);
  return { w: cm(px.w), h: cm(px.h) };
}

/** Raster-space origin of slot `i` (row-major), px. */
export function cricutSlotPx(i: number, layout: CricutLayout = CRICUT_LAYOUT): { x: number; y: number } {
  const c = i % layout.cols;
  const r = Math.floor(i / layout.cols);
  return {
    x: layout.sheetX + c * (layout.cardW + layout.gap),
    y: layout.sheetY + r * (layout.cardH + layout.gap),
  };
}

export interface CricutPageBox {
  leftIn: number;
  topIn: number;
  widthIn: number;
  heightIn: number;
}

/** Where the raster sits on the page after the lift, inches (for the preview and the PDF). */
export function cricutRasterBox(liftMm: number, layout: CricutLayout = CRICUT_LAYOUT): CricutPageBox {
  const liftPt = (liftMm / MM_PER_IN) * PT_PER_IN;
  return {
    leftIn: layout.rasterLeftPt / PT_PER_IN,
    topIn: (layout.rasterTopPt - liftPt) / PT_PER_IN,
    widthIn: layout.rasterW / layout.dpi,
    heightIn: layout.rasterH / layout.dpi,
  };
}

/** Page-space box of slot `i` after the lift, inches. */
export function cricutSlotBox(i: number, liftMm: number, layout: CricutLayout = CRICUT_LAYOUT): CricutPageBox {
  const raster = cricutRasterBox(liftMm, layout);
  const px = cricutSlotPx(i, layout);
  return {
    leftIn: raster.leftIn + px.x / layout.dpi,
    topIn: raster.topIn + px.y / layout.dpi,
    widthIn: layout.cardW / layout.dpi,
    heightIn: layout.cardH / layout.dpi,
  };
}

/** Distance from the raster's lower marks to the paper's bottom edge, mm. */
export function cricutBottomClearanceMm(liftMm: number, layout: CricutLayout = CRICUT_LAYOUT): number {
  const box = cricutRasterBox(liftMm, layout);
  const bottomIn = layout.pageHPt / PT_PER_IN - (box.topIn + box.heightIn);
  return bottomIn * MM_PER_IN;
}

/** PDF placement of the raster image: `w 0 0 h x bottom cm`, pt. */
export function cricutPdfPlacement(liftMm: number, layout: CricutLayout = CRICUT_LAYOUT) {
  const liftPt = (liftMm / MM_PER_IN) * PT_PER_IN;
  const wPt = (layout.rasterW / layout.dpi) * PT_PER_IN;
  const hPt = (layout.rasterH / layout.dpi) * PT_PER_IN;
  return {
    pageWPt: layout.pageWPt,
    pageHPt: layout.pageHPt,
    xPt: layout.rasterLeftPt,
    bottomPt: layout.pageHPt - layout.rasterTopPt - hPt + liftPt,
    wPt,
    hPt,
  };
}

/** Split a flat entry list into sheets of `cols × rows`. */
export function cricutPages<T>(entries: T[], layout: CricutLayout = CRICUT_LAYOUT): T[][] {
  const per = cricutCardsPerSheet(layout);
  const out: T[][] = [];
  for (let i = 0; i < entries.length; i += per) out.push(entries.slice(i, i + per));
  return out;
}

export function cricutPdfFilename(label: string | null | undefined, liftMm: number, layout: CricutLayout = CRICUT_LAYOUT): string {
  const who = slug(label ?? "") || "cards";
  return `cricut-ptc-${layout.id}-${who}-up${trim(liftMm)}mm.pdf`;
}

export function cricutFixtureFilename(layout: CricutLayout = CRICUT_LAYOUT): string {
  const cm = cricutSheetCm(layout);
  return `cricut-${layout.id}-cut-fixture-${cm.w}x${cm.h}cm.png`;
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

function slug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
