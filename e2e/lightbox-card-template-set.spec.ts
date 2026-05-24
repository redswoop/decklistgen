import { test, expect, type Page } from "@playwright/test";

// Phase A verification: per-card template-set picker lives in the lightbox,
// not on each row in DeckContextPanel. A small badge on the row indicates
// when an override is active.
//
// Anon-friendly: seeds the working deck via localStorage rather than going
// through the auth-gated search flow.

async function seedDeckAndOpen(page: Page) {
  // Fetch a real Pokemon card so the seeded DecklistItem has a valid Card object.
  const apiResp = await page.request.get("/api/cards?q=pikachu&category=Pokemon&limit=1");
  if (!apiResp.ok()) throw new Error(`/api/cards failed: ${apiResp.status()}`);
  const body = await apiResp.json();
  const card = body.cards?.[0];
  if (!card) throw new Error("no Pokemon card returned from /api/cards");

  await page.goto("/");
  // Seed before app boots
  await page.evaluate(({ card }) => {
    const item = {
      setCode: card.setCode,
      localId: card.localId,
      count: 1,
      name: card.name,
      imageUrl: `${card.imageBase}/low.png`,
      card,
    };
    localStorage.setItem("decklistgen-decklist", JSON.stringify([item]));
    localStorage.setItem(
      "decklistgen-deck-meta",
      JSON.stringify({
        deckId: null,
        deckName: "Phase A walk",
        importSource: null,
        importedAt: null,
        lastSavedSnapshot: "",
        templateSetId: null,
      }),
    );
  }, { card });
  await page.reload();
  // Wait for the deck context panel to render the seeded row.
  await page.waitForSelector(".decklist-item", { timeout: 10000 });
}

test.describe("Lightbox per-card template-set picker (Phase A)", () => {
  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem("decklistgen-decklist");
      localStorage.removeItem("decklistgen-deck-meta");
    });
  });

  test("deck-context-panel row has no inline picker and no badge initially", async ({ page }) => {
    await seedDeckAndOpen(page);
    const row = page.locator(".decklist-item").first();
    await expect(row).toBeVisible();
    await expect(row.locator(".tsp-select")).toHaveCount(0);
    await expect(row.locator(".item-tsp-badge")).toHaveCount(0);
  });

  test("lightbox shows the picker in deck context, sets override, badge appears, clears", async ({ page }) => {
    await seedDeckAndOpen(page);
    const row = page.locator(".decklist-item").first();
    await row.click();

    const lightbox = page.locator(".lb-modal");
    await expect(lightbox).toBeVisible({ timeout: 5000 });

    const cardPicker = lightbox.locator(".lb-template-set .tsp-select");
    await expect(cardPicker).toBeVisible();

    // Set explicit override (default is the only builtin shipped today).
    await cardPicker.selectOption({ value: "default" });

    await page.keyboard.press("Escape");
    await expect(lightbox).not.toBeVisible({ timeout: 3000 });

    const badge = row.locator(".item-tsp-badge");
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("Default");

    // Reopen, clear via "Inherit" (empty value).
    await row.click();
    await expect(lightbox).toBeVisible({ timeout: 5000 });
    await expect(cardPicker).toBeVisible();
    await cardPicker.selectOption({ value: "" });
    await page.keyboard.press("Escape");

    await expect(row.locator(".item-tsp-badge")).toHaveCount(0);
  });
});
