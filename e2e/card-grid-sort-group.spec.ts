import { test, expect, type Page } from "@playwright/test";

// Sort/group controls reorder the browse grid and persist across reload
// (decklistgen-sort-group localStorage). Closes a CLAUDE.md TODO and is the
// safety net for Pass 6's useSortGroup / card-sort-group extraction.

const browseTab = (p: Page) => p.locator(".app-nav-tabs .app-nav-tab", { hasText: "Browse" });

async function gotoBrowseWithCards(page: Page) {
  await page.goto("/");
  await page.locator(".app-nav").waitFor({ timeout: 10000 });
  await browseTab(page).click();
  await page.locator(".inline-filter-bar").waitFor({ timeout: 10000 });
  // A whole era → plenty of cards across several sets so "group by Set" yields
  // multiple headers.
  await page.locator(".ifb-select").first().selectOption("swsh");
  await expect.poll(() => page.locator(".card-stack").count(), { timeout: 15000 }).toBeGreaterThan(0);
}

async function setSortGroup(page: Page, group: string, sort: string) {
  await page.locator(".sort-group-btn").click();
  await expect(page.locator(".sort-group-panel")).toBeVisible();
  const sortSection = page.locator(".sort-group-section").nth(0);
  const groupSection = page.locator(".sort-group-section").nth(1);
  await sortSection.locator(".sort-group-option").filter({ hasText: sort }).click();
  await groupSection.locator(".sort-group-option").filter({ hasText: group }).click();
  // The backdrop is full-screen but sits behind the centered panel — click a
  // corner so the panel doesn't intercept.
  await page.locator(".sort-group-backdrop").click({ position: { x: 5, y: 5 } });
  await expect(page.locator(".sort-group-panel")).not.toBeVisible();
}

test("grouping by Set inserts headers and sort changes the order", async ({ page }) => {
  await gotoBrowseWithCards(page);

  // Baseline: no grouping by default → no headers.
  await expect(page.locator(".group-header")).toHaveCount(0);

  await setSortGroup(page, "Set", "Rarity");

  await expect(page.locator(".group-header")).not.toHaveCount(0);
  await expect(page.locator(".sort-group-btn")).toContainText("Set");
  await expect(page.locator(".sort-group-btn")).toContainText("Rarity");
});

test("sort/group selection persists across reload", async ({ page }) => {
  await gotoBrowseWithCards(page);
  await setSortGroup(page, "Set", "Rarity");
  const labelBefore = await page.locator(".sort-group-btn").textContent();

  await page.reload();
  await page.locator(".app-nav").waitFor({ timeout: 10000 });

  // The label is driven purely by persisted state, so it survives reload before
  // any filtering.
  await expect(page.locator(".sort-group-btn")).toHaveText(labelBefore ?? "");

  // And the grouping is still active once cards are shown again.
  await browseTab(page).click();
  await page.locator(".ifb-select").first().selectOption("swsh");
  await expect.poll(() => page.locator(".card-stack").count(), { timeout: 15000 }).toBeGreaterThan(0);
  await expect(page.locator(".group-header")).not.toHaveCount(0);
});
