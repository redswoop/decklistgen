/**
 * Regression: a saved deck can hold count-0 entries (a card removed in the
 * grid but not swept before saving). The deck-print URL's sparse `counts=`
 * never mentions them, and the sheet used to print one copy of each. Seen
 * live on a prod deck with three ghost cards.
 */
import { test, expect, type Page } from "@playwright/test";
import { login, TEST_EMAIL, TEST_PASSWORD } from "./helpers/auth";

const DECK_NAME = "E2E Zero Count Print";

async function ensureTestUser(page: Page): Promise<void> {
  const resp = await page.request.post("/api/auth/register", {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD, displayName: "Playwright Test" },
  });
  if (!resp.ok() && resp.status() !== 409) {
    throw new Error(`register failed: ${resp.status()} ${await resp.text()}`);
  }
}

async function createDeck(page: Page): Promise<string> {
  return page.evaluate(async (name) => {
    const card = async (id: string) => (await fetch(`/api/cards/${id}`)).json();
    const resp = await fetch("/api/decks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        cards: [
          { count: 2, card: await card("sv01-001") },
          { count: 0, card: await card("sv01-006") }, // removed in the grid, never swept
          { count: 1, card: await card("sv01-172") },
        ],
      }),
    });
    if (!resp.ok) throw new Error(`createDeck failed: ${resp.status}`);
    return ((await resp.json()) as { id: string }).id;
  }, DECK_NAME);
}

async function deleteTestDecks(page: Page): Promise<void> {
  await page.evaluate(async (name) => {
    const resp = await fetch("/api/decks", { credentials: "include" });
    if (!resp.ok) return;
    const decks = (await resp.json()) as Array<{ id: string; name: string }>;
    for (const d of decks) {
      if (d.name === name) await fetch(`/api/decks/${d.id}`, { method: "DELETE", credentials: "include" });
    }
  }, DECK_NAME);
}

test.describe("/print.html deck path", () => {
  test.beforeEach(async ({ page }) => {
    await ensureTestUser(page);
    await login(page);
    await deleteTestDecks(page);
  });
  test.afterEach(async ({ page }) => {
    await deleteTestDecks(page);
  });

  test("count-0 deck entries print nothing", async ({ page }) => {
    const deckId = await createDeck(page);

    await page.goto(`/print.html?deckId=${deckId}&art=original&auto=0`);
    await page.waitForFunction(
      () => ["ready", "empty", "error"].includes(document.documentElement.dataset.printState ?? ""),
      { timeout: 20000 },
    );
    expect(await page.evaluate(() => document.documentElement.dataset.printState)).toBe("ready");

    // 2 + 0 + 1 → three cells; the count-0 card must not appear at all.
    const cells = page.locator(".print-cell");
    await expect(cells).toHaveCount(3);
    const srcs = await cells.locator("img").evaluateAll((imgs) => imgs.map((i) => i.getAttribute("src") ?? ""));
    expect(srcs.filter((s) => s.includes("sv01-001"))).toHaveLength(2);
    expect(srcs.filter((s) => s.includes("sv01-172"))).toHaveLength(1);
    expect(srcs.some((s) => s.includes("sv01-006"))).toBe(false);
  });
});
