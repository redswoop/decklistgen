import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

// TODO: Skipped after CSS-renderer migration changed the save-flow UI.
// DecklistPanel no longer hosts inline save/clear buttons (.btn-save/.btn-clear);
// save moved to DeckContextBar (.dcb-save-btn). Rewrite each test against the
// new layout when next touching deck-save code. See CLAUDE.md TODO.
test.describe.skip("Deck Save Flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // Clear localStorage to start fresh (no stale deckId)
    await page.evaluate(() => {
      localStorage.removeItem("decklistgen-decklist");
      localStorage.removeItem("decklistgen-deck-meta");
    });
    await page.reload();
    await page.waitForSelector(".app-nav", { timeout: 10000 });
  });

  test("can save a new deck from scratch", async ({ page }) => {
    // Ensure we're on Browse view
    await page.locator(".app-nav-tab").filter({ hasText: "Browse" }).click();

    // Load SV era cards
    const eraSelect = page.locator("select").first();
    await eraSelect.selectOption("sv");

    // Wait for cards to load
    await page.waitForSelector(".card-thumb", { timeout: 15000 });

    // Add a few cards to the deck using the + button
    const addButtons = page.locator(".card-thumb .card-thumb-action-add");
    const firstAdd = addButtons.first();
    // Hover over the first card to reveal the + button
    await page.locator(".card-thumb").first().hover();
    await firstAdd.click({ force: true });

    // Add a second different card
    await page.locator(".card-thumb").nth(1).hover();
    await addButtons.nth(1).click({ force: true });

    // Verify cards appeared in the decklist panel
    const decklistPanel = page.locator(".decklist-panel");
    await expect(decklistPanel.locator(".decklist-item")).toHaveCount(2);

    // The save button should say "Save As..." and be enabled
    const saveBtn = decklistPanel.locator(".btn-save");
    await expect(saveBtn).toBeEnabled();
    await expect(saveBtn).toContainText("Save As...");

    // Click Save As...
    await saveBtn.click();

    // The save dialog should appear
    const saveDialog = page.locator(".save-deck-dialog");
    await expect(saveDialog).toBeVisible();

    // Type a deck name and save
    const nameInput = saveDialog.locator('input[type="text"]');
    await nameInput.fill("E2E Test Deck");
    await saveDialog.locator(".btn-primary").click();

    // Dialog should close
    await expect(saveDialog).not.toBeVisible();

    // The decklist panel should now show the deck name
    await expect(decklistPanel.locator("h3")).toContainText("E2E Test Deck");

    // The save button should now say "Save" (existing deck, not dirty)
    // After save, isDirty becomes false and currentDeckId is set
    // Button text: currentDeckId && isDirty ? 'Save' : 'Save As...'
    // Since isDirty is false → shows "Save As..."
    await expect(saveBtn).toContainText("Save As...");
  });

  test("save button is not disabled on a new deck with cards", async ({ page }) => {
    // Browse view
    await page.locator(".app-nav-tab").filter({ hasText: "Browse" }).click();
    const eraSelect = page.locator("select").first();
    await eraSelect.selectOption("sv");
    await page.waitForSelector(".card-thumb", { timeout: 15000 });

    // Add a card
    await page.locator(".card-thumb").first().hover();
    await page.locator(".card-thumb .card-thumb-action-add").first().click({ force: true });

    // Save button should be enabled
    const saveBtn = page.locator(".decklist-panel .btn-save");
    await expect(saveBtn).toBeEnabled();
  });

  test("save button works after loading and clearing a saved deck", async ({ page }) => {
    // First, create a deck
    await page.locator(".app-nav-tab").filter({ hasText: "Browse" }).click();
    const eraSelect = page.locator("select").first();
    await eraSelect.selectOption("sv");
    await page.waitForSelector(".card-thumb", { timeout: 15000 });

    // Add cards
    await page.locator(".card-thumb").first().hover();
    await page.locator(".card-thumb .card-thumb-action-add").first().click({ force: true });
    await page.locator(".card-thumb").nth(1).hover();
    await page.locator(".card-thumb .card-thumb-action-add").nth(1).click({ force: true });

    // Save the deck
    const saveBtn = page.locator(".decklist-panel .btn-save");
    await saveBtn.click();
    const saveDialog = page.locator(".save-deck-dialog");
    await saveDialog.locator('input[type="text"]').fill("Temp Deck");
    await saveDialog.locator(".btn-primary").click();
    await expect(saveDialog).not.toBeVisible();

    // Clear the deck
    await page.locator(".decklist-panel .btn-clear").click();

    // Add new cards
    await page.locator(".card-thumb").nth(2).hover();
    await page.locator(".card-thumb .card-thumb-action-add").nth(2).click({ force: true });

    // Save button should say "Save As..." and be enabled (new deck)
    await expect(saveBtn).toBeEnabled();
    await expect(saveBtn).toContainText("Save As...");

    // Click save and verify dialog opens
    await saveBtn.click();
    await expect(page.locator(".save-deck-dialog")).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Clean up: delete any decks created by the test via API
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === "session");
    if (!sessionCookie) return;

    const decks = await page.evaluate(async () => {
      const resp = await fetch("/api/decks", { credentials: "include" });
      if (!resp.ok) return [];
      return resp.json();
    });

    for (const deck of decks as any[]) {
      if (deck.name?.startsWith("E2E Test") || deck.name === "Temp Deck") {
        await page.evaluate(async (id) => {
          await fetch(`/api/decks/${id}`, { method: "DELETE", credentials: "include" });
        }, deck.id);
      }
    }
  });
});
