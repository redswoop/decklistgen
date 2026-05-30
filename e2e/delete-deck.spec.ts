import { test, expect, type Page } from "@playwright/test";
import { login, TEST_EMAIL, TEST_PASSWORD } from "./helpers/auth";

/**
 * Covers the two deck-delete entry points:
 *   1. Hamburger menu on a card in the deck gallery
 *   2. Delete button in the WorkingDeckView toolbar when a saved deck is loaded
 *
 * Both routes require typing the exact deck name to enable the Delete button —
 * the test asserts the disabled state, wrong-name disabled state, and that the
 * deck actually disappears from the API after confirmation.
 */

const PREFIX = "E2E Delete";

async function createDeckViaApi(page: Page, name: string): Promise<string> {
  const result = await page.evaluate(async (deckName) => {
    const resp = await fetch("/api/decks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: deckName, cards: [] }),
    });
    if (!resp.ok) return { error: resp.status };
    const body = (await resp.json()) as { id: string };
    return { id: body.id };
  }, name);
  if ("error" in result) throw new Error(`createDeck failed: ${result.error}`);
  return result.id;
}

async function listDeckNames(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const resp = await fetch("/api/decks", { credentials: "include" });
    if (!resp.ok) return [];
    const decks = (await resp.json()) as Array<{ name: string }>;
    return decks.map((d) => d.name);
  });
}

async function deleteAllTestDecks(page: Page): Promise<void> {
  await page.evaluate(async (prefix) => {
    const resp = await fetch("/api/decks", { credentials: "include" });
    if (!resp.ok) return;
    const decks = (await resp.json()) as Array<{ id: string; name: string }>;
    for (const d of decks) {
      if (d.name.startsWith(prefix)) {
        await fetch(`/api/decks/${d.id}`, {
          method: "DELETE",
          credentials: "include",
        });
      }
    }
  }, PREFIX);
}

async function gotoDeckGallery(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem("decklistgen-decklist");
    localStorage.removeItem("decklistgen-deck-meta");
    location.hash = "#/build";
  });
  await page.reload();
  await page.waitForSelector(".app-nav", { timeout: 10000 });
  await page.waitForSelector(".deck-gallery", { timeout: 10000 });
}

/**
 * Ensures the playwright test user exists. Registration is idempotent — a 409
 * "already exists" response is treated as success.
 */
async function ensureTestUser(page: Page): Promise<void> {
  const resp = await page.request.post("/api/auth/register", {
    data: {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      displayName: "Playwright Test",
    },
  });
  if (!resp.ok() && resp.status() !== 409) {
    throw new Error(`register failed: ${resp.status()} ${await resp.text()}`);
  }
}

test.describe("Delete Deck", () => {
  test.beforeEach(async ({ page }) => {
    await ensureTestUser(page);
    await login(page);
    await deleteAllTestDecks(page);
  });

  test.afterEach(async ({ page }) => {
    await deleteAllTestDecks(page);
  });

  test("hamburger menu opens and deletes deck after typed-name confirmation", async ({ page }) => {
    const name = `${PREFIX} Gallery ${Date.now()}`;
    await createDeckViaApi(page, name);
    await gotoDeckGallery(page);

    const card = page.locator(".deck-gallery-card", { hasText: name });
    await expect(card).toBeVisible();

    // Click hamburger — menu must actually appear (the bug: it opened invisibly).
    const menuBtn = card.locator(".deck-gallery-card-menu-btn");
    await menuBtn.click();

    const menu = card.locator(".deck-gallery-card-menu");
    await expect(menu).toBeVisible();
    const deleteMenuItem = menu.locator(".deck-gallery-menu-danger");
    await expect(deleteMenuItem).toBeVisible();

    await deleteMenuItem.click();

    const dialog = page.locator(".delete-deck-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(name);

    const confirmBtn = dialog.locator(".dialog-actions .btn-danger");
    const nameInput = dialog.locator(".delete-deck-dialog-input");

    // Empty → disabled
    await expect(confirmBtn).toBeDisabled();

    // Wrong name → still disabled
    await nameInput.fill("not the deck name");
    await expect(confirmBtn).toBeDisabled();

    // Correct name → enabled
    await nameInput.fill(name);
    await expect(confirmBtn).toBeEnabled();

    await confirmBtn.click();
    await expect(dialog).not.toBeVisible();
    await expect(card).not.toBeVisible();

    expect(await listDeckNames(page)).not.toContain(name);
  });

  test("WorkingDeckView toolbar Delete removes the loaded saved deck", async ({ page }) => {
    const name = `${PREFIX} Working ${Date.now()}`;
    await createDeckViaApi(page, name);
    await gotoDeckGallery(page);

    // Open the deck — switches to WorkingDeckView
    const card = page.locator(".deck-gallery-card", { hasText: name });
    await expect(card).toBeVisible();
    await card.click();

    await page.waitForSelector(".dm-view", { timeout: 10000 });

    const deleteBtn = page
      .locator(".dm-view-actions .dm-action-btn-danger")
      .filter({ hasText: "Delete" });
    await expect(deleteBtn).toBeEnabled();
    await deleteBtn.click();

    const dialog = page.locator(".delete-deck-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(name);

    const confirmBtn = dialog.locator(".dialog-actions .btn-danger");
    await expect(confirmBtn).toBeDisabled();

    await dialog.locator(".delete-deck-dialog-input").fill(name);
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    await expect(dialog).not.toBeVisible();
    expect(await listDeckNames(page)).not.toContain(name);
  });

  test("Delete button in WorkingDeckView is disabled with no saved deck loaded", async ({ page }) => {
    await gotoDeckGallery(page);

    // From gallery, click "New Deck" — opens empty WorkingDeckView (currentDeckId=null)
    await page.locator(".deck-gallery-card-new").click();
    await page.waitForSelector(".dm-view", { timeout: 10000 });

    const deleteBtn = page
      .locator(".dm-view-actions .dm-action-btn-danger")
      .filter({ hasText: "Delete" });
    await expect(deleteBtn).toBeDisabled();
  });
});
