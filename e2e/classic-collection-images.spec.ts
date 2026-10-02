import { test, expect } from "@playwright/test";

// TCGdex has no scans for the 30th Classic Collection; card-store substitutes
// each card's original printing (server/services/image-stand-ins.ts). Without
// that, every tile in the set renders the text placeholder.
test("30th Classic Collection tiles render images, not placeholders", async ({ page }) => {
  await page.goto("/");
  await page.locator(".app-nav").waitFor({ timeout: 10000 });
  await page.locator(".app-nav-tabs .app-nav-tab", { hasText: "Browse" }).click();
  await page.locator(".inline-filter-bar").waitFor({ timeout: 10000 });
  await page.locator(".ifb-select").first().selectOption("me");
  await page.locator(".ifb-select-wide").selectOption("30CC");

  await expect.poll(() => page.locator(".card-thumb").count(), { timeout: 15000 }).toBe(30);
  await expect(page.locator(".card-thumb-placeholder")).toHaveCount(0);

  const imgs = page.locator(".card-thumb-img");
  await expect(imgs).toHaveCount(30);
  // Charizard → Base Set scan; make sure it actually decoded (grid order
  // depends on the persisted sort, so find it by name).
  const charizard = page.locator(".card-thumb-img[alt='Charizard']");
  await expect(charizard).toHaveAttribute("src", /base\/base1\/4\/low\.png$/);
  await charizard.scrollIntoViewIfNeeded();
  await expect.poll(() => charizard.evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 15000 }).toBeGreaterThan(0);
});

// TCGdex leaked <span class="energy-symbol"> / <em> into the 30th sets' effect
// text (shared/utils/clean-card-text.ts). Deep-link the lightbox and read it.
test("Pikachu & Zekrom-GX lightbox shows scrubbed effect text", async ({ page }) => {
  await page.goto("/?sets=30CC&era=me&card=30th-c-008#/browse");
  const attacks = page.locator(".lb-attack");
  await expect(attacks).toHaveCount(2, { timeout: 15000 });
  const texts = await page.locator(".lb-attack .lb-effect-text").allTextContents();
  for (const t of texts) expect(t).not.toMatch(/<\/?(span|em)/);
  expect(texts[1]).toContain("(in addition to this attack's cost)");
  // The {L} token is rendered as a glyph, so the raw text must not say "Lightning Energy".
  expect(texts.join(" ")).not.toContain("Lightning Energy");
});

// Raikou 30CC 012 reprints Vivid Voltage 50; MEG 048 is a different card that
// shares the name. The picker must not present MEG as a "version".
test("Raikou lightbox separates the different-card MEG printing from true versions", async ({ page }) => {
  await page.goto("/?sets=30CC&era=me&card=30th-c-012#/browse");
  const same = page.getByTestId("lb-same-card-grid");
  const other = page.getByTestId("lb-other-cards-grid");
  // VV 50 folds into the opened CC printing (same card + art), so one version
  // tile; MEG 048 lands in the other-cards group.
  await expect(other.locator(".card-thumb")).toHaveCount(1, { timeout: 15000 });
  await expect(same.locator(".card-thumb")).toHaveCount(1);
  await expect(page.getByTestId("lb-other-cards-header")).toContainText("1 other card named Raikou");
  await expect(page.locator(".lb-variants-status").first()).toHaveText("1 version");
  await expect(page.getByTestId("lb-generate-variants-btn")).toContainText("Generate 1");

  // Clicking the other card shows it in the main pane (120 HP vs 110).
  await other.locator(".card-thumb").click();
  await expect(page.locator(".lb-hp")).toHaveText("120 HP");
  await expect(page.locator(".lb-variants-status").first()).toHaveText("1 version");
});
