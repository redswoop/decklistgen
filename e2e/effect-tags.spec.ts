import { test, expect, type Page } from "@playwright/test";

// Function tags ("what does this card do") in Browse: the chip row filters the
// grid and round-trips through the URL, the lightbox shows a card's tags, and
// "Group by → Function" buckets the grid by facet.

const browseTab = (p: Page) => p.locator(".app-nav-tabs .app-nav-tab", { hasText: "Browse" });
const tagChip = (p: Page, tag: string) => p.locator(`.ifb-row-tags .ifb-chip[data-effect-tag="${tag}"]`);

async function gotoBrowseSv(page: Page) {
  await page.goto("/");
  await page.locator(".app-nav").waitFor({ timeout: 10000 });
  await browseTab(page).click();
  await page.locator(".inline-filter-bar").waitFor({ timeout: 10000 });
  await page.locator(".ifb-select").first().selectOption("sv");
  await expect.poll(() => page.locator(".card-stack").count(), { timeout: 15000 }).toBeGreaterThan(0);
}

// "N cards" or "showing X of Y" → the number of cards currently shown.
async function shownCount(page: Page): Promise<number> {
  const txt = (await page.locator(".card-count").textContent())?.trim() ?? "";
  const m = txt.match(/showing (\d+) of/) ?? txt.match(/(\d+)\s+card/);
  return m ? Number(m[1]) : -1;
}

test("tag chips filter the grid, combine as AND, and sync to the URL", async ({ page }) => {
  await gotoBrowseSv(page);

  // Every registry tag has a chip — none hidden.
  await expect(page.locator(".ifb-row-tags .ifb-chip")).toHaveCount(26);

  await tagChip(page, "gust").click();
  await expect(tagChip(page, "gust")).toHaveClass(/active/);
  await expect.poll(() => page.url()).toContain("tags=gust");
  await expect(page.locator(".card-count")).toContainText("showing");
  await expect.poll(() => shownCount(page), { timeout: 10000 }).toBeGreaterThan(0);
  const gustCount = await shownCount(page);

  // A second tag narrows further: gust AND switch (Prime Catcher & co).
  await tagChip(page, "switch").click();
  await expect.poll(() => page.url()).toContain("tags=gust%2Cswitch");
  await expect.poll(() => shownCount(page), { timeout: 10000 }).toBeLessThan(gustCount);
  expect(await shownCount(page)).toBeGreaterThan(0);

  // The filter survives a reload via the URL.
  await page.reload();
  await page.locator(".inline-filter-bar").waitFor({ timeout: 10000 });
  await expect(tagChip(page, "gust")).toHaveClass(/active/);
  await expect(tagChip(page, "switch")).toHaveClass(/active/);
});

test("a tag id that no longer exists is dropped from a shared URL", async ({ page }) => {
  await page.goto("/?era=sv&tags=gust,search:trainer");
  await page.locator(".app-nav").waitFor({ timeout: 10000 });
  await browseTab(page).click();
  await page.locator(".inline-filter-bar").waitFor({ timeout: 10000 });
  await expect(tagChip(page, "gust")).toHaveClass(/active/);
  await expect(page.locator(".ifb-row-tags .ifb-chip.active")).toHaveCount(1);
  await expect.poll(() => shownCount(page), { timeout: 10000 }).toBeGreaterThan(0);
});

test("the lightbox shows a filtered card's function tags", async ({ page }) => {
  await gotoBrowseSv(page);
  await tagChip(page, "gust").click();
  await expect(page.locator(".card-count")).toContainText("showing");
  await expect.poll(() => page.locator(".card-stack").count(), { timeout: 10000 }).toBeGreaterThan(0);

  // Bottom-centre of the tile, clear of the corner controls.
  await page.locator(".card-thumb").first().click({ position: { x: 70, y: 150 } });
  await page.waitForSelector(".lb-modal", { timeout: 5000 });
  await expect(page.locator('.lb-effect-tag[data-effect-tag="gust"]')).toBeVisible();
});

test("chips stay visible but disabled where nothing is tagged yet", async ({ page }) => {
  await gotoBrowseSv(page);
  await expect(tagChip(page, "draw")).not.toHaveClass(/disabled/);

  // Category → Pokemon: only Supporters and Items are tagged so far.
  await page.locator(".ifb-select").nth(2).selectOption("Pokemon");
  await expect(tagChip(page, "draw")).toBeVisible();
  await expect(tagChip(page, "draw")).toHaveClass(/disabled/);
  await expect(tagChip(page, "draw")).toHaveAttribute("title", /only Supporters and Items/);
});

test("Group by Function buckets the grid by facet, in registry order", async ({ page }) => {
  await gotoBrowseSv(page);
  await page.locator(".ifb-select").nth(2).selectOption("Trainer");
  await expect.poll(() => page.locator(".card-stack").count(), { timeout: 10000 }).toBeGreaterThan(0);

  await page.locator(".sort-group-btn").click();
  await expect(page.locator(".sort-group-panel")).toBeVisible();
  await page.locator(".sort-group-section").nth(1).locator(".sort-group-option").filter({ hasText: "Function" }).click();
  await page.locator(".sort-group-backdrop").click({ position: { x: 5, y: 5 } });

  // The grid is virtualized, so only the first headers are mounted — Draw leads.
  await expect(page.locator(".group-header-label").first()).toHaveText("Draw");
});
