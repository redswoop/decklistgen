import { test, expect, type Page } from "@playwright/test";
import type { Card } from "../src/shared/types/card.js";

// Deck-grid print mode (WorkingDeckView → Print):
//  - the grid flips to a print plan grouped by print category, with a
//    three-state checkbox per group header and −/+ editing print counts
//  - counts are capped at the deck count; the deck itself is never touched
//  - Print… opens /print.html with a sparse `counts=` override
//  - "Since last print" seeds the delta after a print; Esc leaves the mode
//  - the plan survives a reload (per-deck localStorage)
//
// Seeds the working deck directly via localStorage (no auth) with a
// matching lastSavedSnapshot so the deck is clean and Print enters the mode
// without the save prompt.

const DECK_ID = "e2e-print";

const printBar = (p: Page) => p.getByTestId("print-bar");
const headerLabel = (p: Page) => p.locator(".card-grid-header .card-count");
const groupHeader = (p: Page, label: string) =>
  p.locator(".group-header", { has: p.locator(".group-header-label", { hasText: label }) });
const tile = (p: Page, card: Card) =>
  p.locator(".card-thumb", { has: p.locator(".card-thumb-label", { hasText: `${card.setCode} #${card.localId}` }) });
const badge = (p: Page, card: Card) => tile(p, card).locator(".card-thumb-badge");

async function pickCards(page: Page): Promise<{ pokemon: Card; item: Card; energy: Card }> {
  const get = async (q: string) => {
    const res = await page.request.get(`/api/cards?${q}`);
    return ((await res.json()) as { cards: Card[] }).cards;
  };
  const pokemon = (await get("era=sv&category=Pokemon&limit=5")).find((c) => c.category === "Pokemon");
  const item = (await get("era=sv&category=Trainer&limit=50")).find((c) => c.trainerType === "Item");
  const energy = (await get("era=sv&category=Energy&limit=50")).find((c) => c.mechanicsHash === "basic");
  if (!pokemon || !item || !energy) throw new Error("Could not find seed cards (Pokemon / Item / basic Energy) in the sv era");
  return { pokemon, item, energy };
}

async function seedDeck(page: Page, cards: { card: Card; count: number }[]) {
  const items = cards.map(({ card, count }) => ({
    setCode: card.setCode, localId: card.localId, count, name: card.name,
    imageUrl: `${card.imageBase}/low.png`, card,
  }));
  // Mirrors useDecklist.currentSnapshot() so isDirty is false.
  const snapshot = JSON.stringify({ items: items.map((i) => ({ s: i.setCode, l: i.localId, c: i.count })) });
  await page.evaluate(({ items, snapshot, deckId }) => {
    localStorage.removeItem("decklistgen-sort-group");
    localStorage.removeItem(`decklistgen-print-plan:${deckId}`);
    localStorage.removeItem(`decklistgen-last-printed:${deckId}`);
    localStorage.setItem("decklistgen-decklist", JSON.stringify(items));
    localStorage.setItem("decklistgen-deck-meta", JSON.stringify({
      deckId, deckName: "Print Mode Test", importSource: null, importedAt: null, lastSavedSnapshot: snapshot,
    }));
  }, { items, snapshot, deckId: DECK_ID });
}

async function gotoDeckBuild(page: Page) {
  await page.locator(".app-nav").waitFor({ timeout: 10000 });
  await page.locator(".app-nav-tab", { hasText: "Deck" }).click();
  await page.locator(".grid-search").waitFor({ timeout: 10000 });
  await page.locator(".card-stack").first().waitFor({ timeout: 10000 });
}

async function enterPrintMode(page: Page) {
  await page.getByRole("button", { name: "Print", exact: true }).click();
  await expect(printBar(page)).toBeVisible();
  await expect(page.locator(".card-grid-print-mode")).toHaveCount(1);
}

test.afterEach(async ({ page }) => {
  await page.evaluate((deckId) => {
    localStorage.removeItem("decklistgen-decklist");
    localStorage.removeItem("decklistgen-deck-meta");
    localStorage.removeItem("decklistgen-sort-group");
    localStorage.removeItem(`decklistgen-print-plan:${deckId}`);
    localStorage.removeItem(`decklistgen-last-printed:${deckId}`);
  }, DECK_ID);
});

test("print mode plans per-card counts, prints a sparse override URL, and never edits the deck", async ({ page, context }) => {
  await page.goto("/");
  const { pokemon, item, energy } = await pickCards(page);
  await seedDeck(page, [{ card: pokemon, count: 3 }, { card: item, count: 2 }, { card: energy, count: 4 }]);
  await page.reload();
  await gotoDeckBuild(page);

  // Deck mode: red count badges, no print bar.
  await expect(printBar(page)).toHaveCount(0);
  await expect(badge(page, energy)).toHaveText("4");

  await enterPrintMode(page);
  await expect(headerLabel(page)).toHaveText("9 of 9 copies to print");

  // Grouped by print category, in the fixed order, each header with a checkbox.
  const labels = await page.locator(".group-header-label").allTextContents();
  expect(labels.map((s) => s.trim())).toEqual(["Pokémon", "Items", "Basic Energy"]);
  await expect(groupHeader(page, "Pokémon").locator(".group-header-check")).toHaveAttribute("data-state", "all");
  await expect(groupHeader(page, "Pokémon").locator("input")).toBeChecked();

  // Unchecking a group zeroes its cards.
  await groupHeader(page, "Basic Energy").locator("input").click();
  await expect(badge(page, energy)).toHaveText("0");
  await expect(groupHeader(page, "Basic Energy").locator(".group-header-check")).toHaveAttribute("data-state", "none");
  await expect(headerLabel(page)).toHaveText("5 of 9 copies to print");

  // + brings one copy back → the group is mixed (indeterminate checkbox).
  await tile(page, energy).locator(".card-thumb-plus").click();
  await expect(badge(page, energy)).toHaveText("1");
  await expect(groupHeader(page, "Basic Energy").locator(".group-header-check")).toHaveAttribute("data-state", "mixed");
  expect(await groupHeader(page, "Basic Energy").locator("input").evaluate((el) => (el as HTMLInputElement).indeterminate)).toBe(true);

  // + is capped at the deck count.
  const plus = tile(page, pokemon).locator(".card-thumb-plus");
  await expect(plus).toBeDisabled();
  await expect(badge(page, pokemon)).toHaveText("3");

  // Clicking a mixed group checkbox turns everything on.
  await groupHeader(page, "Basic Energy").locator("input").click();
  await expect(badge(page, energy)).toHaveText("4");
  await expect(headerLabel(page)).toHaveText("9 of 9 copies to print");
  await expect(printBar(page).getByRole("button", { name: "All" })).toBeDisabled();
  await expect(printBar(page).getByRole("button", { name: "Since last print" })).toBeDisabled();

  // 1 each → proof sheet; then drop the item entirely.
  await printBar(page).getByRole("button", { name: "1 each" }).click();
  await expect(headerLabel(page)).toHaveText("3 of 9 copies to print");
  await tile(page, item).locator(".card-thumb-minus").click();
  await expect(badge(page, item)).toHaveText("0");
  await expect(tile(page, item)).toHaveClass(/card-thumb-zero/);

  // Print… → layout dialog → sheet opens with the sparse counts override.
  await printBar(page).getByRole("button", { name: "Print…" }).click();
  await expect(page.getByTestId("print-dialog-summary")).toContainText("2 cards");
  const [popup] = await Promise.all([
    context.waitForEvent("page"),
    page.locator(".print-dialog .btn-primary").click(),
  ]);
  await popup.waitForURL(/\/print\.html/, { timeout: 10000 });
  const url = new URL(popup.url());
  expect(url.pathname).toBe("/print.html");
  expect(url.searchParams.get("deckId")).toBe(DECK_ID);
  expect(url.searchParams.get("auto")).toBe("1");
  expect(url.searchParams.get("counts")).toBe(`${pokemon.id}:1,${item.id}:0,${energy.id}:1`);
  await popup.close();

  // The print was recorded: "Since last print" now seeds the remainder.
  await expect(page.locator(".print-dialog")).toHaveCount(0);
  const since = printBar(page).getByRole("button", { name: "Since last print" });
  await expect(since).toBeEnabled();
  await since.click();
  await expect(badge(page, pokemon)).toHaveText("2");
  await expect(badge(page, item)).toHaveText("2");
  await expect(badge(page, energy)).toHaveText("3");
  await expect(headerLabel(page)).toHaveText("7 of 9 copies to print");

  // The plan survives a reload, keyed by deck.
  await page.reload();
  await gotoDeckBuild(page);
  await enterPrintMode(page);
  await expect(headerLabel(page)).toHaveText("7 of 9 copies to print");
  await expect(badge(page, energy)).toHaveText("3");

  // Esc leaves the mode: deck toolbar back, deck counts untouched.
  await page.keyboard.press("Escape");
  await expect(printBar(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Beautify" })).toBeVisible();
  await expect(badge(page, energy)).toHaveText("4");
  await expect(badge(page, item)).toHaveText("2");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("decklistgen-decklist") ?? "[]") as { count: number }[]);
  expect(stored.map((i) => i.count)).toEqual([3, 2, 4]);
});
