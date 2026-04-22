import { test, expect, type Page } from "@playwright/test";

const TEST_EMAIL = "claude@test.local";
const TEST_PASSWORD = "playwright-test-2024";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function login(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.removeItem("decklistgen-decklist");
    localStorage.removeItem("decklistgen-deck-meta");
    localStorage.removeItem("decklistgen-sort-group");
  });
  await page.reload();

  // The app may already be logged in (session cookie) or may show auth form.
  const appNav = page.locator(".app-nav");
  const authForm = page.locator(".auth-form");

  const which = await Promise.race([
    appNav.waitFor({ timeout: 10000 }).then(() => "app" as const),
    authForm.waitFor({ timeout: 10000 }).then(() => "auth" as const),
  ]);

  if (which === "auth") {
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.locator(".auth-submit").click();
    await appNav.waitFor({ timeout: 10000 });
  }
}

/** Search for a card by name and click the matching result in the dropdown. */
async function searchAndAdd(
  page: Page,
  query: string,
  setCode: string,
  localId: string,
) {
  const searchInput = page.locator(".grid-search");
  await searchInput.fill(query);
  await page.waitForSelector(".grid-search-dropdown", { timeout: 8000 });

  // Find the result whose set label matches exactly
  const allResults = page.locator(".grid-search-result");
  const count = await allResults.count();
  let matched = false;
  for (let i = 0; i < count; i++) {
    const setText = await allResults
      .nth(i)
      .locator(".grid-search-result-set")
      .textContent();
    if (setText?.trim() === `${setCode} ${localId}`) {
      await allResults.nth(i).click();
      matched = true;
      break;
    }
  }

  if (!matched) {
    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      texts.push(
        (await allResults
          .nth(i)
          .locator(".grid-search-result-set")
          .textContent()) ?? "",
      );
    }
    throw new Error(
      `No search result for "${setCode} ${localId}". Available: [${texts.join(", ")}]`,
    );
  }

  // Dropdown should close after selection
  await expect(page.locator(".grid-search-dropdown")).not.toBeVisible({
    timeout: 3000,
  });
}

/** Find a card tile in the deck grid by its set label (e.g. "PAF #007"). */
function findTile(page: Page, setCode: string, localId: string) {
  return page.locator(".card-thumb").filter({
    has: page.locator(".card-thumb-label", {
      hasText: `${setCode} #${localId}`,
    }),
  });
}

/** Click the + button on a tile N times. */
async function incrementTile(
  page: Page,
  setCode: string,
  localId: string,
  times: number,
) {
  const tile = findTile(page, setCode, localId);
  const plusBtn = tile.locator(".card-thumb-plus");
  for (let i = 0; i < times; i++) {
    await plusBtn.click();
  }
}

/** Click the - button on a tile once. */
async function decrementTile(page: Page, setCode: string, localId: string) {
  const tile = findTile(page, setCode, localId);
  await tile.locator(".card-thumb-minus").click();
}

/** Assert the card count header label. */
async function assertCount(page: Page, unique: number, total: number) {
  await expect(page.locator(".card-count")).toContainText(
    `${unique} unique · ${total}/60 total`,
  );
}

/** Assert the count badge on a specific tile. */
async function assertTileCount(
  page: Page,
  setCode: string,
  localId: string,
  count: number,
) {
  const tile = findTile(page, setCode, localId);
  await expect(tile.locator(".card-thumb-badge")).toContainText(String(count));
}

/**
 * Open lightbox on a card tile, find a specific variant in the variant grid,
 * click + to add it, then close the lightbox.
 */
async function addVariantViaLightbox(
  page: Page,
  tileSetCode: string,
  tileLocalId: string,
  variantSetCode: string,
  variantLocalId: string,
) {
  const tile = findTile(page, tileSetCode, tileLocalId);
  await tile.click();
  await page.waitForSelector(".lb-modal", { timeout: 5000 });

  const variantTile = page.locator(".lb-variants-grid .card-thumb").filter({
    has: page.locator(".card-thumb-label", {
      hasText: `${variantSetCode} #${variantLocalId}`,
    }),
  });
  await expect(variantTile).toBeVisible({ timeout: 8000 });
  await variantTile.locator(".card-thumb-plus").click();

  await page.locator(".lightbox-close").click();
  await expect(page.locator(".lb-modal")).not.toBeVisible({ timeout: 3000 });
}

// ---------------------------------------------------------------------------
// Tests — serial phases sharing a single page
// ---------------------------------------------------------------------------

test.describe.serial("Full 60-Card Deck Build", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.evaluate(() => {
      localStorage.removeItem("decklistgen-decklist");
      localStorage.removeItem("decklistgen-deck-meta");
      localStorage.removeItem("decklistgen-sort-group");
    });
    await page.close();
  });

  // -----------------------------------------------------------------------
  // Phase 0: Setup — login and navigate to WorkingDeckView
  // -----------------------------------------------------------------------
  test("Phase 0: login and navigate to empty working deck", async () => {
    test.setTimeout(30_000);

    await login(page);

    // Navigate to Deck tab
    await page.locator(".app-nav-tab").filter({ hasText: "Deck" }).click();

    // Click "New Deck" to enter WorkingDeckView
    await page
      .locator(".deck-gallery-btn, .deck-gallery-card-new")
      .first()
      .click();

    // Wait for the working deck search input
    await page.waitForSelector(".grid-search", { timeout: 5000 });

    // Verify empty state
    await expect(page.locator(".dm-welcome")).toBeVisible();
    await assertCount(page, 0, 0);
  });

  // -----------------------------------------------------------------------
  // Phase 1: Add first 3 cards via search
  // -----------------------------------------------------------------------
  test("Phase 1: add initial Pokemon via search", async () => {
    test.setTimeout(30_000);

    await searchAndAdd(page, "Charmander", "PAF", "007");
    await searchAndAdd(page, "Charmeleon", "PFL", "012");
    await searchAndAdd(page, "Charizard", "OBF", "125");

    await assertCount(page, 3, 3);
  });

  // -----------------------------------------------------------------------
  // Phase 2: Increment counts using inline +/- controls
  // -----------------------------------------------------------------------
  test("Phase 2: increment card counts with inline controls", async () => {
    test.setTimeout(15_000);

    await incrementTile(page, "PAF", "007", 1); // Charmander → 2
    await incrementTile(page, "PFL", "012", 1); // Charmeleon → 2
    await incrementTile(page, "OBF", "125", 1); // Charizard ex → 2

    await assertCount(page, 3, 6);
    await assertTileCount(page, "PAF", "007", 2);
    await assertTileCount(page, "PFL", "012", 2);
    await assertTileCount(page, "OBF", "125", 2);
  });

  // -----------------------------------------------------------------------
  // Phase 3: Undo / redo
  // -----------------------------------------------------------------------
  test("Phase 3: undo and redo card count change", async () => {
    test.setTimeout(15_000);

    // Click body to ensure focus isn't on an input (undo ignores input elements)
    await page.locator(".card-grid-wrapper").click();

    // Undo: Charizard ex goes from 2 → 1
    await page.keyboard.press("Meta+z");
    await assertTileCount(page, "OBF", "125", 1);
    await assertCount(page, 3, 5);

    // Redo: Charizard ex goes back to 2
    await page.keyboard.press("Meta+Shift+z");
    await assertTileCount(page, "OBF", "125", 2);
    await assertCount(page, 3, 6);
  });

  // -----------------------------------------------------------------------
  // Phase 4: Add a variant via lightbox
  // -----------------------------------------------------------------------
  test("Phase 4: add Charmander PFL 011 via lightbox variant picker", async () => {
    test.setTimeout(30_000);

    // Click the card image (not the inline controls) to open lightbox
    const charmTile = findTile(page, "PAF", "007");
    // Click bottom-center of the tile to avoid the top-left inline controls
    await charmTile.click({ position: { x: 70, y: 150 } });
    await page.waitForSelector(".lb-modal", { timeout: 5000 });

    // Verify lightbox shows Charmander
    await expect(page.locator(".lb-title")).toContainText("Charmander");

    // Verify variant grid is visible
    await expect(page.locator(".lb-variants-grid")).toBeVisible({
      timeout: 8000,
    });

    // Find PFL 011 variant and add it
    const pflVariant = page.locator(".lb-variants-grid .card-thumb").filter({
      has: page.locator(".card-thumb-label", { hasText: "PFL #011" }),
    });
    await expect(pflVariant).toBeVisible({ timeout: 5000 });
    await pflVariant.locator(".card-thumb-plus").click();

    // Wait briefly for the count to update
    await page.waitForTimeout(500);

    // Close lightbox
    await page.locator(".lightbox-close").click();
    await expect(page.locator(".lb-modal")).not.toBeVisible({ timeout: 3000 });

    // Verify total
    await assertCount(page, 4, 7);
  });

  // -----------------------------------------------------------------------
  // Phase 5: Add remaining cards via search (+ one more lightbox variant)
  // -----------------------------------------------------------------------
  test("Phase 5: add remaining Pokemon, Trainers, and Energy", async () => {
    test.setTimeout(120_000);

    // --- Pokemon ---
    await searchAndAdd(page, "Duskull", "PRE", "035");
    await searchAndAdd(page, "Dusclops", "PRE", "036");
    await searchAndAdd(page, "Dusknoir", "PRE", "037");
    await searchAndAdd(page, "Pidgey", "MEW", "016");
    await searchAndAdd(page, "Pidgeotto", "OBF", "163");
    await searchAndAdd(page, "Pidgeot", "OBF", "164");
    await searchAndAdd(page, "Fezandipiti", "ASC", "142");
    await searchAndAdd(page, "Tatsugiri", "TWM", "131");
    await searchAndAdd(page, "Chi-Yu", "PAR", "029");
    await searchAndAdd(page, "Klefki", "SVI", "096");

    // Add Pidgey OBF 162 via lightbox (click Pidgey MEW 016 tile)
    await addVariantViaLightbox(page, "MEW", "016", "OBF", "162");

    // --- Trainers ---
    await searchAndAdd(page, "Lillie's Determination", "MEG", "119");
    await searchAndAdd(page, "Arven", "OBF", "186");
    await searchAndAdd(page, "Iono", "PAL", "185");
    await searchAndAdd(page, "Boss's Orders", "MEG", "114");
    await searchAndAdd(page, "Professor Turo", "PAR", "171");
    await searchAndAdd(page, "Briar", "SCR", "132");
    await searchAndAdd(page, "Ultra Ball", "MEG", "131");
    await searchAndAdd(page, "Buddy-Buddy Poffin", "TEF", "144");
    await searchAndAdd(page, "Rare Candy", "MEG", "125");
    await searchAndAdd(page, "Counter Catcher", "PAR", "160");
    await searchAndAdd(page, "Super Rod", "PAL", "188");
    await searchAndAdd(page, "Secret Box", "TWM", "163");
    await searchAndAdd(page, "Technical Machine", "PAR", "178");
    await searchAndAdd(page, "Defiance Band", "SVI", "169");
    await searchAndAdd(page, "Mesagoza", "SVI", "178");
    await searchAndAdd(page, "Artazon", "PAL", "171");

    // --- Energy ---
    await searchAndAdd(page, "Fire Energy", "OBF", "230");
    await searchAndAdd(page, "Mist Energy", "TEF", "161");
    await searchAndAdd(page, "Jet Energy", "PAL", "190");

    // 4 (from phases 1-4) + 10 pokemon + 1 lightbox + 16 trainers + 3 energy = 34 unique
    // 7 (from phases 1-4) + 10 + 1 + 16 + 3 = 37 total
    await assertCount(page, 34, 37);
  });

  // -----------------------------------------------------------------------
  // Phase 6: Adjust counts to target values
  // -----------------------------------------------------------------------
  test("Phase 6: adjust counts to reach 60 cards", async () => {
    test.setTimeout(30_000);

    await incrementTile(page, "PRE", "035", 1); // Duskull → 2
    await incrementTile(page, "OBF", "164", 1); // Pidgeot ex → 2
    await incrementTile(page, "MEG", "119", 3); // Lillie's → 4
    await incrementTile(page, "OBF", "186", 1); // Arven → 2
    await incrementTile(page, "PAL", "185", 1); // Iono → 2
    await incrementTile(page, "MEG", "114", 1); // Boss's Orders → 2
    await incrementTile(page, "MEG", "131", 3); // Ultra Ball → 4
    await incrementTile(page, "TEF", "144", 3); // Buddy-Buddy Poffin → 4
    await incrementTile(page, "MEG", "125", 2); // Rare Candy → 3
    await incrementTile(page, "PAR", "160", 1); // Counter Catcher → 2
    await incrementTile(page, "PAL", "188", 1); // Super Rod → 2
    await incrementTile(page, "PAR", "178", 1); // TM: Evolution → 2
    await incrementTile(page, "OBF", "230", 4); // Fire Energy → 5

    // 37 + 1+1+3+1+1+1+3+3+2+1+1+1+4 = 37 + 23 = 60
    await assertCount(page, 34, 60);
  });

  // -----------------------------------------------------------------------
  // Phase 7: Edge case — go over 60 then back down
  // -----------------------------------------------------------------------
  test("Phase 7: overshoot to 61 and correct back to 60", async () => {
    test.setTimeout(10_000);

    await incrementTile(page, "OBF", "230", 1); // Fire Energy → 6
    await assertCount(page, 34, 61);

    await decrementTile(page, "OBF", "230"); // Fire Energy → 5
    await assertCount(page, 34, 60);
  });

  // -----------------------------------------------------------------------
  // Phase 8: Edge case — remove a card entirely then re-add
  // -----------------------------------------------------------------------
  test("Phase 8: remove Klefki entirely and re-add via search", async () => {
    test.setTimeout(15_000);

    await decrementTile(page, "SVI", "096"); // Klefki count 1 → removed
    await assertCount(page, 33, 59);

    // Re-add via search
    await searchAndAdd(page, "Klefki", "SVI", "096");
    await assertCount(page, 34, 60);
  });

  // -----------------------------------------------------------------------
  // Phase 9: Sort and group controls
  // -----------------------------------------------------------------------
  test("Phase 9: exercise sort and group controls", async () => {
    test.setTimeout(15_000);

    // The panel has two .sort-group-section blocks: [0]=Sort by, [1]=Group by
    const sortSection = page.locator(".sort-group-section").nth(0);
    const groupSection = page.locator(".sort-group-section").nth(1);

    // Open sort/group popup
    await page.locator(".sort-group-btn").click();
    await expect(page.locator(".sort-group-panel")).toBeVisible();

    // Group by Category
    await groupSection
      .locator(".sort-group-option")
      .filter({ hasText: "Category" })
      .click();

    // Close popup
    await page.locator(".sort-group-backdrop").click();
    await expect(page.locator(".sort-group-panel")).not.toBeVisible();

    // Verify group headers appeared
    await expect(page.locator(".group-header")).not.toHaveCount(0);

    // Reopen and change sort to Rarity
    await page.locator(".sort-group-btn").click();
    await sortSection
      .locator(".sort-group-option")
      .filter({ hasText: "Rarity" })
      .click();
    await page.locator(".sort-group-backdrop").click();

    // Reset: no grouping, alphabetical sort
    await page.locator(".sort-group-btn").click();
    await groupSection
      .locator(".sort-group-option")
      .filter({ hasText: "No grouping" })
      .click();
    await sortSection
      .locator(".sort-group-option")
      .filter({ hasText: "Alphabetical" })
      .click();
    await page.locator(".sort-group-backdrop").click();
  });

  // -----------------------------------------------------------------------
  // Phase 10: Beautify in Diverse mode
  // -----------------------------------------------------------------------
  test("Phase 10: beautify deck with Diverse mode", async () => {
    test.setTimeout(60_000);

    // Click Beautify button in toolbar
    await page
      .locator(".dm-action-btn")
      .filter({ hasText: "Beautify" })
      .click();

    // Wait for dialog
    await expect(page.locator(".beautify-dialog")).toBeVisible({
      timeout: 5000,
    });

    // Verify Diverse mode is active by default
    await expect(
      page.locator(".beautify-mode-btn.active"),
    ).toContainText("Diverse");

    // Execute beautify
    await page.locator(".beautify-action-btn.primary").click();

    // Wait for dialog to close (beautify fetches variants for each unique card)
    await expect(page.locator(".beautify-dialog")).not.toBeVisible({
      timeout: 30_000,
    });

    // Total should still be 60
    await expect(page.locator(".card-count")).toContainText("60/60 total");
  });

  // -----------------------------------------------------------------------
  // Phase 11: Final verification
  // -----------------------------------------------------------------------
  test("Phase 11: verify final deck state", async () => {
    test.setTimeout(15_000);

    // Verify 60/60 total
    await expect(page.locator(".card-count")).toContainText(
      /\d+ unique · 60\/60 total/,
    );

    // Group by Category and verify all categories present
    const groupSec = page.locator(".sort-group-section").nth(1);
    await page.locator(".sort-group-btn").click();
    await groupSec
      .locator(".sort-group-option")
      .filter({ hasText: "Category" })
      .click();
    await page.locator(".sort-group-backdrop").click();

    // Verify Pokemon, Energy headers exist (Trainer splits into subtypes)
    const headers = page.locator(".group-header-label");
    const headerTexts: string[] = [];
    for (const h of await headers.all()) {
      headerTexts.push((await h.textContent()) ?? "");
    }
    expect(headerTexts.some((t) => t.includes("Pokemon"))).toBe(true);
    expect(headerTexts.some((t) => t.includes("Energy"))).toBe(true);
    // Trainers group by trainerType: Supporter, Item, Stadium, Tool
    expect(
      headerTexts.some(
        (t) =>
          t.includes("Supporter") ||
          t.includes("Item") ||
          t.includes("Trainer"),
      ),
    ).toBe(true);

    // Reset grouping
    await page.locator(".sort-group-btn").click();
    await groupSec
      .locator(".sort-group-option")
      .filter({ hasText: "No grouping" })
      .click();
    await page.locator(".sort-group-backdrop").click();
  });
});
