import { test, expect, type Page } from "@playwright/test";

// Regression guard: the Build / Test Hand sub-view toggle must only appear on
// the deck details view (currentView === 'build'), not on every view where the
// global DeckContextBar renders (browse, cards, public, …).

const toggle = (p: Page) => p.locator(".deck-subview-toggle");
const contextBar = (p: Page) => p.locator(".dcb-wrapper");
const tab = (p: Page, label: string) =>
  p.locator(".app-nav-tabs .app-nav-tab", { hasText: label });

async function bootWithDeck(page: Page) {
  await page.goto("/");
  // Seed a saved-deck meta with a deckId so deckSubView initializes to 'build'
  // (otherwise the deck view defaults to the gallery sub-view).
  await page.evaluate(() => {
    localStorage.setItem(
      "decklistgen-deck-meta",
      JSON.stringify({
        deckId: "test-deck-id",
        deckName: "Toggle Scope Test",
        importSource: null,
        importedAt: null,
        lastSavedSnapshot: "",
      }),
    );
    localStorage.removeItem("decklistgen-decklist");
  });
  await page.reload();
  await page.locator(".app-nav").waitFor({ timeout: 10000 });
}

test("Build/Test-Hand toggle is scoped to the deck view", async ({ page }) => {
  await bootWithDeck(page);

  // On the Deck view: toggle visible.
  await tab(page, "Deck").click();
  await expect(toggle(page)).toBeVisible();
  await expect(toggle(page).getByText("Test Hand")).toBeVisible();

  // Switch to Browse: context bar stays, toggle goes away (the fix).
  await tab(page, "Browse").click();
  await expect(contextBar(page)).toBeVisible();
  await expect(toggle(page)).toHaveCount(0);

  // Cards view: still no toggle.
  await tab(page, "Cards").click();
  await expect(toggle(page)).toHaveCount(0);

  // Public view: still no toggle.
  await tab(page, "Public").click();
  await expect(toggle(page)).toHaveCount(0);

  // Back to Deck: toggle returns.
  await tab(page, "Deck").click();
  await expect(toggle(page)).toBeVisible();
});
