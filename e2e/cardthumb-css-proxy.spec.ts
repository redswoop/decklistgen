import { test, expect, type Page } from "@playwright/test";

/*
 * CardThumb graduation check: with ?mode=proxy in the URL, grid tiles for
 * cards that have a cached clean image should mount the CssCardRenderer
 * instead of the raw cleaned-art <img>. Cards without a clean fall back to
 * the existing image element.
 */

async function gotoBrowseProxy(page: Page) {
  await page.goto("/?mode=proxy");
  await page.waitForLoadState("networkidle");
  // The browse grid needs cards loaded; .card-thumb appears once they render.
  await page.waitForSelector(".card-thumb", { timeout: 15000 });
}

test.describe("CardThumb CSS proxy renderer (V1)", () => {
  test("at least one thumb in the browse grid mounts CssCardRenderer when proxy mode is on", async ({ page }) => {
    await gotoBrowseProxy(page);
    // Cards with a cached clean image render via CssCardRenderer (.card-thumb-css).
    // Wait for the status batch to resolve and the first such tile to mount.
    const cssTile = page.locator(".card-thumb .card-thumb-css").first();
    await expect(cssTile).toBeVisible({ timeout: 15000 });

    // And the lab CardFullArt's art layer is inside.
    const art = cssTile.locator("img.art").first();
    await expect(art).toBeVisible();
    const src = await art.getAttribute("src");
    expect(src).toMatch(/\/api\/pokeproxy\/image\/.+\/(clean|composite)/);
  });

  test("toggling Original mode hides CssCardRenderer", async ({ page }) => {
    await gotoBrowseProxy(page);
    await expect(page.locator(".card-thumb .card-thumb-css").first()).toBeVisible({ timeout: 15000 });

    // The mode toggle UI lives in the top right of the browse view. Find the
    // "Original" button — it's a sibling of the "Proxy" button.
    const originalBtn = page.getByRole("button", { name: /^Original$/ }).first();
    await originalBtn.click();

    // After toggling, no .card-thumb-css should remain.
    await expect(page.locator(".card-thumb .card-thumb-css")).toHaveCount(0);
    // …but the raw <img> path is still there.
    await expect(page.locator(".card-thumb .card-thumb-img").first()).toBeVisible();
  });
});
