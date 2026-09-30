/**
 * Cricut Print Then Cut mode on /print.html?mode=cricut: six landscape cards
 * per Letter page (or two such regions on a Super-B sheet, see the second block) at Design Space's raster geometry, its registration marks,
 * a lossless PDF download, and the one-time Design Space cut fixture.
 *
 * The numbers asserted here were measured from a real Design Space print
 * (see PRINT_SHEET.md, "Cricut Print Then Cut without Design Space printing").
 */
import { test, expect } from "@playwright/test";
import { readFile, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const IDS = ["sv01-001", "sv01-006", "sv01-172", "sv01-001", "sv01-006", "sv01-172", "sv01-001"];

async function openCricut(page: import("@playwright/test").Page, extra = "") {
  await page.addInitScript((ids) => {
    sessionStorage.setItem("gallery-print-ids", JSON.stringify(ids));
  }, IDS);
  await page.goto(`/print.html?gallery=1&mode=cricut&auto=0${extra}`);
  await page.waitForFunction(() => document.documentElement.dataset.printState === "ready", { timeout: 15000 });
}

test.describe("/print.html cricut mode", () => {
  test("lays out 6 landscape slots per Letter page where Design Space puts them", async ({ page }) => {
    await openCricut(page);
    const pages = page.locator(".cricut-page");
    await expect(pages).toHaveCount(2); // 7 cards → 6 + 1
    await expect(pages.first().locator(".cricut-cell")).toHaveCount(6);
    await expect(pages.nth(1).locator(".cricut-cell")).toHaveCount(1);
    await expect(page.getByTestId("cricut-meta")).toContainText("6 per sheet · 2 sheets · lifted 8 mm");
    await expect(page.getByTestId("cricut-meta")).toContainText("17.81 × 19.69 cm");

    // Geometry in CSS px (96/in): page 816 × 1056; raster at x 48, y (40 pt − 8 mm) = 0.2405 in;
    // slot 0 at raster (0, 377) px @300dpi; slot 1 is 1075 px right; slot 2 is 791 px down.
    const box = async (sel: string) => {
      const b = await page.locator(sel).first().boundingBox();
      return b!;
    };
    const pageBox = await box(".cricut-page");
    const marks = await box(".cricut-marks");
    const s0 = await box('.cricut-cell[data-entry-index="0"]');
    const s1 = await box('.cricut-cell[data-entry-index="1"]');
    const s2 = await box('.cricut-cell[data-entry-index="2"]');
    expect(pageBox.width).toBeCloseTo(816, 0);
    expect(pageBox.height).toBeCloseTo(1056, 0);
    expect(marks.x - pageBox.x).toBeCloseTo(48, 0);
    expect(marks.y - pageBox.y).toBeCloseTo(((40 - (8 / 25.4) * 72) / 72) * 96, 0);
    expect(marks.width).toBeCloseTo((2209 / 300) * 96, 0);
    expect(s0.x - marks.x).toBeCloseTo(0, 0);
    expect(s0.y - marks.y).toBeCloseTo((377 / 300) * 96, 0);
    expect(s0.width).toBeCloseTo((1028 / 300) * 96, 0);
    expect(s0.height).toBeCloseTo((744 / 300) * 96, 0);
    expect(s1.x - s0.x).toBeCloseTo((1075 / 300) * 96, 0);
    expect(s2.y - s0.y).toBeCloseTo((791 / 300) * 96, 0);
  });

  test("downloads a lossless Letter PDF with Design Space's raster and marks", async ({ page }) => {
    test.setTimeout(120_000);
    await openCricut(page);
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 90_000 }),
      page.getByTestId("cricut-pdf-download").click(),
    ]);
    expect(download.suggestedFilename()).toBe("cricut-ptc-letter-6up-cards-up8mm.pdf");
    const path = (await download.path())!;
    const text = new TextDecoder("latin1").decode(await readFile(path));
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Count 2");
    expect(text).toContain("/MediaBox [0 0 612 792]");
    expect(text).toContain("/Width 2209 /Height 3080 /ColorSpace /DeviceRGB");
    // 12.8 pt + 8 mm lift = 35.4772 pt from the page bottom.
    expect(text).toContain("q 530.16 0 0 739.2 36 35.4772 cm /Im Do Q");
    await expect(page.getByTestId("cricut-pdf-error")).toHaveCount(0);

    // With poppler present, decode page 1 and check the marks and the card
    // islands sit where Design Space's own print had them.
    if (!spawnSync("which", ["pdftoppm"]).status) {
      const dir = await mkdtemp(join(tmpdir(), "cricut-e2e-"));
      const r = spawnSync("pdftoppm", ["-r", "300", "-f", "1", "-l", "1", "-png", path, join(dir, "p")]);
      expect(r.status).toBe(0);
      const sharp = (await import("sharp")).default;
      const pngPath = join(dir, "p-1.png");
      const { data, info } = await sharp(pngPath).raw().toBuffer({ resolveWithObject: true });
      expect(info.width).toBe(2550);
      expect(info.height).toBe(3300);
      const dark = (x: number, y: number) => {
        const i = (y * info.width + x) * info.channels;
        return data[i] < 80 && data[i + 1] < 80 && data[i + 2] < 80;
      };
      // Raster origin on the page at 300 dpi: x = 36 pt = 150 px; y = (40 pt − 8 mm)/72 in = 72.1 px.
      const ox = 150;
      const oy = Math.round(((40 - (8 / 25.4) * 72) / 72) * 300);
      // Top-left mark: horizontal bar at raster rows 0–17, cols 36–299.
      expect(dark(ox + 100, oy + 8)).toBe(true);
      expect(dark(ox + 8, oy + 100)).toBe(true);
      // Gap at the very corner of the top-left mark (rows/cols 18–35 are empty).
      expect(dark(ox + 26, oy + 26)).toBe(false);
      // Bottom-right mark's bottom bar: raster row 3079, col 2100.
      expect(dark(ox + 2100, oy + 3079)).toBe(true);
      // Card 1 covers raster (0..1027, 377..1120): its centre is not white; the gutter between
      // card 1 and card 2 (col ~1050, well past the 10 px bleed) is white.
      const white = (x: number, y: number) => {
        const i = (y * info.width + x) * info.channels;
        return data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245;
      };
      expect(white(ox + 514, oy + 749)).toBe(false);
      expect(white(ox + 1051, oy + 749)).toBe(true);
      // Below the last row (raster y > 2711 + bleed) is white until the lower marks.
      expect(white(ox + 514, oy + 2740)).toBe(true);
      // Every one of the six slots holds a real card: a 5 × 5 probe grid across
      // the slot must show real colour variety, not a flat fill or white.
      for (let slot = 0; slot < 6; slot++) {
        const sx = ox + (slot % 2) * 1075;
        const sy = oy + 377 + Math.floor(slot / 2) * 791;
        const seen = new Set<string>();
        let whites = 0;
        for (let gy = 1; gy <= 5; gy++) {
          for (let gx = 1; gx <= 5; gx++) {
            const x = sx + Math.round((gx / 6) * 1028);
            const y = sy + Math.round((gy / 6) * 744);
            const i = (y * info.width + x) * info.channels;
            seen.add(`${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`);
            if (white(x, y)) whites++;
          }
        }
        expect(seen.size, `slot ${slot} colour variety`).toBeGreaterThan(6);
        expect(whites, `slot ${slot} white probes`).toBeLessThan(20);
      }
      await writeFile(join(dir, "ok"), "");
    }
  });

  test("downloads the Design Space cut fixture at the sheet's exact size", async ({ page }) => {
    await openCricut(page);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("cricut-fixture-download").click(),
    ]);
    expect(download.suggestedFilename()).toBe("cricut-letter-6up-cut-fixture-17.81x19.69cm.png");
    const bytes = new Uint8Array(await readFile((await download.path())!));
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(dv.getUint32(16)).toBe(2103);
    expect(dv.getUint32(20)).toBe(2326);
    expect(bytes[25]).toBe(6);
    const physOff = 8 + 25;
    expect(String.fromCharCode(...bytes.subarray(physOff + 4, physOff + 8))).toBe("pHYs");
    expect(dv.getUint32(physOff + 8)).toBe(11811);
    // Six opaque islands with transparent gutters: probe a gutter and a card centre.
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alpha = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3];
    expect(alpha(514, 372)).toBe(255);
    expect(alpha(1051, 372)).toBe(0);
    expect(alpha(514, 760)).toBe(0);
    expect(alpha(0, 0)).toBe(0); // rounded corner
  });

  test("honours lift= and pins the orientation even when the URL says otherwise", async ({ page }) => {
    await openCricut(page, "&lift=5&orientation=landscape");
    await expect(page.getByTestId("cricut-meta")).toContainText("lifted 5 mm");
    const box = (await page.locator(".cricut-page").first().boundingBox())!;
    expect(box.width).toBeCloseTo(816, 0);
    expect(box.height).toBeCloseTo(1056, 0);
  });
});

/**
 * paper=super-b: one 13 × 19 in page carrying the Letter raster twice, a half
 * turn apart, each with the Letter page's top-left on a factory corner of the
 * sheet (top-right and bottom-left in the portrait feed). The sheet is cut in
 * half and each half is cut as a Letter page.
 */
test.describe("/print.html cricut mode on Super-B", () => {
  const PX = 96 / 72; // CSS px per pt

  test("lays two Letter regions out in opposite corners, twelve per page", async ({ page }) => {
    await openCricut(page, "&paper=super-b");
    const pages = page.locator(".cricut-page");
    await expect(pages).toHaveCount(1); // 7 cards → 6 in the top region, 1 in the bottom
    await expect(pages.first().locator(".cricut-region")).toHaveCount(2);
    await expect(pages.first().locator(".cricut-region").first().locator(".cricut-cell")).toHaveCount(6);
    await expect(pages.first().locator(".cricut-region").nth(1).locator(".cricut-cell")).toHaveCount(1);
    await expect(page.getByTestId("cricut-meta")).toContainText("Super-B (13 × 19 in) · 12 per sheet · 1 sheet · two Letter regions");
    await expect(page.getByTestId("cricut-meta")).toContainText("17.81 × 19.69 cm");

    const rel = async (loc: import("@playwright/test").Locator) => {
      const pg = (await pages.first().boundingBox())!;
      const b = (await loc.boundingBox())!;
      return { x: b.x - pg.x, y: b.y - pg.y, w: b.width, h: b.height, right: pg.width - (b.x - pg.x + b.width), bottom: pg.height - (b.y - pg.y + b.height) };
    };
    const pg = (await pages.first().boundingBox())!;
    expect(pg.width).toBeCloseTo(13 * 96, 0);
    expect(pg.height).toBeCloseTo(19 * 96, 0);

    // Top region: the raster turned a quarter turn clockwise. Its Letter top
    // margin (40 pt) is now against the page's right edge, its left margin
    // (36 pt) against the page's top edge.
    const top = await rel(page.locator(".cricut-marks").first());
    expect(top.w).toBeCloseTo(739.2 * PX, 0);
    expect(top.h).toBeCloseTo(530.16 * PX, 0);
    expect(top.right).toBeCloseTo(40 * PX, 0);
    expect(top.y).toBeCloseTo(36 * PX, 0);
    // Bottom region: the same, a half turn round.
    const bottom = await rel(page.locator(".cricut-marks").nth(1));
    expect(bottom.w).toBeCloseTo(739.2 * PX, 0);
    expect(bottom.x).toBeCloseTo(40 * PX, 0);
    expect(bottom.bottom).toBeCloseTo(36 * PX, 0);
    // The cut line is drawn across the middle at print weight (1.5 pt = 2 px).
    const cut = await rel(page.getByTestId("cricut-cut-line"));
    expect(cut.y + cut.h / 2).toBeCloseTo(pg.height / 2, 0);
    expect(cut.w).toBeCloseTo(pg.width, 0);
    expect(cut.h).toBeCloseTo(2, 0);
    // Both regions stay in their own half of the sheet.
    expect(top.y + top.h).toBeLessThan(pg.height / 2);
    expect(bottom.y).toBeGreaterThan(pg.height / 2);

    // Slot 0 sits at raster (0, 377): 377 px @300dpi in from the mark edge that
    // faces the Letter top, flush with the edge that faces the Letter left.
    const s0 = await rel(page.locator('.cricut-cell[data-entry-index="0"]'));
    expect(s0.w).toBeCloseTo((744 / 300) * 96, 0);
    expect(s0.h).toBeCloseTo((1028 / 300) * 96, 0);
    expect(s0.y).toBeCloseTo(top.y, 0);
    expect(s0.right - top.right).toBeCloseTo((377 / 300) * 96, 0);
    const s6 = await rel(page.locator('.cricut-cell[data-entry-index="6"]'));
    expect(s6.bottom).toBeCloseTo(bottom.bottom, 0);
    expect(s6.x - bottom.x).toBeCloseTo((377 / 300) * 96, 0);
  });

  test("downloads a 13 × 19 PDF with both rasters turned into place", async ({ page }) => {
    test.setTimeout(120_000);
    await openCricut(page, "&paper=super-b");
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 90_000 }),
      page.getByTestId("cricut-pdf-download").click(),
    ]);
    expect(download.suggestedFilename()).toBe("cricut-ptc-super-b-12up-cards-up0mm.pdf");
    const path = (await download.path())!;
    const text = new TextDecoder("latin1").decode(await readFile(path));
    expect(text).toContain("/Count 1");
    expect(text).toContain("/MediaBox [0 0 936 1368]");
    expect(text.match(/\/Width 2209 \/Height 3080 \/ColorSpace \/DeviceRGB/g)?.length).toBe(2);
    expect(text).toContain("q 0 -530.16 739.2 0 156.8 1332 cm /Im Do Q");
    expect(text).toContain("q 0 530.16 -739.2 0 779.2 36 cm /Im2 Do Q");
    expect(text).toContain("q 0 G 1.5 w [12 6] 0 d 0 684 m 936 684 l S Q");
    await expect(page.getByTestId("cricut-pdf-error")).toHaveCount(0);

    if (!spawnSync("which", ["pdftoppm"]).status) {
      const dir = await mkdtemp(join(tmpdir(), "cricut-e2e-"));
      const r = spawnSync("pdftoppm", ["-r", "300", "-f", "1", "-l", "1", "-png", path, join(dir, "p")]);
      expect(r.status).toBe(0);
      const sharp = (await import("sharp")).default;
      const { data, info } = await sharp(join(dir, "p-1.png")).raw().toBuffer({ resolveWithObject: true });
      expect(info.width).toBe(3900);
      expect(info.height).toBe(5700);
      const at = (x: number, y: number) => {
        const i = (Math.round(y) * info.width + Math.round(x)) * info.channels;
        return [data[i], data[i + 1], data[i + 2]];
      };
      const dark = (p: [number, number]) => at(...p).every((c) => c < 80);
      const white = (p: [number, number]) => at(...p).every((c) => c > 245);
      // Raster px → page px at 300 dpi. Letter margins: 36 pt = 150 px, 40 pt = 166.67 px.
      const top = (rx: number, ry: number): [number, number] => [3900 - 166.67 - ry, 150 + rx];
      const bottom = (rx: number, ry: number): [number, number] => [166.67 + ry, 5700 - 150 - rx];
      for (const at300 of [top, bottom]) {
        // Same probes as the Letter test, through the region's turn.
        expect(dark(at300(100, 8))).toBe(true);
        expect(dark(at300(8, 100))).toBe(true);
        expect(white(at300(26, 26))).toBe(true);
        expect(dark(at300(2100, 3077))).toBe(true);
        expect(white(at300(514, 749))).toBe(false); // slot 0 holds a card
        expect(white(at300(1051, 749))).toBe(true); // gutter
      }
      // Top region is full; the bottom one holds a single card.
      expect(white(top(1075 + 514, 1959 + 372))).toBe(false);
      expect(white(bottom(1075 + 514, 749))).toBe(true);
      // The cut line is printed across the middle: 1.5 pt (6 px) thick, 12 pt
      // on / 6 pt off (50 px / 25 px), with blank paper either side of it.
      expect(dark([25, 2850])).toBe(true);
      expect(dark([3775, 2850])).toBe(true);
      expect(white([62, 2850])).toBe(true); // in a gap
      let inked = 0;
      for (let x = 0; x < 3900; x++) if (dark([x, 2850])) inked++;
      expect(inked / 3900).toBeGreaterThan(0.6);
      for (let x = 50; x < 3900; x += 50) {
        expect(white([x, 2850 - 40])).toBe(true);
        expect(white([x, 2850 + 40])).toBe(true);
      }
    }
  });
});
