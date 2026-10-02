/**
 * Deck save mechanics: the Save button's enable/label policy and the paths
 * that used to desync the working deck from its saved copy (rename, clear +
 * undo, import merge/replace, beautify), plus Duplicate.
 *
 * Decks are seeded through the API and opened from the gallery after a reload
 * (the gallery's TanStack cache doesn't see raw-fetch creates).
 */
import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers/auth";

const TAG = `e2e-save-${Date.now()}`;

async function apiCreateDeck(page: Page, name: string, ids: [string, number][]): Promise<string> {
  return page.evaluate(async ({ name, ids }) => {
    const card = async (id: string) => (await fetch(`/api/cards/${id}`)).json();
    const cards = [];
    for (const [id, count] of ids) cards.push({ count, card: await card(id) });
    const resp = await fetch("/api/decks", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, cards }),
    });
    return (await resp.json()).id as string;
  }, { name, ids });
}

async function apiDeckTotal(page: Page, id: string): Promise<number> {
  return page.evaluate(async (id) => {
    const deck = await (await fetch(`/api/decks/${id}`, { credentials: "include" })).json();
    return deck.cards.reduce((s: number, c: { count: number }) => s + c.count, 0);
  }, id);
}

async function apiListNames(page: Page): Promise<string[]> {
  const decks: { name: string }[] = await page.evaluate(async () =>
    (await fetch(`/api/decks`, { credentials: "include" })).json(),
  );
  return decks.map((d) => d.name);
}

async function apiDeleteTagged(page: Page) {
  const decks: { id: string; name: string }[] = await page.evaluate(async () =>
    (await fetch(`/api/decks`, { credentials: "include" })).json(),
  );
  for (const d of decks) {
    if (!d.name.includes(TAG)) continue;
    await page.evaluate(async (id) => {
      await fetch(`/api/decks/${id}`, { method: "DELETE", credentials: "include" });
    }, d.id);
  }
}

async function freshApp(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem("decklistgen-decklist");
    localStorage.removeItem("decklistgen-deck-meta");
  });
  await page.reload();
  await page.waitForSelector(".app-nav", { timeout: 10000 });
  await page.locator(".app-nav button", { hasText: "Deck" }).first().click();
  const toGallery = page.locator(".dcb-gallery-btn");
  if (await toGallery.count()) await toGallery.click();
  await page.waitForSelector(".deck-gallery", { timeout: 5000 });
}

async function openDeck(page: Page, name: string) {
  await freshApp(page);
  await page.locator(".deck-gallery-card", { hasText: name }).first().click();
  await page.waitForSelector(".grid-search", { timeout: 5000 });
}

async function searchAndAdd(page: Page, query: string) {
  await page.locator(".grid-search").fill(query);
  await page.waitForSelector(".grid-search-result", { timeout: 8000 });
  await page.locator(".grid-search-result").first().click();
  await expect(page.locator(".grid-search-dropdown")).not.toBeVisible({ timeout: 3000 });
}

const saveBtn = (page: Page) => page.locator(".dcb-save-btn");
const deckCount = (page: Page) => page.locator(".dcb-count");

test.describe("Deck Save Flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.afterEach(async ({ page }) => {
    await apiDeleteTagged(page);
  });

  test("new deck: Save needs cards, then names and creates the deck", async ({ page }) => {
    await freshApp(page);
    await page.locator(".deck-gallery-btn", { hasText: "New Deck" }).click();
    await page.waitForSelector(".grid-search", { timeout: 5000 });

    await expect(saveBtn(page)).toHaveText("Save");
    await expect(saveBtn(page)).toBeDisabled();
    await expect(saveBtn(page)).toHaveAttribute("title", "Add cards first");

    await searchAndAdd(page, "Charmander");
    await expect(saveBtn(page)).toBeEnabled();
    await expect(page.locator(".dcb-unsaved")).toBeVisible();

    await saveBtn(page).click();
    const dialog = page.locator(".save-deck-dialog");
    await expect(dialog.locator("h3")).toHaveText("Save Deck");
    await dialog.locator("input").fill(`${TAG}-new`);
    await dialog.locator(".btn-primary").click();
    await expect(dialog).not.toBeVisible();

    await expect(page.locator(".dcb-name")).toHaveText(`${TAG}-new`);
    await expect(saveBtn(page)).toHaveText("Save");
    await expect(saveBtn(page)).toBeDisabled();
    await expect(saveBtn(page)).toHaveAttribute("title", "No unsaved changes");
    await expect(page.locator(".dcb-unsaved")).toHaveCount(0);
    expect(await apiListNames(page)).toContain(`${TAG}-new`);
  });

  test("rename while dirty keeps the changes unsaved until Save", async ({ page }) => {
    const id = await apiCreateDeck(page, `${TAG}-rename`, [["sv01-001", 2], ["sv01-172", 1]]);
    await openDeck(page, `${TAG}-rename`);
    await page.locator(".card-thumb-plus").first().click();
    await expect(deckCount(page)).toHaveText("4/60");

    await page.locator(".dcb-name").click();
    await page.locator(".dcb-rename-input").fill(`${TAG}-renamed`);
    await page.keyboard.press("Enter");
    await expect(page.locator(".dcb-name")).toHaveText(`${TAG}-renamed`);

    // Still dirty: the server only has the name so far.
    await expect(saveBtn(page)).toBeEnabled();
    await expect(page.locator(".dcb-unsaved")).toBeVisible();
    expect(await apiDeckTotal(page, id)).toBe(3);

    await saveBtn(page).click();
    await expect(saveBtn(page)).toBeDisabled();
    expect(await apiDeckTotal(page, id)).toBe(4);
  });

  test("clear then undo keeps the deck's identity (no orphan)", async ({ page }) => {
    await apiCreateDeck(page, `${TAG}-clear`, [["sv01-001", 2]]);
    await openDeck(page, `${TAG}-clear`);

    await page.locator(".dm-action-btn", { hasText: "Clear" }).click();
    const confirm = page.locator(".dialog", { hasText: "Clear Deck" });
    await expect(confirm).toContainText("You can undo this");
    await confirm.locator("button", { hasText: /^Clear$/ }).click();
    await expect(deckCount(page)).toHaveText("0/60");
    // Clearing a saved deck is an edit, not a close.
    await expect(page.locator(".dcb-name")).toHaveText(`${TAG}-clear`);
    await expect(saveBtn(page)).toBeEnabled();

    await page.locator(".dcb-undo-btn").click();
    await expect(deckCount(page)).toHaveText("2/60");
    await expect(page.locator(".dcb-name")).toHaveText(`${TAG}-clear`);
    await expect(saveBtn(page)).toBeDisabled();
    await expect(saveBtn(page)).toHaveAttribute("title", "No unsaved changes");
  });

  test("clear then Save stores an empty deck", async ({ page }) => {
    const id = await apiCreateDeck(page, `${TAG}-empty`, [["sv01-001", 2]]);
    await openDeck(page, `${TAG}-empty`);
    await page.locator(".dm-action-btn", { hasText: "Clear" }).click();
    await page.locator(".dialog", { hasText: "Clear Deck" }).locator("button", { hasText: /^Clear$/ }).click();
    await saveBtn(page).click();
    await expect(saveBtn(page)).toBeDisabled();
    expect(await apiDeckTotal(page, id)).toBe(0);
  });

  test("import merge adds to the loaded deck instead of creating another", async ({ page }) => {
    const id = await apiCreateDeck(page, `${TAG}-merge`, [["sv01-001", 2]]);
    await openDeck(page, `${TAG}-merge`);

    await page.locator(".dm-action-btn", { hasText: "Import" }).click();
    const dialog = page.locator(".import-dialog");
    await dialog.locator("input[type=radio][value=merge]").check();
    await expect(dialog.locator(".import-name-input")).toBeDisabled();
    await dialog.locator("textarea").fill("1 Mew ex SVI 151");
    await dialog.locator("button", { hasText: /^Import$/ }).click();
    await expect(dialog.locator(".import-success")).toContainText("Save to keep them");
    await dialog.locator("button", { hasText: "Done" }).click();

    await expect(page.locator(".dcb-name")).toHaveText(`${TAG}-merge`);
    await expect(deckCount(page)).toHaveText("3/60");
    await expect(saveBtn(page)).toBeEnabled();
    expect(await apiDeckTotal(page, id)).toBe(2);
    const before = await apiListNames(page);
    expect(before.filter((n) => n === "Pasted deck")).toHaveLength(0);

    await saveBtn(page).click();
    await expect(saveBtn(page)).toBeDisabled();
    expect(await apiDeckTotal(page, id)).toBe(3);
  });

  test("beautify on a dirty deck keeps the unsaved edits", async ({ page }) => {
    await apiCreateDeck(page, `${TAG}-beautify`, [["sv01-001", 2]]);
    await openDeck(page, `${TAG}-beautify`);
    await page.locator(".card-thumb-plus").first().click();
    await page.locator(".card-thumb-plus").first().click();
    await expect(deckCount(page)).toHaveText("4/60");

    await page.locator(".dm-action-btn", { hasText: "Beautify" }).click();
    await page.locator(".beautify-action-btn.primary").click();
    await expect(page.locator(".beautify-dialog, .dialog-overlay")).toHaveCount(0, { timeout: 15000 });

    await expect(deckCount(page)).toHaveText("4/60");
    await expect(saveBtn(page)).toBeEnabled();
  });

  test("duplicate copies the working deck and switches to the copy", async ({ page }) => {
    const id = await apiCreateDeck(page, `${TAG}-orig`, [["sv01-001", 2]]);
    await openDeck(page, `${TAG}-orig`);
    await page.locator(".card-thumb-plus").first().click();

    await page.locator(".dm-action-btn", { hasText: "Duplicate" }).click();
    const dialog = page.locator(".save-deck-dialog");
    await expect(dialog.locator("h3")).toHaveText("Duplicate Deck");
    await expect(dialog.locator("input")).toHaveValue(`${TAG}-orig (Copy)`);
    await dialog.locator(".btn-primary").click();
    await expect(dialog).not.toBeVisible();

    await expect(page.locator(".dcb-name")).toHaveText(`${TAG}-orig (Copy)`);
    await expect(deckCount(page)).toHaveText("3/60");
    await expect(saveBtn(page)).toBeDisabled();
    // The original is untouched; the copy holds the working state.
    expect(await apiDeckTotal(page, id)).toBe(2);
    expect(await apiListNames(page)).toContain(`${TAG}-orig (Copy)`);
  });
});
