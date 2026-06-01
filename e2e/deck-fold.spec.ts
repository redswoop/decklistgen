import { test, expect, type Page } from "@playwright/test";
import type { Card } from "../src/shared/types/card.js";

// Verifies deck-grid folding (context="deck"):
//  - "Same art" keeps different-art printings of one card as separate tiles
//  - "By card" collapses them into one tile with the SUMMED count + ⧉ printings
//  - the folded −/+ controls edit the group total (rep-first)
//  - the fold mode persists across reload
//
// Seeds the working deck directly via localStorage (no auth/beautify needed),
// using two same-card printings with DIFFERENT art tiers: Morpeko V Holo Rare V
// (SWSH 79) and its Ultra Rare full-art (SWSH 190). Same name + mechanicsHash,
// different rarity tier → SAME_ART keeps them split, SAME_CARD folds them.

const foldBtn = (p: Page, label: string) =>
  p.locator(".fold-mode-toggle .mode-btn", { hasText: label });
const inlineBadge = (p: Page) => p.locator(".card-thumb-badge").first();

// With a deckId seeded in deck-meta, the build view opens straight to the
// working deck (deckSubView inits to 'build', skipping the gallery).
async function gotoDeckBuild(page: Page) {
  await page.locator(".app-nav").waitFor({ timeout: 10000 });
  await page.locator(".app-nav-tab", { hasText: "Deck" }).click();
  await page.locator(".grid-search").waitFor({ timeout: 10000 });
  await page.locator(".card-stack").first().waitFor({ timeout: 10000 });
}

async function seedDeck(page: Page) {
  await page.goto("/");
  // Pull two real printings of Morpeko V from the API (Vite proxies /api).
  const res = await page.request.get("/api/cards?nameSearch=Morpeko%20V&era=swsh");
  const { cards } = (await res.json()) as { cards: Card[] };
  const holo = cards.find((c) => c.setCode === "SWSH" && c.rarity === "Holo Rare V");
  const fullart = cards.find((c) => c.rarity === "Ultra Rare");
  if (!holo || !fullart) throw new Error(`Missing expected Morpeko printings: ${cards.map((c) => `${c.setCode}/${c.rarity}`).join(", ")}`);

  const item = (card: Card, count: number) => ({
    setCode: card.setCode, localId: card.localId, count, name: card.name,
    imageUrl: `${card.imageBase}/low.png`, card,
  });

  await page.evaluate((items) => {
    localStorage.removeItem("decklistgen-sort-group");
    localStorage.setItem("decklistgen-decklist", JSON.stringify(items));
    // A deckId makes the build view open straight to the working deck.
    localStorage.setItem("decklistgen-deck-meta", JSON.stringify({
      deckId: "e2e-local", deckName: "Fold Test", importSource: null, importedAt: null, lastSavedSnapshot: "",
    }));
  }, [item(holo, 2), item(fullart, 2)]);

  await page.reload();
  await gotoDeckBuild(page);
}

test.afterEach(async ({ page }) => {
  await page.evaluate(() => {
    localStorage.removeItem("decklistgen-decklist");
    localStorage.removeItem("decklistgen-deck-meta");
    localStorage.removeItem("decklistgen-sort-group");
  });
});

test("By-card folds different-art copies into one summed tile; Same art keeps them split", async ({ page }) => {
  await seedDeck(page);

  // Default mode is "Same art": the two different-art printings stay separate.
  await expect(foldBtn(page, "Same art")).toHaveClass(/active/);
  await expect(page.locator(".card-stack")).toHaveCount(2);
  await expect(page.locator(".card-stack-multi")).toHaveCount(0);

  // Switch to "By card": collapse to one tile, summed count 4, ⧉ ×2 printings.
  await foldBtn(page, "By card").click();
  await expect(page.locator(".card-stack")).toHaveCount(1);
  await expect(page.locator(".card-stack-multi")).toHaveCount(1);
  await expect(page.locator(".card-stack-badge")).toContainText("2");
  await expect(inlineBadge(page)).toHaveText("4");

  // − drains the group total (rep-first); total goes 4 → 3.
  await page.locator(".card-thumb-minus").first().click();
  await expect(inlineBadge(page)).toHaveText("3");

  // "No fold" → back to one tile per printing.
  await foldBtn(page, "No fold").click();
  await expect(page.locator(".card-stack")).toHaveCount(2);
  await expect(page.locator(".card-stack-multi")).toHaveCount(0);
});

test("deck fold mode persists across reload", async ({ page }) => {
  await seedDeck(page);
  await foldBtn(page, "By card").click();
  await expect(page.locator(".card-stack-multi")).toHaveCount(1);

  await page.reload();
  await gotoDeckBuild(page);

  await expect(foldBtn(page, "By card")).toHaveClass(/active/);
  await expect(page.locator(".card-stack-multi")).toHaveCount(1);
});
