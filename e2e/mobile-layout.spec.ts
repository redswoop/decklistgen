import { test, expect } from "@playwright/test";

const TEST_EMAIL = "claude@test.local";
const TEST_PASSWORD = "playwright-test-2024";

const MOBILE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 800 };

async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.removeItem("decklistgen-layout");
    localStorage.removeItem("decklistgen-decklist");
    localStorage.removeItem("decklistgen-deck-meta");
  });
  await page.reload();
  await page.waitForSelector(".auth-form", { timeout: 5000 });
  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.locator(".auth-submit").click();
  await page.waitForSelector(".app-nav", { timeout: 10000 });
}

test.describe("Mobile Layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await login(page);
  });

  test("sidebars are hidden on mobile viewport", async ({ page }) => {
    // Inline sidebar panes should not be visible
    await expect(page.locator(".layout-pane.layout-side")).toHaveCount(0);

    // Desktop expand buttons should be hidden
    await expect(page.locator(".expand-btn")).toHaveCount(0);

    // Layout dividers should be hidden
    await expect(page.locator(".layout-divider")).toHaveCount(0);

    // Center pane should fill the width
    const center = page.locator(".layout-center");
    await expect(center).toBeVisible();
    const box = await center.boundingBox();
    expect(box!.width).toBeGreaterThan(MOBILE.width * 0.9);
  });

  test("mobile nav buttons are visible", async ({ page }) => {
    const mobileButtons = page.locator(".mobile-nav-btn");
    await expect(mobileButtons).toHaveCount(2);
    await expect(mobileButtons.first()).toBeVisible();
    await expect(mobileButtons.last()).toBeVisible();
  });

  test("filter slide-over opens and closes", async ({ page }) => {
    // Click the filter button (first mobile-nav-btn)
    await page.locator(".mobile-nav-btn").first().click();

    // Slide-over and backdrop should appear
    await expect(page.locator(".mobile-slide-left")).toBeVisible();
    await expect(page.locator(".mobile-backdrop")).toBeVisible();

    // Sidebar content should be inside
    await expect(page.locator(".mobile-slide-left .sidebar")).toBeVisible();

    // Click backdrop to close
    await page.locator(".mobile-backdrop").click();
    await expect(page.locator(".mobile-slide-left")).toHaveCount(0);
    await expect(page.locator(".mobile-backdrop")).toHaveCount(0);
  });

  test("deck slide-over opens and closes", async ({ page }) => {
    // Click the deck button (second mobile-nav-btn)
    await page.locator(".mobile-nav-btn").last().click();

    // Slide-over should appear from right
    await expect(page.locator(".mobile-slide-right")).toBeVisible();
    await expect(page.locator(".mobile-backdrop")).toBeVisible();

    // Decklist panel should be inside
    await expect(page.locator(".mobile-slide-right .decklist-panel")).toBeVisible();

    // Click backdrop to close
    await page.locator(".mobile-backdrop").click();
    await expect(page.locator(".mobile-slide-right")).toHaveCount(0);
  });

  test("opening one slide-over closes the other", async ({ page }) => {
    // Open filter panel
    await page.locator(".mobile-nav-btn").first().click();
    await expect(page.locator(".mobile-slide-left")).toBeVisible();

    // Now open deck panel — filter should close
    await page.locator(".mobile-nav-btn").last().click();
    await expect(page.locator(".mobile-slide-right")).toBeVisible();
    await expect(page.locator(".mobile-slide-left")).toHaveCount(0);
  });

  test("card grid fills full width", async ({ page }) => {
    // Load some cards
    await page.locator(".app-nav-tab").filter({ hasText: "Browse" }).click();

    // Open filter panel, load an era, then close
    await page.locator(".mobile-nav-btn").first().click();
    const eraSelect = page.locator(".mobile-slide-left select").first();
    await eraSelect.selectOption("sv");
    // Close the panel
    await page.locator(".mobile-backdrop").click();

    // Wait for cards
    await page.waitForSelector(".card-tile", { timeout: 15000 });

    // Card grid should be approximately full width
    const center = page.locator(".layout-center");
    const box = await center.boundingBox();
    expect(box!.width).toBeGreaterThan(MOBILE.width * 0.9);
  });

  test("card add buttons are visible without hover on mobile", async ({ page }) => {
    await page.locator(".app-nav-tab").filter({ hasText: "Browse" }).click();

    // Open filter, load era, close
    await page.locator(".mobile-nav-btn").first().click();
    await page.locator(".mobile-slide-left select").first().selectOption("sv");
    await page.locator(".mobile-backdrop").click();
    await page.waitForSelector(".card-tile", { timeout: 15000 });

    // The add button should be visible without hovering
    const addBtn = page.locator(".card-add-btn").first();
    await expect(addBtn).toBeVisible();
    const opacity = await addBtn.evaluate((el) => getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBeGreaterThan(0.5);
  });
});

test.describe("Desktop Layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await login(page);
  });

  test("sidebars are visible on desktop", async ({ page }) => {
    // Both sidebar panes should be present
    const sidePanes = page.locator(".layout-pane.layout-side");
    await expect(sidePanes).toHaveCount(2);

    // Mobile nav buttons should be hidden
    await expect(page.locator(".mobile-nav-btn")).toHaveCount(0);
  });

  test("resize to mobile collapses sidebars, resize back restores", async ({ page }) => {
    // Start with sidebars visible
    await expect(page.locator(".layout-pane.layout-side")).toHaveCount(2);

    // Shrink to mobile
    await page.setViewportSize(MOBILE);
    await page.waitForTimeout(100); // Let matchMedia fire

    // Sidebars should be gone
    await expect(page.locator(".layout-pane.layout-side")).toHaveCount(0);
    await expect(page.locator(".mobile-nav-btn").first()).toBeVisible();

    // Expand back to desktop
    await page.setViewportSize(DESKTOP);
    await page.waitForTimeout(100);

    // Sidebars should be back
    await expect(page.locator(".layout-pane.layout-side")).toHaveCount(2);
    await expect(page.locator(".mobile-nav-btn")).toHaveCount(0);
  });
});
