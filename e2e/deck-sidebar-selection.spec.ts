import { test, expect, type Page } from "@playwright/test";

const TEST_EMAIL = "claude@test.local";
const TEST_PASSWORD = "playwright-test-2024";

const DECK_A = "E2E Sidebar Deck A";
const DECK_B = "E2E Sidebar Deck B";

async function login(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.removeItem("decklistgen-decklist");
    localStorage.removeItem("decklistgen-deck-meta");
  });
  await page.reload();
  await page.waitForSelector(".auth-form", { timeout: 5000 });
  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.locator(".auth-submit").click();
  await page.waitForSelector(".app-nav", { timeout: 10000 });
}

/** Create a saved deck via API, return its id. */
async function createDeckViaApi(page: Page, name: string): Promise<string> {
  return page.evaluate(async (deckName) => {
    const resp = await fetch("/api/decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: deckName, cards: [] }),
    });
    const data = await resp.json();
    return data.id as string;
  }, name);
}

/** Delete all test decks created by this suite. */
async function cleanupDecks(page: Page) {
  const decks = await page.evaluate(async () => {
    const resp = await fetch("/api/decks", { credentials: "include" });
    if (!resp.ok) return [];
    return resp.json();
  });
  for (const deck of decks as any[]) {
    if (deck.name?.startsWith("E2E Sidebar") || deck.name?.startsWith("E2E DeckView")) {
      await page.evaluate(async (id) => {
        await fetch(`/api/decks/${id}`, { method: "DELETE", credentials: "include" });
      }, deck.id);
    }
  }
}

function sidebarRow(page: Page, name: string) {
  return page.locator(".dm-deck-row").filter({ hasText: name });
}

function workingRow(page: Page) {
  return page.locator(".dm-deck-row-working");
}

test.describe("Deck Sidebar Selection", () => {
  let deckAId: string;
  let deckBId: string;

  test.beforeEach(async ({ page }) => {
    await login(page);
    // Clean up any leftover test decks from previous runs
    await cleanupDecks(page);
    // Create two saved decks
    deckAId = await createDeckViaApi(page, DECK_A);
    deckBId = await createDeckViaApi(page, DECK_B);
    // Navigate to Decks view
    await page.locator(".app-nav-tab").filter({ hasText: "Decks" }).click();
    // Wait for sidebar to show both decks
    await expect(sidebarRow(page, DECK_A)).toBeVisible({ timeout: 5000 });
    await expect(sidebarRow(page, DECK_B)).toBeVisible({ timeout: 5000 });
  });

  test.afterEach(async ({ page }) => {
    await cleanupDecks(page);
  });

  test("clicking a saved deck highlights only that row", async ({ page }) => {
    // Click deck A
    await sidebarRow(page, DECK_A).click();
    await expect(sidebarRow(page, DECK_A)).toHaveClass(/selected/);
    await expect(sidebarRow(page, DECK_B)).not.toHaveClass(/selected/);
    await expect(workingRow(page)).not.toHaveClass(/selected/);

    // Center pane shows deck A
    await expect(page.locator(".dm-view-name")).toContainText(DECK_A);
  });

  test("clicking a different saved deck switches highlight", async ({ page }) => {
    await sidebarRow(page, DECK_A).click();
    await expect(sidebarRow(page, DECK_A)).toHaveClass(/selected/);

    // Now click deck B
    await sidebarRow(page, DECK_B).click();
    await expect(sidebarRow(page, DECK_B)).toHaveClass(/selected/);
    await expect(sidebarRow(page, DECK_A)).not.toHaveClass(/selected/);
    await expect(workingRow(page)).not.toHaveClass(/selected/);

    await expect(page.locator(".dm-view-name")).toContainText(DECK_B);
  });

  test("clicking working deck highlights only working row", async ({ page }) => {
    // First select a saved deck
    await sidebarRow(page, DECK_A).click();
    await expect(sidebarRow(page, DECK_A)).toHaveClass(/selected/);

    // Now click working deck
    await workingRow(page).click();
    await expect(workingRow(page)).toHaveClass(/selected/);
    await expect(sidebarRow(page, DECK_A)).not.toHaveClass(/selected/);
    await expect(sidebarRow(page, DECK_B)).not.toHaveClass(/selected/);
  });

  test("editing a saved deck then clicking it in sidebar still selects it", async ({ page }) => {
    // Click deck A to view it
    await sidebarRow(page, DECK_A).click();
    await expect(page.locator(".dm-view-name")).toContainText(DECK_A);

    // Click "Edit" to load it into working deck
    const editBtn = page.locator("button").filter({ hasText: /Edit/ });
    if (await editBtn.isVisible()) {
      await editBtn.click();
      // Should now be on working deck view
      await expect(workingRow(page)).toHaveClass(/selected/);
    }

    // Click deck A again in sidebar — it should select deck A (saved view), not redirect to working
    await sidebarRow(page, DECK_A).click();
    await expect(sidebarRow(page, DECK_A)).toHaveClass(/selected/);
    await expect(workingRow(page)).not.toHaveClass(/selected/);
  });

  test("no deck name in nav bar breadcrumb", async ({ page }) => {
    // Select a saved deck
    await sidebarRow(page, DECK_A).click();
    await expect(page.locator(".dm-view-name")).toContainText(DECK_A);

    // Nav bar should NOT contain the deck name (no breadcrumb separator)
    await expect(page.locator(".app-nav-separator")).toHaveCount(0);
    await expect(page.locator(".app-nav-deck-name")).toHaveCount(0);

    // Also check working deck
    await workingRow(page).click();
    await expect(page.locator(".app-nav-separator")).toHaveCount(0);
    await expect(page.locator(".app-nav-deck-name")).toHaveCount(0);
  });
});

const DECK_VIEW = "E2E DeckView Test";

test.describe("DeckView Toolbar Actions", () => {
  let deckId: string;

  test.beforeEach(async ({ page }) => {
    await login(page);
    await cleanupDecks(page);
    deckId = await createDeckViaApi(page, DECK_VIEW);
    await page.locator(".app-nav-tab").filter({ hasText: "Decks" }).click();
    await expect(sidebarRow(page, DECK_VIEW)).toBeVisible({ timeout: 5000 });
    // Select the deck
    await sidebarRow(page, DECK_VIEW).click();
    await expect(page.locator(".dm-view-name")).toContainText(DECK_VIEW);
  });

  test.afterEach(async ({ page }) => {
    await cleanupDecks(page);
  });

  test("toolbar shows all expected buttons", async ({ page }) => {
    for (const label of ["Edit", "Save", "Rename", "Duplicate", "Beautify", "Generate", "Print", "Export", "Delete"]) {
      await expect(
        page.locator(".dm-view-actions button").filter({ hasText: label })
      ).toBeVisible();
    }
  });

  test("save button is disabled when deck is not the working deck source", async ({ page }) => {
    const saveBtn = page.locator(".dm-view-actions button").filter({ hasText: "Save" });
    await expect(saveBtn).toBeDisabled();
  });

  test("rename updates deck name in toolbar and sidebar", async ({ page }) => {
    const renameBtn = page.locator(".dm-view-actions button").filter({ hasText: "Rename" });
    await renameBtn.click();

    // Input should appear
    const input = page.locator(".dm-view-rename-input");
    await expect(input).toBeVisible();

    // Clear and type new name
    await input.fill("E2E DeckView Renamed");
    await input.press("Enter");

    // Toolbar should show new name
    await expect(page.locator(".dm-view-name")).toContainText("E2E DeckView Renamed");
    // Sidebar should also reflect the change
    await expect(sidebarRow(page, "E2E DeckView Renamed")).toBeVisible();
  });

  test("duplicate creates a copy in sidebar", async ({ page }) => {
    const dupBtn = page.locator(".dm-view-actions button").filter({ hasText: "Duplicate" });
    await dupBtn.click();

    // A copy should appear in the sidebar (name contains "copy" or the original name)
    await expect(page.locator(".dm-deck-row").filter({ hasText: /E2E DeckView Test.*copy/i })).toBeVisible({ timeout: 5000 });
  });

  test("delete shows confirmation dialog and deletes on confirm", async ({ page }) => {
    const deleteBtn = page.locator(".dm-view-actions button").filter({ hasText: "Delete" });
    await deleteBtn.click();

    // Confirmation dialog should appear
    await expect(page.locator(".confirm-dialog")).toBeVisible();
    await expect(page.locator(".confirm-dialog")).toContainText("Are you sure");

    // Confirm deletion
    await page.locator(".confirm-dialog .btn-danger").click();

    // Deck should be gone from sidebar
    await expect(sidebarRow(page, DECK_VIEW)).not.toBeVisible({ timeout: 5000 });
  });

  test("delete confirmation can be cancelled", async ({ page }) => {
    const deleteBtn = page.locator(".dm-view-actions button").filter({ hasText: "Delete" });
    await deleteBtn.click();

    await expect(page.locator(".confirm-dialog")).toBeVisible();

    // Cancel
    await page.locator(".confirm-dialog .btn-secondary").click();

    // Dialog gone, deck still visible
    await expect(page.locator(".confirm-dialog")).not.toBeVisible();
    await expect(sidebarRow(page, DECK_VIEW)).toBeVisible();
  });

  test("sidebar delete also shows confirmation dialog", async ({ page }) => {
    // Open context menu on the deck in sidebar
    const row = sidebarRow(page, DECK_VIEW);
    await row.locator(".dm-menu-btn").click();

    // Click delete in context menu
    await row.locator(".dm-menu-danger").click();

    // Confirmation dialog should appear
    await expect(page.locator(".confirm-dialog")).toBeVisible();
    await expect(page.locator(".confirm-dialog")).toContainText("Are you sure");

    // Confirm deletion
    await page.locator(".confirm-dialog .btn-danger").click();

    // Deck should be gone
    await expect(sidebarRow(page, DECK_VIEW)).not.toBeVisible({ timeout: 5000 });
  });
});
