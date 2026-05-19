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
  });
  await page.waitForSelector(".app-nav");
  await page.locator(".app-nav-tab", { hasText: "Gallery" }).click();
  await page.waitForSelector(".gallery-workbench");
}

test.describe("Gallery print-preview", () => {
  test("toggles thumb width between editing and physical mode", async ({ page }) => {
    await navigateToGallery(page);

    const firstThumb = page.locator(".svg-thumb").first();
    await expect(firstThumb).toBeVisible({ timeout: 10000 });

    // Default is editing-size: ~180 px wide.
    const editingBox = await firstThumb.boundingBox();
    expect(editingBox).not.toBeNull();
    expect(editingBox!.width).toBeGreaterThan(150);
    expect(editingBox!.width).toBeLessThan(220);

    // Calibrate to 110 DPI via the rail's Calibrate button + dialog's numeric.
    const calBtn = page.locator(".btn-cal");
    await calBtn.scrollIntoViewIfNeeded();
    await calBtn.click();
    await expect(page.locator(".cal-overlay")).toBeVisible();
    await page.locator(".cal-advanced-toggle").click();
    await page.locator(".cal-numeric").fill("110");
    await page.locator(".cal-btn-save").click();
    await expect(page.locator(".cal-overlay")).toBeHidden();

    // Rail DPI readout updates.
    await expect(page.locator(".dcs-dpi")).toContainText("110 DPI");

    // Flip to Print Size — first thumb shrinks to ~275 px wide.
    await page.locator(".fs-mode-btn", { hasText: "Print size" }).click();
    await page.waitForTimeout(200);
    const printBox = await firstThumb.boundingBox();
    expect(printBox).not.toBeNull();
    expect(printBox!.width).toBeGreaterThan(270);
    expect(printBox!.width).toBeLessThan(295);

    // Toggle persists across reload.
    await page.reload();
    await page.waitForSelector(".gallery-workbench");
    await expect(
      page.locator(".fs-mode-btn-active", { hasText: "Print size" }),
    ).toBeVisible();
  });
});
