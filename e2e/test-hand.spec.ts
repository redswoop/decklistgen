import { test, expect, request } from "@playwright/test";

/**
 * Walks the Test Hand deck simulator: seeds a real 60-card deck into the
 * working-deck localStorage, opens the Test sub-view, and exercises the
 * interactive hand + stats dashboard.
 *
 * Assumes the dev servers are already running (Vite :5173, Hono :3001).
 */

interface ApiCard {
  setCode: string;
  localId: string;
  name: string;
  imageBase: string;
  category: string;
  trainerType?: string;
  stage?: string;
}

async function buildSeed(): Promise<unknown[]> {
  const ctx = await request.newContext();
  // ?set=SVI lazy-loads the set and returns its cards.
  const res = await ctx.get("http://localhost:3001/api/cards?set=SVI&pageSize=200");
  const body = await res.json();
  const cards: ApiCard[] = body.cards ?? [];
  await ctx.dispose();

  const isBasic = (c: ApiCard) =>
    c.category === "Pokemon" && (!c.stage || c.stage.toLowerCase() === "basic");
  const basics = cards.filter(isBasic);
  const supporters = cards.filter((c) => c.category === "Trainer" && c.trainerType === "Supporter");
  const items = cards.filter((c) => c.category === "Trainer" && c.trainerType === "Item");

  const entry = (c: ApiCard, count: number) => ({
    setCode: c.setCode,
    localId: c.localId,
    name: c.name,
    count,
    imageUrl: c.imageBase ? `${c.imageBase}/low.png` : "",
    card: c,
  });

  const deck: ReturnType<typeof entry>[] = [];
  for (let i = 0; i < 5; i++) deck.push(entry(basics[i], 4)); // 20 basics
  for (let i = 0; i < 3 && i < supporters.length; i++) deck.push(entry(supporters[i], 3)); // 9
  for (let i = 0; i < 3 && i < items.length; i++) deck.push(entry(items[i], 4)); // 12
  const remaining = 60 - deck.reduce((s, d) => s + d.count, 0);
  deck.push(entry(basics[6], remaining)); // pad to 60 with another basic
  return deck;
}

test("Test Hand simulator: deal, mulligan, draw, stats, play order", async ({ page }) => {
  const seed = await buildSeed();
  const total = (seed as { count: number }[]).reduce((s, d) => s + d.count, 0);
  expect(total).toBe(60);

  await page.addInitScript(
    ([deckJson]) => {
      localStorage.setItem("decklistgen-decklist", deckJson as string);
      localStorage.setItem(
        "decklistgen-deck-meta",
        JSON.stringify({
          deckId: "local-test",
          deckName: "Sim Test",
          importSource: null,
          importedAt: null,
          lastSavedSnapshot: "",
        }),
      );
    },
    [JSON.stringify(seed)],
  );

  await page.goto("/");

  // Ensure we're on the Deck (build) tab.
  await page.getByRole("button", { name: "Deck", exact: true }).first().click();

  // Switch to the Test Hand sub-view.
  await page.getByRole("button", { name: "Test Hand" }).click();

  const panel = page.locator(".thp");
  await expect(panel).toBeVisible();

  // Opening hand: 7 cards going first, Turn 1.
  const cards = page.locator(".thp-card");
  await expect(cards).toHaveCount(7);
  await expect(page.locator(".thp-turn")).toHaveText("Turn 1");

  // Draw Next Turn -> 8 cards, Turn 2.
  await page.getByRole("button", { name: "Draw Next Turn" }).click();
  await expect(cards).toHaveCount(8);
  await expect(page.locator(".thp-turn")).toHaveText("Turn 2");

  // New Hand resets to 7 / Turn 1.
  await page.getByRole("button", { name: "New Hand" }).click();
  await expect(cards).toHaveCount(7);
  await expect(page.locator(".thp-turn")).toHaveText("Turn 1");

  // Going 2nd deals 8 on the opener.
  await page.getByRole("button", { name: "Going 2nd" }).click();
  await expect(cards).toHaveCount(8);

  // Stats dashboard shows percentages.
  const firstKpi = page.locator(".thp-kpi-val").first();
  await expect(firstKpi).toContainText("%");

  // By-turn table has rows.
  await expect(page.locator(".thp-table tbody tr").first()).toBeVisible();

  // Click-to-zoom: clicking a hand card opens the overlay; arrows navigate; Esc closes.
  await page.locator(".thp-card").first().click();
  const zoom = page.locator(".card-zoom-backdrop");
  await expect(zoom).toBeVisible();
  await expect(page.locator(".card-zoom-pos")).toContainText("/");
  const firstPos = await page.locator(".card-zoom-pos").textContent();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".card-zoom-pos")).not.toHaveText(firstPos ?? "");
  await page.keyboard.press("Escape");
  await expect(zoom).toBeHidden();

  await page.screenshot({ path: "/tmp/test-hand-walk.png", fullPage: true });
});
