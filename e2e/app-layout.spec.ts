import { test, expect, type Page } from "@playwright/test";

// App.vue layout control: the right sidebar (DeckContextPanel, browse view) can
// be collapsed and expanded, and the collapsed state persists across reload
// (decklistgen-layout localStorage). This is the safety net for Pass 8's
// useLayoutControl extraction. Runs at the default desktop viewport.

const browseTab = (p: Page) => p.locator(".app-nav-tabs .app-nav-tab", { hasText: "Browse" });

async function gotoBrowse(page: Page) {
  await page.goto("/");
  await page.locator(".app-nav").waitFor({ timeout: 10000 });
  await browseTab(page).click();
}

test("right sidebar collapses, expands, and persists collapsed across reload", async ({ page }) => {
  await gotoBrowse(page);

  // The deck context panel is visible by default on browse.
  const collapseBtn = page.locator(".dcp-collapse-btn");
  await expect(collapseBtn).toBeVisible();
  await expect(page.locator(".expand-btn-right")).toHaveCount(0);

  // Collapse → the expand affordance appears and the panel's collapse button goes.
  await collapseBtn.click();
  await expect(page.locator(".expand-btn-right")).toBeVisible();
  await expect(collapseBtn).toHaveCount(0);

  // Persisted across reload.
  await page.reload();
  await page.locator(".app-nav").waitFor({ timeout: 10000 });
  await browseTab(page).click();
  await expect(page.locator(".expand-btn-right")).toBeVisible();

  // Expand again restores the panel.
  await page.locator(".expand-btn-right").click();
  await expect(page.locator(".dcp-collapse-btn")).toBeVisible();
  await expect(page.locator(".expand-btn-right")).toHaveCount(0);
});
