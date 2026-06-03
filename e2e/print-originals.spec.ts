import { test, expect, type Page } from "@playwright/test";

// Bug guard: printing "originals" (art=original) must render the plain full-card
// scan, NOT the CSS proxy renderer composited on top of it. Proxy mode still uses
// the CSS renderer.

const renderer = (p: Page) => p.locator(".css-card-renderer");
const original = (p: Page) => p.locator("img.print-original");

async function seedGalleryAndOpen(page: Page, query: string) {
  // Grab a real card id, seed the gallery sessionStorage key (same origin),
  // then open the print sheet. sessionStorage persists across the navigation.
  await page.goto("/");
  const res = await page.request.get("/api/cards?era=sv&pageSize=1");
  const id = (await res.json()).cards[0].id as string;
  await page.evaluate(
    (cardId) =>
      sessionStorage.setItem("gallery-print-ids", JSON.stringify([cardId])),
    id,
  );
  await page.goto(`/print.html?gallery=1&${query}`);
  // Wait on the print sheet's readiness contract (see PRINT_SHEET.md), not on a
  // raw selector — ".print-sheet" is Lab.vue's surface; /print.html renders
  // ".print-page-sheet".
  await page.waitForFunction(
    () => document.documentElement.dataset.printState === "ready",
    { timeout: 15000 },
  );
}

test("originals print as a plain image, no CSS overlay", async ({ page }) => {
  await seedGalleryAndOpen(page, "art=original");

  await expect(original(page)).toHaveCount(1);
  await expect(original(page)).toBeVisible();
  // The proxy chrome renderer must NOT be mounted.
  await expect(renderer(page)).toHaveCount(0);
});

test("proxy mode still uses the CSS renderer", async ({ page }) => {
  await seedGalleryAndOpen(page, ""); // no art param → proxy/clean

  await expect(renderer(page)).toHaveCount(1);
  await expect(original(page)).toHaveCount(0);
});
