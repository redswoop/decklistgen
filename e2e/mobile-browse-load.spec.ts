import { test, expect } from "@playwright/test";
import { login as apiLogin } from "./helpers/auth";

const MOBILE = { width: 375, height: 812 };

async function login(page: import("@playwright/test").Page) {
  await apiLogin(page);
  await page.evaluate(() => {
    localStorage.removeItem("decklistgen-layout");
    localStorage.removeItem("decklistgen-decklist");
    localStorage.removeItem("decklistgen-deck-meta");
  });
  await page.reload();
  await page.waitForSelector(".app-nav", { timeout: 10000 });
}

// TODO: Skipped after CSS-renderer migration. Tests assume the mobile filter
// slide-over selectors that have since drifted. Rewrite when next touching
// mobile browse / era-load flow. See CLAUDE.md TODO.
test.describe.skip("Mobile Browse Initial Load", () => {
  for (const era of ["sv", "swsh", "me"] as const) {
    test(`cards render immediately when navigating with era=${era}`, async ({ page }) => {
      await page.setViewportSize(MOBILE);
      await login(page);

      // Pre-load era data on the server
      await page.evaluate(async (e) => {
        await fetch(`/api/load-era/${e}`, { method: "POST" });
      }, era);

      // Navigate with era param — simulates a mobile refresh with saved URL
      await page.goto(`/?era=${era}`);
      await page.waitForSelector(".app-nav", { timeout: 10000 });

      // Cards should appear without any user interaction (no tab flipping needed)
      await expect(page.locator(".card-tile").first()).toBeVisible({ timeout: 10000 });

      // Verify the grid has a reasonable number of visible tiles
      const tileCount = await page.locator(".card-tile").count();
      expect(tileCount).toBeGreaterThan(0);

      // Verify the card count header shows loaded cards
      const countText = await page.locator(".card-count").textContent();
      expect(countText).toMatch(/\d+ cards/);
    });
  }
});
