import { test, expect, type Page } from "@playwright/test";

// Covers two Browse-filter tweaks:
//  1. The More/Less collapse is gone — special-attr / Full Art / Foil chips are
//     always visible (no button to expand them).
//  2. The header count reads "showing X of Y": Y = the set+category universe,
//     X = what survives the refinement filters. Filters reduce what you see but
//     don't shrink the stated universe.

const header = (p: Page) => p.locator(".card-count");
const browseTab = (p: Page) =>
  p.locator(".app-nav-tabs .app-nav-tab", { hasText: "Browse" });

async function gotoBrowse(page: Page) {
  await page.goto("/");
  await page.locator(".app-nav").waitFor({ timeout: 10000 });
  await browseTab(page).click();
  await page.locator(".inline-filter-bar").waitFor({ timeout: 10000 });
}

test("filter chips are always visible, no More/Less button", async ({ page }) => {
  await gotoBrowse(page);

  // The expanded row (special attrs / Full Art / Foil) renders unconditionally.
  await expect(page.locator(".ifb-row-expanded")).toBeVisible();
  await expect(page.locator(".ifb-row-expanded .ifb-chip").first()).toBeVisible();

  // No More/Less toggle remains.
  await expect(
    page.locator(".inline-filter-bar button", { hasText: /^(More|Less)$/ }),
  ).toHaveCount(0);
});

test("header shows 'showing X of Y' once a refinement filter narrows the set", async ({
  page,
}) => {
  await gotoBrowse(page);

  // Pick a concrete universe: first real set + category Pokemon.
  const setSelect = page.locator(".ifb-select-wide");
  await setSelect.selectOption({ index: 1 });
  const categorySelect = page.locator(".ifb-select").nth(2); // era, set(wide), category
  await categorySelect.selectOption("Pokemon");

  // Wait for the universe to load and the count to settle on a real number.
  await expect(header(page)).toHaveText(/\d+ card/, { timeout: 15000 });

  // With no refinement yet, the label is a plain "N cards" — capture N = universe.
  const plain = await header(page).textContent();
  const universe = Number(plain!.match(/(\d+)\s+card/)![1]);
  expect(universe).toBeGreaterThan(0);

  // Apply a refinement filter (first real rarity) — it must shrink the visible set.
  const raritySelect = page.locator(".ifb-select").nth(3); // era, set, category, rarity
  await raritySelect.selectOption({ index: 1 });

  // Header flips to "showing X of Y": Y unchanged (the universe), X < Y.
  await expect(header(page)).toHaveText(/showing \d+ of \d+/, { timeout: 15000 });
  const refinedText = await header(page).textContent();
  const m = refinedText!.match(/showing (\d+) of (\d+)/)!;
  const shown = Number(m[1]);
  const total = Number(m[2]);
  expect(total).toBe(universe); // the universe didn't shrink…
  expect(shown).toBeLessThan(total); // …only what we see did
});
