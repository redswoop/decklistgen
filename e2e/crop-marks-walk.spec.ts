import { test, expect } from "@playwright/test";

const IDS = [
  "me01-001", "me01-002", "me01-003", "me01-004", "me01-005",
  "me01-006", "me01-007", "me01-008", "me01-009", "me01-010",
  "me01-011", "me01-012", "me01-013", "me01-014",
];

test("print sheet renders crop marks and paginates", async ({ page }) => {
  await page.goto("/print.html");
  await page.evaluate((ids) => {
    sessionStorage.setItem("gallery-print-ids", JSON.stringify(ids));
  }, IDS);

  await page.goto("/print.html?gallery=1&art=original");
  await page.waitForSelector(".print-page-sheet", { timeout: 30000 });

  const sheets = page.locator(".print-page-sheet");
  await expect(sheets).toHaveCount(2); // 14 cards, 9/sheet → 2 pages

  // Crop-mark SVG present on each sheet.
  await expect(page.locator(".crop-marks")).toHaveCount(2);

  // Page 1 full grid (3×3 = 9 cells), page 2 partial (5 cells).
  await expect(sheets.nth(0).locator(".print-cell")).toHaveCount(9);
  await expect(sheets.nth(1).locator(".print-cell")).toHaveCount(5);

  // Each crop-marks SVG holds line segments.
  const lineCount = await page.locator(".crop-marks line").count();
  expect(lineCount).toBeGreaterThan(0);
});

test("crop=0 disables the marks", async ({ page }) => {
  await page.goto("/print.html");
  await page.evaluate((ids) => {
    sessionStorage.setItem("gallery-print-ids", JSON.stringify(ids));
  }, IDS);

  await page.goto("/print.html?gallery=1&art=original&crop=0");
  await page.waitForSelector(".print-page-sheet", { timeout: 30000 });
  await expect(page.locator(".crop-marks")).toHaveCount(0);
});
