import { test, expect } from "@playwright/test";

async function navigateToGallery(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.removeItem("decklistgen-layout");
    localStorage.removeItem("decklistgen-decklist");
    localStorage.removeItem("decklistgen-deck-meta");
    localStorage.removeItem("decklistgen-gallery-preview-mode");
    localStorage.removeItem("decklistgen-display-calibration");
    localStorage.removeItem("decklistgen-gallery-selected");
    localStorage.removeItem("decklistgen-gallery-filter");
    localStorage.removeItem("decklistgen-gallery-zoom");
  });
  await page.waitForSelector(".app-nav");
  await page.locator(".app-nav-tab", { hasText: "Gallery" }).click();
  await page.waitForSelector(".gallery-workbench");
}

test.describe("Gallery toolbar", () => {
  test("template filter narrows the grid", async ({ page }) => {
    await navigateToGallery(page);

    const totalBefore = await page.locator(".svg-thumb").count();
    expect(totalBefore).toBeGreaterThan(0);

    // Click the trainer chip — grid shrinks to only trainer cards.
    await page.locator(".fs-chip", { hasText: /^trainer/ }).click();
    await page.waitForTimeout(200);
    const afterFilter = await page.locator(".svg-thumb").count();
    expect(afterFilter).toBeGreaterThan(0);
    expect(afterFilter).toBeLessThan(totalBefore);

    // Reset to All.
    await page.locator(".fs-chip", { hasText: "All" }).click();
    await page.waitForTimeout(200);
    expect(await page.locator(".svg-thumb").count()).toBe(totalBefore);
  });

  test("search filters the grid by name", async ({ page }) => {
    await navigateToGallery(page);

    const totalBefore = await page.locator(".svg-thumb").count();
    // Pick a real cardId from the first thumb so the search is guaranteed to
    // match at least one card no matter which set is in TEST_CARDS today.
    const firstId = await page.locator(".svg-thumb .svg-thumb-id").first().textContent();
    const queryPrefix = firstId?.trim().split("-")[0] ?? "sv01";
    await page.locator(".gallery-search").fill(queryPrefix);
    await page.waitForTimeout(200);
    const afterSearch = await page.locator(".svg-thumb").count();
    expect(afterSearch).toBeLessThanOrEqual(totalBefore);
    expect(afterSearch).toBeGreaterThan(0);
  });

  test("zoom slider changes editing-size thumb width", async ({ page }) => {
    await navigateToGallery(page);

    // Ensure editing mode.
    await page.locator(".fs-mode-btn", { hasText: "Editing size" }).click();
    const firstThumb = page.locator(".svg-thumb").first();
    await expect(firstThumb).toBeVisible();
    const smallBox = await firstThumb.boundingBox();

    // Move the slider all the way right (320 px).
    const slider = page.locator(".gallery-zoom");
    await slider.evaluate((el: HTMLInputElement) => {
      el.value = "320";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForTimeout(200);

    const bigBox = await firstThumb.boundingBox();
    expect(bigBox!.width).toBeGreaterThan(smallBox!.width);
  });
});
