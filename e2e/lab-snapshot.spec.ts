/**
 * Snapshot the card lab grid. Use this during iteration to eyeball
 * cross-card alignment after CSS / theme changes — particularly the
 * fullart header (name / evolves-from / HP) and energy-circle styling.
 *
 * Not a regression test: writes to test-results/ and never asserts on
 * pixel diffs. The page should already be served by the dev server on
 * :5173 (Playwright config has webServer: undefined).
 */

import { test } from "@playwright/test";

test("lab fullart cards — visual snapshot", async ({ page }) => {
  await page.goto("/lab.html");
  await page.waitForLoadState("networkidle");

  // Ensure web fonts have loaded before snapshotting so we don't capture
  // the system fallback face for Gill Sans / Frutiger / EssentiarumTCG.
  await page.evaluate(async () => {
    await (document as any).fonts.ready;
  });

  // Bump zoom up so the snapshot is legible at full screen height.
  const zoom = page.locator('input[type="range"]');
  await zoom.fill("0.4");

  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.screenshot({
    path: "test-results/lab-fullart-grid.png",
    fullPage: true,
  });

  // Detail shot: zoom to 0.8 and capture one card (Mega Charizard X) so
  // the header / energy / footer details are legible for visual review.
  // Indices below account for 4 trainers prepended to the grid.
  const TRAINERS = 4;
  await zoom.fill("0.8");
  await page.setViewportSize({ width: 1400, height: 2000 });

  // Trainer details — Iono (plain supporter), Forest Seal Stone (VSTAR Power),
  // Switch (item, no clean art so shows dark fallback).
  const iono = page.locator(".card-frame").nth(0);
  await iono.scrollIntoViewIfNeeded();
  await iono.screenshot({ path: "test-results/lab-iono-detail.png" });

  const sealStone = page.locator(".card-frame").nth(2);
  await sealStone.scrollIntoViewIfNeeded();
  await sealStone.screenshot({ path: "test-results/lab-forest-seal-stone-detail.png" });

  const charizard = page.locator(".card-frame").nth(TRAINERS + 4);
  await charizard.scrollIntoViewIfNeeded();
  await charizard.screenshot({ path: "test-results/lab-charizard-detail.png" });

  // Also snapshot Lunala (has evolves-from + ability-style attack block).
  const lunala = page.locator(".card-frame").nth(TRAINERS + 0);
  await lunala.scrollIntoViewIfNeeded();
  await lunala.screenshot({ path: "test-results/lab-lunala-detail.png" });

  // Meowscarada — has an ability (so the ability pill renders).
  const meow = page.locator(".card-frame").nth(TRAINERS + 2);
  await meow.scrollIntoViewIfNeeded();
  await meow.screenshot({ path: "test-results/lab-meowscarada-detail.png" });

  // Flying Pikachu VMAX — text-fallback suffix logo (no PNG ships for VMAX).
  const flyingPika = page.locator(".card-frame").nth(TRAINERS + 6);
  await flyingPika.scrollIntoViewIfNeeded();
  await flyingPika.screenshot({ path: "test-results/lab-flying-pikachu-vmax-detail.png" });

  // Surfing Pikachu V — exercises the V PNG logo.
  const surfingPika = page.locator(".card-frame").nth(TRAINERS + 7);
  await surfingPika.scrollIntoViewIfNeeded();
  await surfingPika.screenshot({ path: "test-results/lab-surfing-pikachu-v-detail.png" });

  // Charizard VSTAR — exercises the VSTAR PNG logo and renders 2 attacks.
  const charizardVstar = page.locator(".card-frame").nth(TRAINERS + 8);
  await charizardVstar.scrollIntoViewIfNeeded();
  await charizardVstar.screenshot({ path: "test-results/lab-charizard-vstar-detail.png" });

  // Volcanion — has "Put 2 {R} Energy..." in attack effect text. The {R}
  // token MUST render as an inline colored EssentiarumTCG glyph, not as
  // the literal "{R}" string. This is the parity check for the new
  // EnergyTokenText component.
  const volcanion = page.locator(".card-frame").nth(TRAINERS + 9);
  await volcanion.scrollIntoViewIfNeeded();
  await volcanion.screenshot({ path: "test-results/lab-volcanion-inline-energy-detail.png" });
});
