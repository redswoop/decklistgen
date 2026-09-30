import { describe, expect, test } from "bun:test";
import {
  CRICUT_LETTER_6UP,
  CRICUT_SUPER_B_12UP,
  cricutCardsPerRegion,
  cricutCutLine,
  cricutLayoutForPaper,
  cricutLiftMm,
  cricutPageRegions,
  cricutPdfMatrix,
  cricutRegionTransform,
  cricutBottomClearanceMm,
  cricutCardsPerSheet,
  cricutFixtureFilename,
  cricutPages,
  cricutPdfFilename,
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
    const [a, b, c, d, x, bottom] = cricutPdfMatrix(CRICUT_LETTER_6UP.regions[0], 0);
    expect(a).toBeCloseTo(530.16, 6);
    expect(d).toBeCloseTo(739.2, 6);
    expect([b, c]).toEqual([0, 0]);
    expect(x).toBe(36);
    expect(bottom).toBeCloseTo(12.8, 6);
  });

  test("an 8 mm lift raises the image bottom to 35.5 pt and clears the printer's dead zone", () => {
    const bottom = cricutPdfMatrix(CRICUT_LETTER_6UP.regions[0], 8)[5];
    expect(bottom).toBeCloseTo(12.8 + (8 / 25.4) * 72, 6);
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

describe("Super-B 12-up profile", () => {
  const L = CRICUT_SUPER_B_12UP;
  const [top, bottom] = L.regions;

  // Where a point of Design Space's Letter sheet (pt, y down) lands on the
  // printed page (pt, y down), worked from the region alone.
  const onPage = (region: typeof top, x: number, y: number) => {
    switch (region.rotate) {
      case 0: return { x: region.leftPt + x, y: region.topPt + y };
      case 90: return { x: region.leftPt + L.sheetHPt - y, y: region.topPt + x };
      case 180: return { x: region.leftPt + L.sheetWPt - x, y: region.topPt + L.sheetHPt - y };
      case 270: return { x: region.leftPt + y, y: region.topPt + L.sheetWPt - x };
    }
  };
  // Where the PDF matrix puts a point of the raster (px, y down), flipped to y down.
  const viaPdf = (region: typeof top, px: number, py: number) => {
    const [a, b, c, d, e, f] = cricutPdfMatrix(region, 0, L);
    const u = px / L.rasterW;
    const v = 1 - py / L.rasterH;
    return { x: a * u + c * v + e, y: L.pageHPt - (b * u + d * v + f) };
  };

  test("picked by paper, 13 × 19 in portrait, twelve per sheet, six per region, no lift", () => {
    expect(cricutLayoutForPaper("super-b")).toBe(L);
    expect(cricutLayoutForPaper("letter")).toBe(CRICUT_LETTER_6UP);
    expect([L.pageWPt, L.pageHPt]).toEqual([13 * 72, 19 * 72]);
    expect(cricutCardsPerSheet(L)).toBe(12);
    expect(cricutCardsPerRegion(L)).toBe(6);
    expect(cricutLiftMm(null, L)).toBe(0);
    expect(cricutLiftMm(null, CRICUT_LETTER_6UP)).toBe(8);
    expect(cricutLiftMm(5, L)).toBe(5);
  });

  test("each region's Letter top-left is a factory corner: page top-right and bottom-left", () => {
    expect(onPage(top, 0, 0)).toEqual({ x: L.pageWPt, y: 0 });
    expect(onPage(bottom, 0, 0)).toEqual({ x: 0, y: L.pageHPt });
  });

  test("the regions are a half turn apart about the page centre", () => {
    for (const [x, y] of [[0, 0], [36, 40], [612, 792], [100, 700]]) {
      const a = onPage(top, x, y);
      const b = onPage(bottom, x, y);
      expect(b.x).toBeCloseTo(L.pageWPt - a.x, 9);
      expect(b.y).toBeCloseTo(L.pageHPt - a.y, 9);
    }
  });

  test("each Letter sheet stays inside its own half, and the marks clear the printer margins", () => {
    const half = L.pageHPt / 2;
    for (const region of L.regions) {
      const corners = [onPage(region, 0, 0), onPage(region, L.sheetWPt, L.sheetHPt)];
      const upper = corners.every((c) => c.y <= half);
      const lower = corners.every((c) => c.y >= half);
      expect(upper || lower).toBe(true);
      for (const [px, py] of [[0, 0], [L.rasterW, 0], [0, L.rasterH], [L.rasterW, L.rasterH]]) {
        const p = viaPdf(region, px, py);
        const edge = Math.min(p.x, p.y, L.pageWPt - p.x, L.pageHPt - p.y);
        expect((edge / 72) * 25.4).toBeGreaterThan(12);
      }
    }
  });

  test("the PDF matrix puts the raster where the region puts the sheet", () => {
    const w = (L.rasterW / L.dpi) * 72;
    const h = (L.rasterH / L.dpi) * 72;
    for (const region of L.regions) {
      for (const [px, py] of [[0, 0], [L.rasterW, 0], [0, L.rasterH], [1075, 377]]) {
        const want = onPage(region, L.rasterLeftPt + (px / L.rasterW) * w, L.rasterTopPt + (py / L.rasterH) * h);
        const got = viaPdf(region, px, py);
        expect(got.x).toBeCloseTo(want.x, 9);
        expect(got.y).toBeCloseTo(want.y, 9);
      }
    }
    expect(cricutPdfMatrix(top, 0, L).map((n) => Number(n.toFixed(4)))).toEqual([0, -530.16, 739.2, 0, 156.8, 1332]);
    expect(cricutPdfMatrix(bottom, 0, L).map((n) => Number(n.toFixed(4)))).toEqual([0, 530.16, -739.2, 0, 779.2, 36]);
  });

  test("region transforms: a quarter turn each way, pinned to their corners", () => {
    expect(cricutRegionTransform(CRICUT_LETTER_6UP.regions[0], CRICUT_LETTER_6UP)).toBe("translate(0in, 0in) rotate(0deg)");
    expect(cricutRegionTransform(top, L)).toBe("translate(13in, 0in) rotate(90deg)");
    expect(cricutRegionTransform(bottom, L)).toBe("translate(0in, 19in) rotate(270deg)");
  });

  test("a page fills the top region first and drops a region with no cards", () => {
    const pages = cricutPages(Array.from({ length: 19 }, (_, i) => i), L);
    expect(pages.map((p) => p.length)).toEqual([12, 7]);
    const full = cricutPageRegions(pages[0], L);
    expect(full.map((r) => [r.region, r.start, r.cells.length])).toEqual([[top, 0, 6], [bottom, 6, 6]]);
    expect(cricutPageRegions(pages[1], L).map((r) => r.cells)).toEqual([[12, 13, 14, 15, 16, 17], [18]]);
    expect(cricutPageRegions([1, 2], L).map((r) => r.region)).toEqual([top]);
  });

  test("prints a heavy dashed cut line across the middle, clear of both Letter sheets", () => {
    expect(cricutCutLine(CRICUT_LETTER_6UP)).toBeNull();
    const line = cricutCutLine(L)!;
    expect(line).toEqual({ x1: 0, y1: 684, x2: 936, y2: 684, widthPt: 1.5, dashPt: [12, 6] });
    expect(line.widthPt).toBeGreaterThanOrEqual(1.5);
    for (const region of L.regions) {
      for (const [x, y] of [[0, 0], [L.sheetWPt, L.sheetHPt]]) {
        expect(Math.abs(onPage(region, x, y).y - L.cutLineTopPt!)).toBeGreaterThanOrEqual(72);
      }
    }
  });

  test("shares the Letter cut fixture; the PDF is named for the big sheet", () => {
    expect(cricutFixtureFilename(L)).toBe(cricutFixtureFilename(CRICUT_LETTER_6UP));
    expect(cricutSheetCm(L)).toEqual(cricutSheetCm(CRICUT_LETTER_6UP));
    expect(cricutPdfFilename("Lost Zone Box", 0, L)).toBe("cricut-ptc-super-b-12up-lost-zone-box-up0mm.pdf");
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
