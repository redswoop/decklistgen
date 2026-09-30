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
 * Everything is a profile. Letter is the measured one. Super-B (13 × 19) is not
 * a Design Space size at all: it carries the Letter raster twice, one per half,
 * so the sheet is cut in two across its length and each 13 × 9.5 in half goes
 * through the Cricut as if it were a Letter page. Each region is turned so the
 * Letter page's top-left corner is a factory corner of the big sheet (top-right
 * and bottom-left in the portrait feed; top-left and bottom-right seen
 * landscape), a half turn apart. A half is longer than Letter, so nothing sits
 * near the printer's dead zone and the raster is not lifted.
 */

import type { PrintPaper } from "./print-grid.js";

const PT_PER_IN = 72;
const MM_PER_IN = 25.4;

/**
 * One copy of Design Space's sheet on the printed page: the sheet turned
 * `rotate` degrees clockwise, its bounding box placed at `leftPt`/`topPt`.
 */
export interface CricutRegion {
  rotate: 0 | 90 | 180 | 270;
  leftPt: number;
  topPt: number;
}

export interface CricutLayout {
  id: "letter-6up" | "super-b-12up";
  paper: PrintPaper;
  /** The Design Space sheet every region reproduces; names the cut fixture. */
  sheetId: "letter-6up";
  dpi: number;
  /** Printed page size, pt. */
  pageWPt: number;
  pageHPt: number;
  /** The page Design Space believes it is cutting (one region), pt. */
  sheetWPt: number;
  sheetHPt: number;
  /** Where each copy of that page sits on the printed page. */
  regions: CricutRegion[];
  /** Printed guide for cutting the page into its regions: distance from the page top, pt. */
  cutLineTopPt: number | null;
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
  paper: "letter",
  sheetId: "letter-6up",
  dpi: 300,
  pageWPt: 612,
  pageHPt: 792,
  sheetWPt: 612,
  sheetHPt: 792,
  regions: [{ rotate: 0, leftPt: 0, topPt: 0 }],
  cutLineTopPt: null,
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

/**
 * 13 × 19 in, fed short edge first: two Letter regions a half turn apart, each
 * with the Letter page's top-left on a factory corner. Cut the sheet in half at
 * 9.5 in and cut each half with the Letter fixture.
 */
export const CRICUT_SUPER_B_12UP: CricutLayout = {
  ...CRICUT_LETTER_6UP,
  id: "super-b-12up",
  paper: "super-b",
  pageWPt: 936,
  pageHPt: 1368,
  regions: [
    { rotate: 90, leftPt: 936 - 792, topPt: 0 },
    { rotate: 270, leftPt: 0, topPt: 1368 - 612 },
  ],
  cutLineTopPt: 1368 / 2,
  liftMm: 0,
};

export const CRICUT_LAYOUT = CRICUT_LETTER_6UP;

export function cricutLayoutForPaper(paper: PrintPaper): CricutLayout {
  return paper === "super-b" ? CRICUT_SUPER_B_12UP : CRICUT_LETTER_6UP;
}

/** Cards in one region: what Design Space cuts in one pass. */
export function cricutCardsPerRegion(layout: CricutLayout = CRICUT_LAYOUT): number {
  return layout.cols * layout.rows;
}

/** Cards on one printed page, all regions. */
export function cricutCardsPerSheet(layout: CricutLayout = CRICUT_LAYOUT): number {
  return cricutCardsPerRegion(layout) * layout.regions.length;
}

/** The lift to use: what the URL asked for, else the profile's own. */
export function cricutLiftMm(requested: number | null, layout: CricutLayout = CRICUT_LAYOUT): number {
  return requested ?? layout.liftMm;
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

/** Raster-space origin of slot `i` (row-major within its region), px. */
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

/** Where the raster sits on Design Space's sheet (one region) after the lift, inches. */
export function cricutRasterBox(liftMm: number, layout: CricutLayout = CRICUT_LAYOUT): CricutPageBox {
  const liftPt = (liftMm / MM_PER_IN) * PT_PER_IN;
  return {
    leftIn: layout.rasterLeftPt / PT_PER_IN,
    topIn: (layout.rasterTopPt - liftPt) / PT_PER_IN,
    widthIn: layout.rasterW / layout.dpi,
    heightIn: layout.rasterH / layout.dpi,
  };
}

/** Box of slot `i` on Design Space's sheet (one region) after the lift, inches. */
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

/** Distance from the raster's lower marks to the bottom edge of Design Space's sheet, mm. */
export function cricutBottomClearanceMm(liftMm: number, layout: CricutLayout = CRICUT_LAYOUT): number {
  const box = cricutRasterBox(liftMm, layout);
  const bottomIn = layout.sheetHPt / PT_PER_IN - (box.topIn + box.heightIn);
  return bottomIn * MM_PER_IN;
}

/**
 * CSS transform (origin top left) that carries a sheet-sized box from the
 * page's top-left corner into its region.
 */
export function cricutRegionTransform(region: CricutRegion, layout: CricutLayout = CRICUT_LAYOUT): string {
  const turned = region.rotate === 90 || region.rotate === 270;
  const boxW = turned ? layout.sheetHPt : layout.sheetWPt;
  const boxH = turned ? layout.sheetWPt : layout.sheetHPt;
  const dx = region.leftPt + (region.rotate === 90 || region.rotate === 180 ? boxW : 0);
  const dy = region.topPt + (region.rotate === 180 || region.rotate === 270 ? boxH : 0);
  return `translate(${dx / PT_PER_IN}in, ${dy / PT_PER_IN}in) rotate(${region.rotate}deg)`;
}

/** Stroke of the printed cut guide: heavy enough to follow with a trimmer. */
export const CRICUT_CUT_LINE = { widthPt: 1.5, dashPt: [12, 6] as [number, number] };

/** The printed cut guide across the page, PDF coordinates (origin bottom-left), or null. */
export function cricutCutLine(layout: CricutLayout = CRICUT_LAYOUT) {
  if (layout.cutLineTopPt === null) return null;
  const y = layout.pageHPt - layout.cutLineTopPt;
  return { x1: 0, y1: y, x2: layout.pageWPt, y2: y, ...CRICUT_CUT_LINE };
}

/** PDF `cm` operands placing an image's unit square. */
export type CricutPdfMatrix = [number, number, number, number, number, number];

/**
 * PDF placement of one region's raster image: for an unturned region
 * `w 0 0 h x bottom cm`, otherwise the same box turned with its region, pt.
 */
export function cricutPdfMatrix(region: CricutRegion, liftMm: number, layout: CricutLayout = CRICUT_LAYOUT): CricutPdfMatrix {
  const liftPt = (liftMm / MM_PER_IN) * PT_PER_IN;
  const w = (layout.rasterW / layout.dpi) * PT_PER_IN;
  const h = (layout.rasterH / layout.dpi) * PT_PER_IN;
  const x0 = layout.rasterLeftPt;
  const y0 = layout.rasterTopPt - liftPt;
  const { leftPt: L, topPt: T } = region;
  const H = layout.pageHPt;
  switch (region.rotate) {
    case 0:
      return [w, 0, 0, h, L + x0, H - T - y0 - h];
    case 90:
      return [0, -w, h, 0, L + layout.sheetHPt - y0 - h, H - T - x0];
    case 180:
      return [-w, 0, 0, -h, L + layout.sheetWPt - x0, H - T - layout.sheetHPt + y0 + h];
    case 270:
      return [0, w, -h, 0, L + y0 + h, H - T - layout.sheetWPt + x0];
  }
}

/** Split a flat entry list into printed pages. */
export function cricutPages<T>(entries: T[], layout: CricutLayout = CRICUT_LAYOUT): T[][] {
  const per = cricutCardsPerSheet(layout);
  const out: T[][] = [];
  for (let i = 0; i < entries.length; i += per) out.push(entries.slice(i, i + per));
  return out;
}

/** Split one page's entries across its regions, in order; regions left empty are dropped. */
export function cricutPageRegions<T>(cells: T[], layout: CricutLayout = CRICUT_LAYOUT): { region: CricutRegion; cells: T[]; start: number }[] {
  const per = cricutCardsPerRegion(layout);
  return layout.regions
    .map((region, r) => ({ region, cells: cells.slice(r * per, (r + 1) * per), start: r * per }))
    .filter((r) => r.cells.length > 0);
}

export function cricutPdfFilename(label: string | null | undefined, liftMm: number, layout: CricutLayout = CRICUT_LAYOUT): string {
  const who = slug(label ?? "") || "cards";
  return `cricut-ptc-${layout.id}-${who}-up${trim(liftMm)}mm.pdf`;
}

export function cricutFixtureFilename(layout: CricutLayout = CRICUT_LAYOUT): string {
  const cm = cricutSheetCm(layout);
  return `cricut-${layout.sheetId}-cut-fixture-${cm.w}x${cm.h}cm.png`;
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
