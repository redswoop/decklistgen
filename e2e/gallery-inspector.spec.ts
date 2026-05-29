import { test, expect } from "@playwright/test";

const TEST_EMAIL = "claude@test.local";
const TEST_PASSWORD = "playwright-test-2024";

async function login(page: import("@playwright/test").Page, opts: { authenticate?: boolean } = {}) {
  if (opts.authenticate) {
    // API login sets the session cookie; subsequent page load is authenticated.
    await page.context().request.post("/api/auth/login", {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
  }
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.removeItem("decklistgen-layout");
    localStorage.removeItem("decklistgen-gallery-selected");
  });
  await page.waitForSelector(".app-nav", { timeout: 10000 });
}

test.describe("Gallery inspector (right rail)", () => {
  test("fleet overview shows when nothing selected, inspector takes over on click", async ({ page }) => {
    await login(page);
    await page.locator(".app-nav-tab", { hasText: "Gallery" }).click();
    await page.waitForSelector(".gallery-workbench");

    // Empty state: fleet overview is rendered
    await expect(page.locator(".overview-head", { hasText: "Fleet overview" })).toBeVisible();
    // No modal lightbox exists anymore
    await expect(page.locator(".lb-overlay")).toHaveCount(0);

    // Click first thumb → inspector replaces overview, thumb gets selected outline
    const firstThumb = page.locator(".svg-thumb").first();
    await firstThumb.click();
    await expect(page.locator(".inspector")).toBeVisible();
    await expect(page.locator(".overview")).toHaveCount(0);
    await expect(firstThumb).toHaveClass(/svg-thumb-selected/);

    // Inspector tabs: Proxy active by default
    await expect(page.locator(".inspector-tab-active", { hasText: "Proxy" })).toBeVisible();

    // Inspector renders card metadata
    await expect(page.locator(".inspector-section-title", { hasText: "Card data" })).toBeVisible();

    // Deselect via close button → fleet overview is back
    await page.locator(".inspector-close").click();
    await expect(page.locator(".overview-head", { hasText: "Fleet overview" })).toBeVisible();
    await expect(firstThumb).not.toHaveClass(/svg-thumb-selected/);
  });

  test("deck cards appear in the gallery; reference fallbacks tagged", async ({ page }) => {
    // First visit just to seed localStorage in the right origin.
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("decklistgen-layout");
      localStorage.removeItem("decklistgen-gallery-selected");
      // Stub a one-card deck before useDecklist initializes.
      const item = {
        setCode: "sv01",
        localId: "001",
        count: 1,
        name: "Sprigatito",
        imageUrl: "https://example.com/sv01-001/low.png",
        card: {
          id: "sv01-001",
          localId: "001",
          name: "Sprigatito",
          setCode: "sv01",
          imageBase: "https://example.com/sv01-001",
          category: "Pokemon",
          stage: "Basic",
          hp: 40,
          energyTypes: ["Grass"],
        },
      };
      localStorage.setItem("decklistgen-decklist", JSON.stringify([item]));
    });
    // Full reload so useDecklist re-initializes against the seeded storage.
    await page.reload();
    await page.waitForSelector(".app-nav");
    await page.locator(".app-nav-tab", { hasText: "Gallery" }).click();
    await page.waitForSelector(".gallery-workbench", { timeout: 10000 });

    // Wait for the deck-cards query to settle.
    await page.waitForTimeout(2000);

    // At least one REFERENCE badge should appear (gap-filler templates).
    const referenceBadges = page.locator(".svg-thumb-badge-reference");
    expect(await referenceBadges.count()).toBeGreaterThan(0);

    // The deck card (sv01-001) should be rendered without a REFERENCE badge.
    const deckThumb = page.locator(".svg-thumb", {
      has: page.locator(".svg-thumb-id", { hasText: "sv01-001" }),
    }).first();
    await expect(deckThumb).toBeVisible({ timeout: 5000 });
    await expect(deckThumb.locator(".svg-thumb-badge-reference")).toHaveCount(0);

    // Cleanup: clear the stubbed deck.
    await page.evaluate(() => localStorage.removeItem("decklistgen-decklist"));
  });

  test("arrow keys step selection; Esc deselects", async ({ page }) => {
    await login(page);
    await page.locator(".app-nav-tab", { hasText: "Gallery" }).click();
    await page.waitForSelector(".gallery-workbench");

    const firstThumb = page.locator(".svg-thumb").first();
    await firstThumb.click();
    const firstId = await firstThumb.locator(".svg-thumb-id").textContent();
    await expect(page.locator(".inspector")).toBeVisible();

    // ArrowRight moves selection to the next thumb.
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(150);
    const selectedId = await page
      .locator(".svg-thumb.svg-thumb-selected .svg-thumb-id")
      .textContent();
    expect(selectedId).not.toBe(firstId);

    // Esc clears selection — fleet overview returns.
    await page.keyboard.press("Escape");
    await expect(page.locator(".overview-head", { hasText: "Fleet overview" })).toBeVisible();
  });

  test("selection persists across reload", async ({ page }) => {
    await login(page);
    await page.locator(".app-nav-tab", { hasText: "Gallery" }).click();
    await page.waitForSelector(".gallery-workbench");

    const firstThumb = page.locator(".svg-thumb").first();
    await firstThumb.click();
    await expect(page.locator(".inspector")).toBeVisible();

    await page.reload();
    await page.waitForSelector(".gallery-workbench");
    await expect(page.locator(".inspector")).toBeVisible({ timeout: 10000 });
  });
});
