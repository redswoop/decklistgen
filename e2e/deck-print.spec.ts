/**
 * /print.html smoke — confirms the client-only print route boots, fetches a
 * card list, and lays out a 2.5"×3.5" CSS grid before printing.
 *
 * Uses ?gallery=1 with sessionStorage so we don't need to create a saved deck
 * (which would require auth). The Gallery-print path is the same code path
 * the deck-print path takes after fetching the deck.
 */
import { test, expect } from "@playwright/test";

test.describe("/print.html", () => {
  test("renders a 2.5×3.5in print grid for gallery card IDs", async ({ page }) => {
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

    // Each cell sized to 2.5"×3.5" → at 96dpi that's 240×336 CSS px.
    const box = await cells.first().boundingBox();
    expect(box?.width).toBeGreaterThan(238);
    expect(box?.width).toBeLessThan(242);
    expect(box?.height).toBeGreaterThan(334);
    expect(box?.height).toBeLessThan(338);
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

  test("shows an error when neither deckId nor gallery= is supplied", async ({ page }) => {
    await page.goto("/print.html");
    await expect(page.locator(".status-error")).toBeVisible({ timeout: 5000 });
    // Terminal error state is published for headless drivers to wait on.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.printState))
      .toBe("error");
  });
});
