import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

/*
 * Verifies the lab's print mode lays cards out at real-world Pokémon TCG
 * proxy dimensions (2.5in × 3.5in, 3×3 per US Letter page) and that the
 * print media query produces a printable PDF.
 *
 * Run after `bun run dev` is up. Outputs PDF + screenshot under
 * test-results/lab-print/ for manual measurement against a real card.
 */

const OUT_DIR = "test-results/lab-print";

test.beforeAll(() => {
  mkdirSync(OUT_DIR, { recursive: true });
});

test.describe("Lab print mode", () => {
  test("cells are 2.5in × 3.5in in print media", async ({ page }) => {
    await page.emulateMedia({ media: "print" });
    await page.goto("/lab.html?print=1");

    // Wait for the print sheet to render (fonts loaded → ready=true).
    await page.waitForSelector(".print-sheet .print-cell", { timeout: 15_000 });

    const cell = page.locator(".print-cell").first();
    const box = await cell.boundingBox();
    expect(box).not.toBeNull();

    // 2.5in × 3.5in at 96 CSS dpi → 240 × 336 px. Allow ±1px sub-pixel slop.
    expect(box!.width).toBeGreaterThanOrEqual(239);
    expect(box!.width).toBeLessThanOrEqual(241);
    expect(box!.height).toBeGreaterThanOrEqual(335);
    expect(box!.height).toBeLessThanOrEqual(337);

    // The scaled inner card should fill the cell exactly (transform-origin
    // top-left + scale 0.32 against a 750×1050 native canvas).
    const innerCard = page.locator(".print-cell .card").first();
    const innerBox = await innerCard.boundingBox();
    expect(innerBox).not.toBeNull();
    // Inner card is the unscaled 750×1050 box; bounding-box from Playwright
    // reflects post-transform layout, so we expect 240×336 too.
    expect(innerBox!.width).toBeGreaterThanOrEqual(239);
    expect(innerBox!.width).toBeLessThanOrEqual(241);

    // Grid uses 3 columns. Cells 1–3 share a row Y; cell 4 starts a new row.
    const cells = page.locator(".print-cell");
    const count = await cells.count();
    expect(count).toBeGreaterThanOrEqual(9);

    const b0 = await cells.nth(0).boundingBox();
    const b2 = await cells.nth(2).boundingBox();
    const b3 = await cells.nth(3).boundingBox();
    expect(b0!.y).toBeCloseTo(b2!.y, 0); // same row
    expect(b3!.y).toBeGreaterThan(b0!.y + 100); // next row down
  });

  test("artwork prints as <img>, not background-image", async ({ page }) => {
    await page.emulateMedia({ media: "print" });
    await page.goto("/lab.html?print=1");
    await page.waitForSelector(".print-sheet .print-cell", { timeout: 15_000 });

    // The art is now an <img>, so it prints regardless of "Background graphics"
    // setting and regardless of print-color-adjust support.
    const artImgs = page.locator(".print-cell img.art");
    expect(await artImgs.count()).toBeGreaterThanOrEqual(9);

    // Wait until images report natural dimensions (i.e. loaded), then check
    // they're not the dark fallback. naturalWidth > 0 means a real image
    // came back from the API.
    const firstImg = artImgs.first();
    await expect.poll(
      () => firstImg.evaluate((el) => (el as HTMLImageElement).naturalWidth),
      { timeout: 10_000 },
    ).toBeGreaterThan(100);
  });

  test("emits a print-mode PDF for manual dimension check", async ({ page }) => {
    await page.goto("/lab.html?print=1");
    await page.waitForSelector(".print-sheet .print-cell", { timeout: 15_000 });
    // Let any in-flight art finish loading before snapshotting.
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.images)
          .filter((i) => !i.complete)
          .map(
            (i) =>
              new Promise<void>((r) => {
                i.addEventListener("load", () => r());
                i.addEventListener("error", () => r());
              }),
          ),
      ),
    );

    const pdfPath = join(OUT_DIR, "sample-cards.pdf");
    await page.pdf({
      path: pdfPath,
      format: "Letter",
      margin: { top: "0.25in", bottom: "0.25in", left: "0.25in", right: "0.25in" },
      printBackground: false, // We rely on print-color-adjust:exact instead.
      preferCSSPageSize: true,
    });

    // Two screenshots for review:
    //   sample-cards.png        — on-screen render (backdrop-filter active)
    //   sample-cards-print.png  — print-media render (opaque fallback for
    //                              the glass panel, no card drop-shadow)
    await page.screenshot({
      path: join(OUT_DIR, "sample-cards.png"),
      fullPage: true,
    });
    await page.emulateMedia({ media: "print" });
    await page.screenshot({
      path: join(OUT_DIR, "sample-cards-print.png"),
      fullPage: true,
    });
  });
});
