/**
 * /print.html smoke — confirms the client-only print route boots, fetches a
 * card list, and lays out a 63×87mm CSS grid before printing.
 *
 * Uses ?gallery=1 with sessionStorage so we don't need to create a saved deck
 * (which would require auth). The Gallery-print path is the same code path
 * the deck-print path takes after fetching the deck.
 */
import { test, expect } from "@playwright/test";

test.describe("/print.html", () => {
  test("renders a 63×87mm print grid for gallery card IDs", async ({ page }) => {
    // Seed sessionStorage with a card the Gallery TEST_CARDS list already
    // exposes; the server-side card store always has SV01 loaded.
    await page.addInitScript(() => {
      sessionStorage.setItem(
        "gallery-print-ids",
        JSON.stringify(["sv01-001", "sv01-006", "sv01-172"]),
      );
    });

    await page.goto("/print.html?gallery=1&auto=0");

    // Deterministic readiness contract: wait for the terminal state instead of
    // racing timers or touching window.print(). See PRINT_SHEET.md.
    await page.waitForFunction(
      () => document.documentElement.dataset.printState === "ready",
      { timeout: 15000 },
    );

    const sheet = page.locator(".print-page-sheet");
    await expect(sheet).toBeVisible({ timeout: 10000 });

    // Three input ids → three cells in the grid.
    const cells = sheet.locator(".print-cell");
    await expect(cells).toHaveCount(3);

    // Each cell sized to 63×87mm → at 96dpi that's 238.1×328.8 CSS px.
    const box = await cells.first().boundingBox();
    expect(box?.width).toBeGreaterThan(237);
    expect(box?.width).toBeLessThan(239.5);
    expect(box?.height).toBeGreaterThan(327.5);
    expect(box?.height).toBeLessThan(330);
  });

  test("grid pins 0.25in from the sheet top-left, not centered", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        "gallery-print-ids",
        JSON.stringify(["sv01-001", "sv01-006", "sv01-172"]),
      );
    });

    await page.goto("/print.html?gallery=1&art=original&auto=0");
    await page.waitForFunction(
      () => document.documentElement.dataset.printState === "ready",
      { timeout: 15000 },
    );

    const sheet = page.locator(".print-page-sheet");
    const cell = sheet.locator(".print-cell").first();
    const sheetBox = await sheet.boundingBox();
    const cellBox = await cell.boundingBox();
    expect(sheetBox).not.toBeNull();
    expect(cellBox).not.toBeNull();

    // 0.25in at 96 CSS dpi = 24px. Centered 3-across on letter would be ~46px.
    const dx = cellBox!.x - sheetBox!.x;
    const dy = cellBox!.y - sheetBox!.y;
    expect(dx).toBeGreaterThanOrEqual(23);
    expect(dx).toBeLessThanOrEqual(25);
    expect(dy).toBeGreaterThanOrEqual(23);
    expect(dy).toBeLessThanOrEqual(25);

    await page.emulateMedia({ media: "print" });
    const printSheet = await sheet.boundingBox();
    const printCell = await cell.boundingBox();
    expect(printCell!.x - printSheet!.x).toBeGreaterThanOrEqual(23);
    expect(printCell!.x - printSheet!.x).toBeLessThanOrEqual(25);
    expect(printCell!.y - printSheet!.y).toBeGreaterThanOrEqual(23);
    expect(printCell!.y - printSheet!.y).toBeLessThanOrEqual(25);
  });

  test("downloads a Cricut cut SVG matching the on-screen grid", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("gallery-print-ids", JSON.stringify(["sv01-001"]));
    });
    await page.goto("/print.html?gallery=1&art=original&auto=0&crop=0");
    await page.waitForFunction(
      () => document.documentElement.dataset.printState === "ready",
      { timeout: 15000 },
    );

    const bar = page.getByTestId("cut-file-bar");
    await expect(bar).toContainText("189 × 261 mm");
    await expect(bar).toContainText("6.35 mm");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("cut-file-download").click(),
    ]);
    expect(download.suggestedFilename()).toBe("cut-letter-portrait-3x3-63x87mm-flush.svg");
    const path = await download.path();
    const svg = await (await import("node:fs/promises")).readFile(path!, "utf8");
    expect(svg).toContain('width="189mm"');
    expect(svg.match(/<path/g)?.length).toBe(1);
    expect(svg.match(/Z/g)?.length).toBe(9);

    // The bar is screen chrome only — it must not print.
    await page.emulateMedia({ media: "print" });
    await expect(bar).toBeHidden();
  });

  test("cut-file calibration pre-distorts the SVG and persists across reloads", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("gallery-print-ids", JSON.stringify(["sv01-001"]));
    });
    // Start from a clean calibration (same origin, before the page under test).
    await page.goto("/print.html");
    await page.evaluate(() => localStorage.removeItem("cricut-cut-calibration"));
    await page.goto("/print.html?gallery=1&art=original&auto=0&crop=0");
    await page.waitForFunction(
      () => document.documentElement.dataset.printState === "ready",
      { timeout: 15000 },
    );

    await page.getByTestId("cut-cal-toggle").click();
    // Placeholders show the ink positions for a flush letter 3x3.
    await expect(page.getByTestId("cal-lastRight")).toHaveAttribute("placeholder", "195.35");

    // A cutter that shrinks 1.25% and drops the corner at 3.5mm.
    await page.getByTestId("cal-firstLeft").fill("3.5");
    await page.getByTestId("cal-firstTop").fill("3.5");
    await page.getByTestId("cal-lastRight").fill((3.5 + 189 * 0.9875).toFixed(3));
    await page.getByTestId("cal-lastBottom").fill((3.5 + 261 * 0.9875).toFixed(3));
    await expect(page.getByTestId("cut-cal-result")).toContainText("scale 0.9875 × 0.9875");
    await expect(page.getByTestId("cut-file-bar")).toContainText("calibrated");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("cut-file-download").click(),
    ]);
    expect(download.suggestedFilename()).toBe("cut-letter-portrait-3x3-63x87mm-flush-calibrated.svg");
    const svg = await (await import("node:fs/promises")).readFile((await download.path())!, "utf8");
    // 9 cards + the anchor square.
    expect(svg.match(/Z/g)?.length).toBe(10);
    expect(svg).toContain("alignment anchor");

    // Survives a reload (localStorage), and Clear returns to the plain file.
    await page.reload();
    await page.waitForFunction(
      () => document.documentElement.dataset.printState === "ready",
      { timeout: 15000 },
    );
    await expect(page.getByTestId("cut-file-bar")).toContainText("calibrated");
    await page.getByTestId("cut-cal-toggle").click();
    await page.getByTestId("cut-cal-clear").click();
    await expect(page.getByTestId("cut-file-bar")).not.toContainText("calibrated");
  });

  test("downloads a 300 dpi page PNG for Bambu Print Then Cut", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("gallery-print-ids", JSON.stringify(["sv01-001", "sv01-006"]));
    });
    await page.goto("/print.html?gallery=1&auto=0&crop=0");
    await page.waitForFunction(
      () => document.documentElement.dataset.printState === "ready",
      { timeout: 15000 },
    );

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("page-png-download").click(),
    ]);
    expect(download.suggestedFilename()).toBe("print-page-1-of-1-3x3-300dpi.png");
    const bytes = new Uint8Array(await (await import("node:fs/promises")).readFile((await download.path())!));

    // PNG signature, then IHDR: width/height at 16..24, colour type at 25 (6 = RGBA).
    expect(Array.from(bytes.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const dv = new DataView(bytes.buffer);
    // The grid shrinks to the cells it uses: two cards → 2 cols × 1 row →
    // 126 × 87 mm → 1488 × 1028 px at 300 dpi. A full page would be 2232 × 3083.
    expect(dv.getUint32(16)).toBe(1488);
    expect(dv.getUint32(20)).toBe(1028);
    expect(bytes[25]).toBe(6);

    // pHYs chunk right after IHDR, 11811 px/m both axes, unit = metre.
    const physOff = 8 + 25;
    expect(String.fromCharCode(...bytes.subarray(physOff + 4, physOff + 8))).toBe("pHYs");
    expect(dv.getUint32(physOff + 8)).toBe(11811);
    expect(dv.getUint32(physOff + 12)).toBe(11811);
    expect(bytes[physOff + 16]).toBe(1);

    await expect(page.getByTestId("page-png-error")).toHaveCount(0);
  });

  test("downloads a Cricut Print Then Cut ZIP: one transparent PNG per unique card", async ({ page }) => {
    // sv01-001 twice → one file named 2x-…; sv01-006 once → 1x-….
    await page.addInitScript(() => {
      sessionStorage.setItem("gallery-print-ids", JSON.stringify(["sv01-001", "sv01-006", "sv01-001"]));
    });
    await page.goto("/print.html?gallery=1&auto=0&crop=0");
    await page.waitForFunction(
      () => document.documentElement.dataset.printState === "ready",
      { timeout: 15000 },
    );

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("cricut-zip-download").click(),
    ]);
    expect(download.suggestedFilename()).toBe("cricut-ptc-cards-63x87mm-300dpi.zip");
    const zip = new Uint8Array(await (await import("node:fs/promises")).readFile((await download.path())!));
    const { readStoredZip } = await import("../src/shared/utils/zip-store");
    const entries = readStoredZip(zip);
    expect(entries.map((e) => e.name)).toEqual([
      "README.txt",
      "2x-pineco-sv01-001.png",
      "1x-cacturne-sv01-006.png",
    ]);

    const readme = new TextDecoder().decode(entries[0].data);
    expect(readme).toContain("63 × 87 mm (2.480 × 3.425 in)");
    expect(readme).toContain("2x-pineco-sv01-001.png  ×2  Pineco  sv01-001");

    // Each PNG: one card, 744 × 1028 RGBA at 300 dpi, pHYs right after IHDR.
    for (const png of entries.slice(1)) {
      const bytes = png.data;
      expect(Array.from(bytes.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      expect(dv.getUint32(16)).toBe(744);
      expect(dv.getUint32(20)).toBe(1028);
      expect(bytes[25]).toBe(6);
      const physOff = 8 + 25;
      expect(String.fromCharCode(...bytes.subarray(physOff + 4, physOff + 8))).toBe("pHYs");
      expect(dv.getUint32(physOff + 8)).toBe(11811);
      expect(bytes[physOff + 16]).toBe(1);
    }

    // Alpha: the corner is cut away (transparent), the card body is opaque.
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(Buffer.from(entries[1].data)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3];
    expect(alphaAt(0, 0)).toBe(0);
    expect(alphaAt(info.width - 1, info.height - 1)).toBe(0);
    expect(alphaAt(Math.floor(info.width / 2), Math.floor(info.height / 2))).toBe(255);
    // 3 mm ≈ 35 px in from the corner along the edge is past the arc: opaque.
    expect(alphaAt(60, 0)).toBe(255);

    await expect(page.getByTestId("cricut-zip-error")).toHaveCount(0);
  });

  test("shows an error when neither deckId nor gallery= is supplied", async ({ page }) => {
    await page.goto("/print.html");
    await expect(page.locator(".status-error")).toBeVisible({ timeout: 5000 });
    // Terminal error state is published for headless drivers to wait on.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.printState))
      .toBe("error");
  });
});
