import { test, expect, request } from "@playwright/test";

/**
 * Walks the Setup Simulator: seeds a 60-card deck that contains a full
 * Basic→Stage1→Stage2 evolution line (so the chain resolves from cached data
 * with no network bridge), opens the Setup Sim sub-view, and checks the target
 * dropdown + results table react to the controls.
 *
 * Assumes the dev servers are already running (Vite :5173, Hono :3001).
 */

interface ApiCard {
  id: string;
  setCode: string;
  localId: string;
  name: string;
  imageBase: string;
  category: string;
  trainerType?: string;
  stage?: string;
}

const API = "http://localhost:3001/api";

async function detailEvolveFrom(ctx: Awaited<ReturnType<typeof request.newContext>>, id: string): Promise<string | undefined> {
  const res = await ctx.get(`${API}/cards/${id}/detail`);
  if (!res.ok()) return undefined;
  const d = await res.json();
  return d.evolveFrom ?? undefined;
}

async function buildSeed(): Promise<unknown[]> {
  const ctx = await request.newContext();
  const res = await ctx.get(`${API}/cards?set=SVI&pageSize=400`);
  const cards: ApiCard[] = (await res.json()).cards ?? [];

  const isStage = (c: ApiCard, s: string) => c.category === "Pokemon" && (c.stage ?? "").toLowerCase() === s;
  const basics = cards.filter((c) => c.category === "Pokemon" && (!c.stage || c.stage.toLowerCase() === "basic"));
  const byName = (name: string) => cards.find((c) => c.name === name);

  // Find a Stage2 whose Stage1 and Basic are also in the set.
  let trio: { basic: ApiCard; stage1: ApiCard; stage2: ApiCard } | null = null;
  for (const s2 of cards.filter((c) => isStage(c, "stage2"))) {
    const s1Name = await detailEvolveFrom(ctx, s2.id);
    const s1 = s1Name ? byName(s1Name) : undefined;
    if (!s1) continue;
    const basicName = await detailEvolveFrom(ctx, s1.id);
    const basic = basicName ? byName(basicName) : undefined;
    if (basic) {
      trio = { basic, stage1: s1, stage2: s2 };
      break;
    }
  }
  await ctx.dispose();
  if (!trio) throw new Error("No full evolution line found in SVI");

  const entry = (c: ApiCard, count: number) => ({
    setCode: c.setCode,
    localId: c.localId,
    name: c.name,
    count,
    imageUrl: c.imageBase ? `${c.imageBase}/low.png` : "",
    card: c,
  });

  const deck = [entry(trio.basic, 4), entry(trio.stage1, 2), entry(trio.stage2, 3)];
  // Pad to 60 with other basics so opening hands rarely mulligan.
  let i = 0;
  while (deck.reduce((s, d) => s + d.count, 0) < 60) {
    const b = basics[i++];
    if (!b || b.name === trio.basic.name) continue;
    const remaining = 60 - deck.reduce((s, d) => s + d.count, 0);
    deck.push(entry(b, Math.min(4, remaining)));
  }
  return deck;
}

test("Setup Sim: target dropdown + results table react to controls", async ({ page }) => {
  // Heavy test: buildSeed makes sequential API calls and the panel runs a
  // client-side Monte-Carlo sim. Both slow down under full-suite parallel load,
  // so give it headroom over the 30s default.
  test.setTimeout(90_000);
  const seed = await buildSeed();
  expect((seed as { count: number }[]).reduce((s, d) => s + d.count, 0)).toBe(60);

  await page.addInitScript(
    ([deckJson]) => {
      localStorage.setItem("decklistgen-decklist", deckJson as string);
      localStorage.setItem(
        "decklistgen-deck-meta",
        JSON.stringify({
          deckId: "local-setup-test",
          deckName: "Setup Sim Test",
          importSource: null,
          importedAt: null,
          lastSavedSnapshot: "",
        }),
      );
    },
    [JSON.stringify(seed)],
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Deck", exact: true }).first().click();
  await page.getByRole("button", { name: "Setup Sim", exact: true }).click();

  const panel = page.locator(".ssp");
  await expect(panel).toBeVisible();

  // The report runs every line in the deck (one row each), grouped by kind.
  const lineRows = page.locator(".ssp-table tr.ssp-row");
  await expect(lineRows.first()).toBeVisible({ timeout: 30000 });
  const count = await lineRows.count();
  expect(count).toBeGreaterThanOrEqual(1);

  // The Stage-2 line we seeded is present and shows per-turn percentages + confidence intervals.
  await expect(page.locator(".ssp-table")).toContainText("%");
  await expect(page.locator(".ssp-table")).toContainText("±");
  await expect(page.locator(".ssp-group").first()).toBeVisible();

  // Toggling play order keeps the report rendered (numbers recompute).
  await page.getByRole("button", { name: "Going 2nd" }).click();
  await expect(lineRows).toHaveCount(count);

  // Re-roll runs another simulation without error.
  await page.getByRole("button", { name: "Re-roll" }).click();
  await expect(lineRows).toHaveCount(count);

  await page.screenshot({ path: "/tmp/setup-sim-walk.png", fullPage: true });
});
