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

    // Block on font readiness before assertions — same gate the page uses.
    await page.evaluate(() => document.fonts.ready);

    const sheet = page.locator(".print-sheet");
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

  test("shows an error when neither deckId nor gallery= is supplied", async ({ page }) => {
    await page.goto("/print.html");
    await expect(page.locator(".status-error")).toBeVisible({ timeout: 5000 });
  });
});
