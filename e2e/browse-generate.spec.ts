import { test, expect, type Page } from "@playwright/test";

// Verifies the browse-screen Generate button safeguards:
// - Button is always rendered (no v-if hiding per UX rules).
// - Disabled for anonymous users with the "Sign in to generate" tooltip.
// - Selection checkboxes appear on tiles in browse mode.
// - The "force regenerate" + typed-confirm dialog logic is covered by the
//   browse-generate-gating.test.ts unit test; this e2e covers the wired UI.

async function openBrowseWithCards(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.removeItem("decklistgen-layout");
    localStorage.removeItem("decklistgen-decklist");
    localStorage.removeItem("decklistgen-deck-meta");
    localStorage.removeItem("decklistgen-sort-group");
  });
  await page.reload();
  await page.waitForSelector(".app-nav", { timeout: 10_000 });

  // Browse is the default view. Trigger an era load to populate the grid.
  const meBtn = page.locator(".welcome-btn-me");
  if (await meBtn.isVisible().catch(() => false)) {
    await meBtn.click();
  }
  // Wait for at least one tile.
  await page.waitForSelector(".card-thumb", { timeout: 30_000 });
}

test.describe("Browse Generate button — anonymous safeguards", () => {
  test("button is rendered and disabled with sign-in tooltip", async ({ page }) => {
    test.setTimeout(60_000);
    await openBrowseWithCards(page);

    const btn = page.locator('[data-testid="browse-generate-btn"]');
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveAttribute("title", /Sign in to generate/i);
  });

  test("selection checkboxes toggle, but button stays disabled for anonymous", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await openBrowseWithCards(page);

    const firstCheckbox = page.locator(".card-thumb-checkbox input[type='checkbox']").first();
    await expect(firstCheckbox).toBeVisible();
    await firstCheckbox.click();

    const btn = page.locator('[data-testid="browse-generate-btn"]');
    await expect(btn).toBeDisabled();
    // Tooltip remains the sign-in nudge — auth check beats count check.
    await expect(btn).toHaveAttribute("title", /Sign in to generate/i);
  });

  test("clicking a disabled Generate button does not open the dialog", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await openBrowseWithCards(page);

    const btn = page.locator('[data-testid="browse-generate-btn"]');
    // Force a click even though it's disabled — Playwright respects pointer-events
    // but we want to confirm the dialog stays closed regardless.
    await btn.click({ force: true }).catch(() => undefined);
    await expect(page.locator('[data-testid="browse-gen-confirm"]')).toHaveCount(0);
  });
});
