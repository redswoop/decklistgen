import { test, expect } from "@playwright/test";

const TEST_EMAIL = "claude@test.local";
const TEST_PASSWORD = "playwright-test-2024";
const MOBILE = { width: 375, height: 812 };

async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.removeItem("decklistgen-layout");
    localStorage.removeItem("decklistgen-decklist");
    localStorage.removeItem("decklistgen-deck-meta");
  });
  await page.waitForSelector(".auth-form", { timeout: 5000 });
  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.locator(".auth-submit").click();
  await page.waitForSelector(".app-nav", { timeout: 10000 });
}

test.describe("Mobile Browse Initial Load", () => {
  test("cards render immediately when navigating with era param", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await login(page);

    // Pre-load era data on the server
    await page.evaluate(async () => {
      await fetch("/api/load-era/sv", { method: "POST" });
    });

    // Navigate with era param — simulates a mobile refresh with saved URL
    await page.goto("/?era=sv");
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
});
