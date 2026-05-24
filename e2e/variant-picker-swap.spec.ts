import { test, expect, type Page } from "@playwright/test";

// Regression test for the variant-picker duplicate-stack bug.
//
// The bug: decrementing one variant and incrementing another (a "swap"
// workflow) used to push a sibling entry into the working deck under the
// activeCard's setCode/localId, producing two stacks of the same base card
// in the deck view. After the fix, +/- on a variant operates on the
// variant's own identity — distinct printings appear as distinct stacks.

const SEED_SET = "PFL";
const SEED_ID = "011";
const SWAP_SET = "ASC";
const SWAP_ID = "020";

async function openWorkingDeck(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.removeItem("decklistgen-decklist");
    localStorage.removeItem("decklistgen-deck-meta");
    localStorage.removeItem("decklistgen-sort-group");
  });
  await page.reload();

  // App nav is always present; auth form only appears if explicitly opened.
  await page.waitForSelector(".app-nav", { timeout: 10_000 });

  // Navigate to Deck tab, then click "New Deck" to enter the working-deck workspace.
  await page.locator(".app-nav-tab").filter({ hasText: "Deck" }).click();
  await page
    .locator(".deck-gallery-btn, .deck-gallery-card-new")
    .first()
    .click();
  await page.waitForSelector(".grid-search", { timeout: 10_000 });
}

async function searchAndAdd(
  page: Page,
  query: string,
  setCode: string,
  localId: string,
) {
  const searchInput = page.locator(".grid-search");
  await searchInput.fill(query);
  await page.waitForSelector(".grid-search-dropdown", { timeout: 8_000 });

  const allResults = page.locator(".grid-search-result");
  const count = await allResults.count();
  for (let i = 0; i < count; i++) {
    const setText = await allResults
      .nth(i)
      .locator(".grid-search-result-set")
      .textContent();
    if (setText?.trim() === `${setCode} ${localId}`) {
      await allResults.nth(i).click();
      await expect(page.locator(".grid-search-dropdown")).not.toBeVisible({
        timeout: 3_000,
      });
      return;
    }
  }
  throw new Error(`No search result for "${setCode} ${localId}"`);
}

function findTile(page: Page, setCode: string, localId: string) {
  return page.locator(".card-thumb").filter({
    has: page.locator(".card-thumb-label", {
      hasText: `${setCode} #${localId}`,
    }),
  });
}

function findVariantTile(page: Page, setCode: string, localId: string) {
  return page.locator(".lb-variants-grid .card-thumb").filter({
    has: page.locator(".card-thumb-label", {
      hasText: `${setCode} #${localId}`,
    }),
  });
}

test.describe("Variant picker — swap workflow", () => {
  test.beforeEach(async ({ page }) => {
    await openWorkingDeck(page);
  });

  test("decrement seeded + increment another yields two distinct stacks", async ({
    page,
  }) => {
    test.setTimeout(45_000);

    // Seed the working deck with PFL #011 Charmander, count 2.
    await searchAndAdd(page, "Charmander", SEED_SET, SEED_ID);
    await findTile(page, SEED_SET, SEED_ID).locator(".card-thumb-plus").click();
    await expect(
      findTile(page, SEED_SET, SEED_ID).locator(".card-thumb-badge"),
    ).toContainText("2");
    await expect(page.locator(".card-count")).toContainText("1 unique · 2/60");

    // Open lightbox by clicking the card image (avoid the inline +/-).
    await findTile(page, SEED_SET, SEED_ID).click({
      position: { x: 70, y: 150 },
    });
    await page.waitForSelector(".lb-modal", { timeout: 5_000 });
    await expect(page.locator(".lb-title")).toContainText("Charmander");
    await expect(page.locator(".lb-variants-grid")).toBeVisible({
      timeout: 8_000,
    });

    // Click - on PFL #011 (count 2 → 1).
    const seedPicker = findVariantTile(page, SEED_SET, SEED_ID);
    await expect(seedPicker).toBeVisible({ timeout: 5_000 });
    await seedPicker.locator(".card-thumb-minus").click();
    await expect(seedPicker.locator(".card-thumb-badge")).toContainText("1", {
      timeout: 3_000,
    });

    // Click + on ASC #020 (a different printing of the same Pokemon).
    const swapPicker = findVariantTile(page, SWAP_SET, SWAP_ID);
    await expect(swapPicker).toBeVisible({ timeout: 5_000 });
    await swapPicker.locator(".card-thumb-plus").click();

    // Regression assertion: ASC's badge must update to 1 (was the bug —
    // it stayed at 0 because the new entry was filed under PFL's identity).
    await expect(swapPicker.locator(".card-thumb-badge")).toContainText("1", {
      timeout: 3_000,
    });

    // Close the lightbox.
    await page.locator(".lightbox-close").click();
    await expect(page.locator(".lb-modal")).not.toBeVisible({ timeout: 3_000 });

    // Deck holds two distinct stacks: PFL #011 (count 1) + ASC #020 (count 1).
    // Was the bug: deck would render two PFL #011 stacks (one with each art).
    await expect(findTile(page, SEED_SET, SEED_ID)).toBeVisible();
    await expect(findTile(page, SWAP_SET, SWAP_ID)).toBeVisible();
    await expect(
      findTile(page, SEED_SET, SEED_ID).locator(".card-thumb-badge"),
    ).toContainText("1");
    await expect(
      findTile(page, SWAP_SET, SWAP_ID).locator(".card-thumb-badge"),
    ).toContainText("1");
    await expect(page.locator(".card-count")).toContainText(
      "2 unique · 2/60 total",
    );

    // Belt-and-suspenders: no two visible tiles share a base-card label.
    const labels = await page.locator(".card-thumb-label").allTextContents();
    const trimmed = labels.map((l) => l.trim()).filter(Boolean);
    const uniqueLabels = new Set(trimmed);
    expect(uniqueLabels.size).toBe(trimmed.length);
  });

  test("variant picker badge updates on the picker tile after +", async ({
    page,
  }) => {
    test.setTimeout(30_000);

    await searchAndAdd(page, "Charmander", SEED_SET, SEED_ID);

    await findTile(page, SEED_SET, SEED_ID).click({
      position: { x: 70, y: 150 },
    });
    await page.waitForSelector(".lb-modal", { timeout: 5_000 });
    await expect(page.locator(".lb-variants-grid")).toBeVisible({
      timeout: 8_000,
    });

    // The seeded variant's picker badge should already show 1.
    const seedPicker = findVariantTile(page, SEED_SET, SEED_ID);
    await expect(seedPicker.locator(".card-thumb-badge")).toContainText("1");

    // Click + on a different printing.
    const swapTile = findVariantTile(page, SWAP_SET, SWAP_ID);
    await expect(swapTile).toBeVisible({ timeout: 5_000 });
    await swapTile.locator(".card-thumb-plus").click();

    // Picker badge for the just-added variant ticks up to 1 (regression
    // assertion for the badge-not-updating symptom).
    await expect(swapTile.locator(".card-thumb-badge")).toContainText("1", {
      timeout: 3_000,
    });

    // And the seeded variant's badge stays at 1, not bumped sideways.
    await expect(seedPicker.locator(".card-thumb-badge")).toContainText("1");

    await page.locator(".lightbox-close").click();
  });

  test("swap action migrates all copies to the picked printing in one click", async ({
    page,
  }) => {
    test.setTimeout(45_000);

    // Seed PFL #011 with count 3.
    await searchAndAdd(page, "Charmander", SEED_SET, SEED_ID);
    for (let i = 0; i < 2; i++) {
      await findTile(page, SEED_SET, SEED_ID).locator(".card-thumb-plus").click();
    }
    await expect(
      findTile(page, SEED_SET, SEED_ID).locator(".card-thumb-badge"),
    ).toContainText("3");
    await expect(page.locator(".card-count")).toContainText("1 unique · 3/60");

    // Open lightbox on PFL #011.
    await findTile(page, SEED_SET, SEED_ID).click({ position: { x: 70, y: 150 } });
    await page.waitForSelector(".lb-modal", { timeout: 5_000 });
    await expect(page.locator(".lb-variants-grid")).toBeVisible({ timeout: 8_000 });

    // The swap action is hidden on the active card's own tile but visible on
    // other variants.
    const seedPicker = findVariantTile(page, SEED_SET, SEED_ID);
    const swapPicker = findVariantTile(page, SWAP_SET, SWAP_ID);
    await expect(seedPicker.locator(".card-thumb-action-swap")).toHaveCount(0);
    await expect(swapPicker.locator(".card-thumb-action-swap")).toBeVisible();

    // Click swap on ASC #020 → all 3 copies migrate.
    await swapPicker.locator(".card-thumb-action-swap").click();

    // The picker badges update: PFL drops to 0 (no badge), ASC shows 3.
    await expect(swapPicker.locator(".card-thumb-badge")).toContainText("3", {
      timeout: 3_000,
    });

    // Close → onUnmounted sweeps the zero-count PFL entry.
    await page.locator(".lightbox-close").click();
    await expect(page.locator(".lb-modal")).not.toBeVisible({ timeout: 3_000 });

    // Deck holds exactly one stack: ASC #020 with count 3.
    await expect(findTile(page, SWAP_SET, SWAP_ID)).toBeVisible();
    await expect(findTile(page, SEED_SET, SEED_ID)).toHaveCount(0);
    await expect(page.locator(".card-count")).toContainText(
      "1 unique · 3/60 total",
    );
  });
});
