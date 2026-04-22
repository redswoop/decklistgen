import { test, expect, type Page, type Locator } from "@playwright/test";

const TEST_EMAIL = "claude@test.local";
const TEST_PASSWORD = "playwright-test-2024";

// PTCGO-format import. All cards picked for having multiple known art
// variants so that Diverse beautify has real work to do.
const IMPORT_LIST = `4 Ultra Ball MEG 131
4 Rare Candy MEG 125
4 Buddy-Buddy Poffin TEF 144
3 Charmander PAF 7
5 Fire Energy OBF 230`;

const IMPORT_TOTAL = 20;

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

  const appNav = page.locator(".app-nav");
  const authForm = page.locator(".auth-form");
  const which = await Promise.race([
    appNav.waitFor({ timeout: 10_000 }).then(() => "app" as const),
    authForm.waitFor({ timeout: 10_000 }).then(() => "auth" as const),
  ]);

  if (which === "auth") {
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.locator(".auth-submit").click();
    await appNav.waitFor({ timeout: 10_000 });
  }
}

async function readTotal(page: Page): Promise<number> {
  const text = (await page.locator(".card-count").textContent()) ?? "";
  const m = text.match(/(\d+)\/60\s*total/);
  if (!m) throw new Error(`Could not parse total from "${text}"`);
  return parseInt(m[1], 10);
}

async function badgeCount(tile: Locator): Promise<number> {
  const text = (await tile.locator(".card-thumb-badge").textContent()) ?? "0";
  return parseInt(text.trim(), 10) || 0;
}

/**
 * Group the working deck's items by card name, read from localStorage so
 * the result is independent of DOM virtualization.
 * Returns { name: uniqueEntryCount }.
 */
async function deckEntriesByName(page: Page): Promise<Record<string, number>> {
  return await page.evaluate(() => {
    const raw = localStorage.getItem("decklistgen-decklist") ?? "[]";
    const items = JSON.parse(raw) as Array<{ name: string }>;
    const map: Record<string, number> = {};
    for (const it of items) {
      map[it.name] = (map[it.name] ?? 0) + 1;
    }
    return map;
  });
}

// ---------------------------------------------------------------------------
// Test — serial phases sharing a single page
// ---------------------------------------------------------------------------

test.describe.serial("Import + Beautify + Variant Adjustment", () => {
  let page: Page;
  let splitCardName = "";

  test.beforeAll(async ({ browser }) => {
    // Large viewport so TanStack Virtual renders every deck tile — Phase 3
    // interactions need the actual DOM elements present.
    page = await browser.newPage({ viewport: { width: 1600, height: 1800 } });
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
  // Phase 0: login, navigate to empty working deck
  // -----------------------------------------------------------------------
  test("Phase 0: login and open empty working deck", async () => {
    test.setTimeout(30_000);

    await login(page);
    await page.locator(".app-nav-tab").filter({ hasText: "Deck" }).click();
    await page
      .locator(".deck-gallery-btn, .deck-gallery-card-new")
      .first()
      .click();
    await page.waitForSelector(".grid-search", { timeout: 5_000 });
    await expect(page.locator(".card-count")).toContainText("0/60 total");
  });

  // -----------------------------------------------------------------------
  // Phase 1: import via paste
  // -----------------------------------------------------------------------
  test("Phase 1: import decklist via paste", async () => {
    test.setTimeout(30_000);

    await page.locator(".dm-action-btn").filter({ hasText: "Import" }).click();
    await expect(page.locator(".import-dialog")).toBeVisible();

    await page.locator(".import-textarea").fill(IMPORT_LIST);
    await page.locator(".import-dialog .btn-primary").click();

    await expect(page.locator(".import-success")).toBeVisible({
      timeout: 15_000,
    });
    await page.locator(".import-dialog .btn-secondary").click();
    await expect(page.locator(".import-dialog")).not.toBeVisible();

    await expect(page.locator(".card-count")).toContainText(
      `${IMPORT_TOTAL}/60 total`,
    );
  });

  // -----------------------------------------------------------------------
  // Phase 2: beautify (Diverse) — at least one name should split across
  // multiple variant tiles
  // -----------------------------------------------------------------------
  test("Phase 2: beautify in Diverse mode splits at least one card", async () => {
    test.setTimeout(60_000);

    await page
      .locator(".dm-action-btn")
      .filter({ hasText: "Beautify" })
      .click();
    await expect(page.locator(".beautify-dialog")).toBeVisible();
    await expect(page.locator(".beautify-mode-btn.active")).toContainText(
      "Diverse",
    );

    await page.locator(".beautify-action-btn.primary").click();
    await expect(page.locator(".beautify-dialog")).not.toBeVisible({
      timeout: 30_000,
    });

    // Total unchanged
    await expect(page.locator(".card-count")).toContainText(
      `${IMPORT_TOTAL}/60 total`,
    );

    // At least one card name should now span ≥2 deck entries
    const groups = await deckEntriesByName(page);
    const splits = Object.entries(groups).filter(([, n]) => n >= 2);
    if (!splits.length) {
      throw new Error(
        `Expected Diverse beautify to split at least one card into multiple variants. Got: ${JSON.stringify(groups)}`,
      );
    }
    // Prefer a name whose total copies are >= 3 so Phase 3's "decrement to 0"
    // still leaves a positive number elsewhere and the assertion narrative
    // (less than start) is obvious.
    splits.sort((a, b) => b[1] - a[1]);
    splitCardName = splits[0][0];
  });

  // -----------------------------------------------------------------------
  // Phase 3: adjust via deck overview +/- — zero one variant, bump another
  // -----------------------------------------------------------------------
  test("Phase 3: deck overview +/- zeros a variant then bumps another", async () => {
    test.setTimeout(30_000);

    const total0 = await readTotal(page);
    const variantTiles = page.locator(
      `.card-grid-scroll .card-thumb[title^="${splitCardName} ("]`,
    );
    const initialCount = await variantTiles.count();
    expect(initialCount).toBeGreaterThanOrEqual(2);

    // --- Decrement the first variant tile to 0 via the inline - button.
    const first = variantTiles.first();
    const firstStart = await badgeCount(first);
    expect(firstStart).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < firstStart; i++) {
      await first.locator(".card-thumb-minus").click();
    }

    // Tile disappears from the deck grid once count hits 0.
    await expect(variantTiles).toHaveCount(initialCount - 1);
    const total1 = await readTotal(page);
    expect(total1).toBe(total0 - firstStart);
    expect(total1).toBeLessThan(total0);

    // --- Bump a surviving variant up via its + button.
    const survivor = variantTiles.first();
    const survivorStart = await badgeCount(survivor);
    await survivor.locator(".card-thumb-plus").click();
    await expect(survivor.locator(".card-thumb-badge")).toHaveText(
      String(survivorStart + 1),
    );

    const total2 = await readTotal(page);
    expect(total2).toBe(total1 + 1);
    expect(total2).toBeGreaterThan(total1);
  });

  // -----------------------------------------------------------------------
  // Phase 4: adjust via lightbox variant grid — decrement one variant and
  // increment another. Total should stay the same.
  //
  // We intentionally avoid zeroing a variant here: in deck context the
  // lightbox's `searchCards` is derived from `items.value`, and the
  // lightbox's searchIndex does not re-find the active card by id when the
  // list changes. Splicing an item out silently shifts `activeCard` to
  // whatever the new `searchCards[searchIndex]` points at, which swaps
  // the entire variant grid. Phase 5 pins this bug with test.fixme.
  // -----------------------------------------------------------------------
  test("Phase 4: lightbox variant grid -1/+1 across variants", async () => {
    test.setTimeout(30_000);

    const total0 = await readTotal(page);

    const tile = page
      .locator(`.card-grid-scroll .card-thumb[title^="${splitCardName} ("]`)
      .first();
    await tile.click({ position: { x: 70, y: 150 } });
    await page.waitForSelector(".lb-modal", { timeout: 5_000 });

    const variantGrid = page.locator(".lb-variants-grid");
    await expect(variantGrid).toBeVisible({ timeout: 8_000 });

    const variantTiles = variantGrid.locator(".card-thumb");
    const variantCount = await variantTiles.count();
    expect(variantCount).toBeGreaterThanOrEqual(2);

    // Pick a target with count >= 2 so decrementing by 1 doesn't remove
    // the item from the deck.
    let targetIdx = -1;
    let targetStart = 0;
    for (let i = 0; i < variantCount; i++) {
      const c = await badgeCount(variantTiles.nth(i));
      if (c >= 2) {
        targetIdx = i;
        targetStart = c;
        break;
      }
    }
    // Fall back to any variant with count >= 1, accepting that a count-1
    // target will still exercise the -1 path but not the > 1 case.
    if (targetIdx === -1) {
      for (let i = 0; i < variantCount; i++) {
        const c = await badgeCount(variantTiles.nth(i));
        if (c >= 1) {
          targetIdx = i;
          targetStart = c;
          break;
        }
      }
    }
    expect(targetIdx).toBeGreaterThanOrEqual(0);
    expect(targetStart).toBeGreaterThanOrEqual(1);

    const target = variantTiles.nth(targetIdx);
    await target.locator(".card-thumb-minus").click();
    // If targetStart was 1 the badge would become 0 AND the item would be
    // spliced from items, which trips the activeCard-shift bug. Skip the
    // badge assertion when the item could have been removed.
    if (targetStart >= 2) {
      await expect(target.locator(".card-thumb-badge")).toHaveText(
        String(targetStart - 1),
      );
    }

    // Increment a different variant.
    const otherIdx = targetIdx === 0 ? 1 : 0;
    const other = variantTiles.nth(otherIdx);
    const otherStart = await badgeCount(other);
    await other.locator(".card-thumb-plus").click();
    await expect(other.locator(".card-thumb-badge")).toHaveText(
      String(otherStart + 1),
    );

    await page.locator(".lightbox-close").click();
    await expect(page.locator(".lb-modal")).not.toBeVisible();

    // Net: -1 / +1 → total unchanged.
    const total1 = await readTotal(page);
    expect(total1).toBe(total0);
  });

  // -----------------------------------------------------------------------
  // Phase 5: zero a variant via lightbox then re-increment it. The
  // lightbox's active card must stay anchored to the clicked card even
  // when the deck list shrinks.
  // -----------------------------------------------------------------------
  test(
    "Phase 5: lightbox zero + re-add keeps variant context stable",
    async () => {
      test.setTimeout(30_000);

      const total0 = await readTotal(page);

      const tile = page
        .locator(`.card-grid-scroll .card-thumb[title^="${splitCardName} ("]`)
        .first();
      await tile.click({ position: { x: 70, y: 150 } });
      await page.waitForSelector(".lb-modal", { timeout: 5_000 });

      const variantGrid = page.locator(".lb-variants-grid");
      await expect(variantGrid).toBeVisible({ timeout: 8_000 });

      // Record the lightbox title so we can assert it doesn't silently shift.
      const titleBefore = await page.locator(".lb-title").textContent();

      // Find any variant with count > 0 and decrement to 0.
      const variantTiles = variantGrid.locator(".card-thumb");
      const variantCount = await variantTiles.count();
      let targetIdx = -1;
      let targetStart = 0;
      for (let i = 0; i < variantCount; i++) {
        const c = await badgeCount(variantTiles.nth(i));
        if (c > 0) {
          targetIdx = i;
          targetStart = c;
          break;
        }
      }
      expect(targetIdx).toBeGreaterThanOrEqual(0);

      const target = variantTiles.nth(targetIdx);
      for (let i = 0; i < targetStart; i++) {
        await target.locator(".card-thumb-minus").click();
      }

      // Expected: lightbox still shows the same card name.
      await expect(page.locator(".lb-title")).toHaveText(titleBefore ?? "");

      // Expected: the tile stays rendered at badge=0 and can be re-added.
      await expect(target.locator(".card-thumb-badge")).toHaveText("0");
      await target.locator(".card-thumb-plus").click();
      await expect(target.locator(".card-thumb-badge")).toHaveText("1");

      await page.locator(".lightbox-close").click();
      await expect(page.locator(".lb-modal")).not.toBeVisible();

      // Net: -(targetStart) + 1
      const total1 = await readTotal(page);
      expect(total1).toBe(total0 - targetStart + 1);
    },
  );
});
