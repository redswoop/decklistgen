import { test, expect, type Page } from "@playwright/test";

// Verifies the browse-grid reprint folding:
//  - same-art reprints collapse into one stacked tile with a ×N badge
//  - the "Stack reprints" toggle unfolds them and persists across reload
//  - clicking a stack opens the lightbox

const browseTab = (p: Page) =>
  p.locator(".app-nav-tabs .app-nav-tab", { hasText: "Browse" });

// Sword & Shield era, Holo Rare V rarity, name search "Morpeko". Three Holo
// Rare V Morpeko V exist; two share an illustrator and fold, the third (no
// illustrator data) stays its own tile → 2 tiles, one of them a ×2 stack.
async function applyMorpekoFilters(page: Page) {
  await page.locator(".ifb-select").first().selectOption("swsh");
  await page.locator(".inline-filter-bar select", { hasText: "Any Rarity" })
    .selectOption("Holo Rare V");
  await page.locator(".grid-search").fill("Morpeko");
  // Wait for the search debounce + query to narrow the grid to the Morpeko set.
  await expect.poll(() => page.locator(".card-stack").count(), { timeout: 15000 })
    .toBeLessThanOrEqual(4);
}

async function gotoMorpeko(page: Page) {
  await page.goto("/");
  await page.locator(".app-nav").waitFor({ timeout: 10000 });
  await browseTab(page).click();
  await page.locator(".inline-filter-bar").waitFor({ timeout: 10000 });
  await applyMorpekoFilters(page);
}

test("same-art Morpeko V reprints fold into one ×2 stack", async ({ page }) => {
  await gotoMorpeko(page);

  const stacked = page.locator(".card-stack-multi");
  await expect(stacked.first()).toBeVisible();
  await expect(stacked.first().locator(".card-stack-badge")).toContainText("2");

  // Toggle off → reprints unfold, no stack chrome remains.
  await page.locator(".stack-toggle-btn").click();
  await expect(page.locator(".card-stack-multi")).toHaveCount(0);

  // Persist across reload: re-apply the same narrow view; the toggle stayed off.
  await page.reload();
  await page.locator(".inline-filter-bar").waitFor({ timeout: 10000 });
  await applyMorpekoFilters(page);
  await expect(page.locator(".card-stack-multi")).toHaveCount(0);

  // Turn it back on → the ×2 stack reappears.
  await page.locator(".stack-toggle-btn").click();
  await expect(page.locator(".card-stack-multi").first()).toBeVisible();
});

test("clicking a stack opens the lightbox", async ({ page }) => {
  await gotoMorpeko(page);
  await page.locator(".card-stack-multi").first().click();
  await expect(page.locator(".lb-modal")).toBeVisible({ timeout: 10000 });
});

test("folds reprints whose illustrator metadata is missing (Mimikyu V BST/BRS)", async ({ page }) => {
  await page.goto("/");
  await page.locator(".app-nav").waitFor({ timeout: 10000 });
  await browseTab(page).click();
  await page.locator(".inline-filter-bar").waitFor({ timeout: 10000 });

  await page.locator(".ifb-select").first().selectOption("swsh");
  await page.locator(".inline-filter-bar select", { hasText: "Any Rarity" })
    .selectOption("Holo Rare V");
  await page.locator(".grid-search").fill("Mimikyu");
  await page.locator(".card-stack").first().waitFor({ timeout: 15000 });

  // BST 62 (has illustrator) + BRS 68 (blank illustrator) share name/mechanics/
  // tier → one ×2 stack even though one printing lacks illustrator data.
  const stacked = page.locator(".card-stack-multi");
  await expect(stacked.first()).toBeVisible();
  await expect(stacked.first().locator(".card-stack-badge")).toContainText("2");
});
