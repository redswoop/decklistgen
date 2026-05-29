import { test, expect, type Page } from "@playwright/test";

/*
 * V1 graduation check for the CSS card renderer: when the user picks the
 * "Proxy" version tab in the lightbox, the lab's CssCardRenderer should mount
 * over the cleaned image (instead of the previous SVG <img>). Older "Cleaned"
 * and "Original" tabs are still expected to swap images normally.
 *
 * Uses a card with a known cached clean image (cel25-15 Lunala) seeded
 * directly into the working deck via localStorage to stay anon-friendly.
 */

const TEST_CARD_ID = "cel25-15";

async function seedDeckAndOpen(page: Page) {
  await page.goto("/");

  // Resolve the seed card via /api/cards so the working-deck row carries a
  // shape consistent with what the rest of the app reads.
  const apiResp = await page.request.get(`/api/cards/${TEST_CARD_ID}`);
  if (!apiResp.ok()) throw new Error(`/api/cards/${TEST_CARD_ID} failed: ${apiResp.status()}`);
  const card = await apiResp.json();
  if (!card || card.category !== "Pokemon") {
    throw new Error(`Expected ${TEST_CARD_ID} to be a Pokemon; got ${card?.category}`);
  }

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
        deckName: "CSS proxy walk",
        importSource: null,
        importedAt: null,
        lastSavedSnapshot: "",
        templateSetId: null,
      }),
    );
    // Default the version tab to "proxy" so the CSS overlay is the active
    // layer once the lightbox mounts — saves a click in the test.
    localStorage.setItem("decklistgen-card-version", "proxy");
  }, { card });
  await page.reload();
  await page.waitForSelector(".decklist-item", { timeout: 10000 });
}

test.describe("Lightbox CSS proxy renderer (V1)", () => {
  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem("decklistgen-decklist");
      localStorage.removeItem("decklistgen-deck-meta");
      localStorage.removeItem("decklistgen-card-version");
    });
  });

  test("Proxy tab mounts CssCardRenderer for a Pokemon with a cached clean image", async ({ page }) => {
    await seedDeckAndOpen(page);

    const row = page.locator(".decklist-item").first();
    await row.click();

    const lightbox = page.locator(".lb-modal");
    await expect(lightbox).toBeVisible({ timeout: 5000 });

    // Already on the Proxy tab via seeded localStorage. The CSS card overlay
    // is rendered when a clean image exists, and gets `.active` when the user
    // is on the proxy version tab.
    const cssCard = lightbox.locator(".lb-card-css");
    await expect(cssCard).toBeVisible({ timeout: 10000 });
    await expect(cssCard).toHaveClass(/active/);

    // Sanity: the lab CardFullArt root element is inside, and it has the
    // card's art image pointing at the cleaned-image endpoint.
    const art = cssCard.locator("img.art");
    await expect(art).toBeVisible();
    const src = await art.getAttribute("src");
    expect(src).toContain(`/api/pokeproxy/image/${TEST_CARD_ID}/`);
  });

  test("Switching to Cleaned hides the CSS overlay but keeps it mounted", async ({ page }) => {
    await seedDeckAndOpen(page);
    await page.locator(".decklist-item").first().click();
    const lightbox = page.locator(".lb-modal");
    await expect(lightbox).toBeVisible({ timeout: 5000 });

    const cssCard = lightbox.locator(".lb-card-css");
    await expect(cssCard).toBeVisible({ timeout: 10000 });

    // Click the "Cleaned" version thumb.
    await lightbox.locator(".lb-version", { hasText: "Cleaned" }).click();

    // The overlay's `.active` class drives opacity; it should be gone now,
    // even though the element stays in the DOM.
    await expect(cssCard).not.toHaveClass(/active/);
  });
});
