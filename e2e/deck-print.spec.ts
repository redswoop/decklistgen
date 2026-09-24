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

  test("shows an error when neither deckId nor gallery= is supplied", async ({ page }) => {
    await page.goto("/print.html");
    await expect(page.locator(".status-error")).toBeVisible({ timeout: 5000 });
    // Terminal error state is published for headless drivers to wait on.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.printState))
      .toBe("error");
  });
});
