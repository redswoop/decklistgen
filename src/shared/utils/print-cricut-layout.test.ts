import { describe, expect, test } from "bun:test";
import {
  CRICUT_LETTER_6UP,
  cricutBottomClearanceMm,
  cricutCardsPerSheet,
  cricutFixtureFilename,
  cricutPages,
  cricutPdfFilename,
  cricutPdfPlacement,
  cricutRasterBox,
  cricutSheetCm,
  cricutSheetPx,
  cricutSlotBox,
  cricutSlotPx,
} from "./print-cricut-layout";

// Every expected number below was measured from a real Design Space Letter
// print (source/design-space-letter-6up-print.pdf in ~/Sync/cricut-ptc).

describe("Letter 6-up profile", () => {
  test("six landscape cards per sheet", () => {
    expect(cricutCardsPerSheet()).toBe(6);
  });

  test("the sheet Design Space holds is 2103 × 2326 px = 17.81 × 19.69 cm", () => {
    expect(cricutSheetPx()).toEqual({ w: 2103, h: 2326 });
    expect(cricutSheetCm()).toEqual({ w: "17.81", h: "19.69" });
  });

  test("slots land where Design Space put them: (0,377), 1075 px column pitch, 791 px row pitch", () => {
    expect(cricutSlotPx(0)).toEqual({ x: 0, y: 377 });
    expect(cricutSlotPx(1)).toEqual({ x: 1075, y: 377 });
    expect(cricutSlotPx(2)).toEqual({ x: 0, y: 1168 });
    expect(cricutSlotPx(5)).toEqual({ x: 1075, y: 1959 });
    // Last row ends inside the raster, above the lower marks.
    expect(1959 + CRICUT_LETTER_6UP.cardH).toBeLessThan(CRICUT_LETTER_6UP.rasterH - CRICUT_LETTER_6UP.markPx);
  });

  test("raster image is 530.16 × 739.2 pt at x 36, matching Design Space's cm operator", () => {
    const p = cricutPdfPlacement(0);
    expect(p.wPt).toBeCloseTo(530.16, 6);
    expect(p.hPt).toBeCloseTo(739.2, 6);
    expect(p.xPt).toBe(36);
    expect(p.bottomPt).toBeCloseTo(12.8, 6);
  });

  test("an 8 mm lift raises the image bottom to 35.5 pt and clears the printer's dead zone", () => {
    const p = cricutPdfPlacement(8);
    expect(p.bottomPt).toBeCloseTo(12.8 + (8 / 25.4) * 72, 6);
    expect(cricutBottomClearanceMm(0)).toBeCloseTo(4.52, 2);
    expect(cricutBottomClearanceMm(8)).toBeCloseTo(12.52, 2);
  });

  test("raster box on the page: 0.5 in from the left, (40 pt − lift) from the top", () => {
    const b = cricutRasterBox(8);
    expect(b.leftIn).toBeCloseTo(0.5, 6);
    expect(b.topIn).toBeCloseTo((40 - (8 / 25.4) * 72) / 72, 6);
    expect(b.widthIn).toBeCloseTo(2209 / 300, 6);
    expect(b.heightIn).toBeCloseTo(3080 / 300, 6);
  });

  test("slot boxes are 87 × 63 mm landscape cards offset from the raster box", () => {
    const s = cricutSlotBox(3, 8);
    const r = cricutRasterBox(8);
    expect(s.widthIn * 25.4).toBeCloseTo(87.04, 1);
    expect(s.heightIn * 25.4).toBeCloseTo(63.0, 1);
    expect(s.leftIn).toBeCloseTo(r.leftIn + 1075 / 300, 6);
    expect(s.topIn).toBeCloseTo(r.topIn + 1168 / 300, 6);
  });
});

describe("cricutPages", () => {
  test("chunks by six and keeps the remainder", () => {
    const pages = cricutPages(Array.from({ length: 14 }, (_, i) => i));
    expect(pages.map((p) => p.length)).toEqual([6, 6, 2]);
    expect(pages[2]).toEqual([12, 13]);
  });
  test("empty in, empty out", () => {
    expect(cricutPages([])).toEqual([]);
  });
});

describe("filenames", () => {
  test("pdf carries the profile, deck and lift", () => {
    expect(cricutPdfFilename("Lost Zone Box", 8)).toBe("cricut-ptc-letter-6up-lost-zone-box-up8mm.pdf");
    expect(cricutPdfFilename(null, 8)).toBe("cricut-ptc-letter-6up-cards-up8mm.pdf");
    expect(cricutPdfFilename("x", 7.5)).toBe("cricut-ptc-letter-6up-x-up7.5mm.pdf");
  });
  test("fixture carries the size to type into Design Space", () => {
    expect(cricutFixtureFilename()).toBe("cricut-letter-6up-cut-fixture-17.81x19.69cm.png");
  });
});
