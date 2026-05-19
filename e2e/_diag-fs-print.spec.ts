import { test } from "@playwright/test";
test("save while in print mode", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".auth-form", { timeout: 5000 }).catch(() => {});
  const auth = await page.locator(".auth-form").isVisible().catch(() => false);
  if (auth) {
    await page.locator('input[type="email"]').fill("claude@test.local");
    await page.locator('input[type="password"]').fill("playwright-test-2024");
    await page.locator(".auth-submit").click();
  }
  await page.waitForSelector(".app-nav");
  await page.locator(".app-nav-tab", { hasText: "Gallery" }).click();
  await page.locator(".tab", { hasText: "Font Sizes" }).click();
  await page.waitForSelector(".fs-preview-grid .svg-thumb svg", { timeout: 10000 });

  // Switch to Print size
  await page.locator(".fs-mode-btn", { hasText: "Print size" }).click();
  await page.waitForTimeout(500);

  // Edit footer
  const rows = page.locator(".fs-table tbody tr");
  const count = await rows.count();
  let footerRowIdx = -1;
  for (let i = 0; i < count; i++) {
    const tok = await rows.nth(i).locator(".fs-token").textContent();
    if (tok?.trim() === "footer") { footerRowIdx = i; break; }
  }
  const footerInput = rows.nth(footerRowIdx).locator("input[type=number]");
  console.log("Save disabled before edit:", await page.locator(".btn-save-fs").first().isDisabled());
  await footerInput.fill("99");
  await footerInput.dispatchEvent("input");
  console.log("Save disabled after edit:", await page.locator(".btn-save-fs").first().isDisabled());

  // Capture before-save first-thumb font sizes
  const before = await page.evaluate(() => {
    const svg = document.querySelector(".fs-preview-grid .svg-thumb svg");
    return svg ? Array.from(svg.outerHTML.matchAll(/font-size="([0-9.]+)"/g)).map(m => m[1]) : [];
  });
  console.log("Before save font sizes (thumb 1):", before);

  await page.locator(".btn-save-fs").first().click();
  await page.waitForFunction(
    () => document.querySelector(".fs-status")?.textContent?.includes("Saved"),
    { timeout: 10000 },
  ).catch(() => console.log("did not see Saved"));
  await page.waitForTimeout(2500);

  const after = await page.evaluate(() => {
    const svg = document.querySelector(".fs-preview-grid .svg-thumb svg");
    return svg ? Array.from(svg.outerHTML.matchAll(/font-size="([0-9.]+)"/g)).map(m => m[1]) : [];
  });
  console.log("After save font sizes (thumb 1):", after);
  console.log("Has 99?", after.includes("99"));

  // Reset
  await page.locator(".btn-reset-fs").first().click();
});
