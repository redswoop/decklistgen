/**
 * Jumbo print (132mm × 185mm oversized promo size). Covers:
 *  1. Single-card render: /print.html?cardId=X&size=jumbo → one card, portrait.
 *  2. Two-up render: ?cardId=A,B&size=jumbo&orientation=landscape → two cards,
 *     one landscape sheet.
 *  3. art=original prints a plain image (no CSS chrome).
 *  4. The lightbox "Print Jumbo" button opens the pair-picker dialog, and the
 *     dialog builds the right print URL for one vs. two cards.
 *
 * Anonymous-friendly: jumbo print only touches public endpoints.
 */
import { test, expect } from "@playwright/test";

// 132mm × 185mm expressed in CSS px (96px/in) — what the print cell measures.
const JUMBO_W_PX = (132 / 25.4) * 96;
const JUMBO_H_PX = (185 / 25.4) * 96;

// Two card IDs that the server currently has loaded; resolved at runtime so the
// test doesn't depend on a specific boot set.
async function twoCardIds(page: import("@playwright/test").Page): Promise<[string, string]> {
  const res = await page.request.get("/api/cards?pageSize=2");
  const body = await res.json();
  const ids: string[] = body.cards.map((c: { id: string }) => c.id);
  expect(ids.length).toBeGreaterThanOrEqual(2);
  return [ids[0], ids[1]];
}

test.describe("Jumbo print", () => {
  test("renders a single card at jumbo size (132mm × 185mm)", async ({ page }) => {
    await page.goto("/");
    const [a] = await twoCardIds(page);

    await page.goto(`/print.html?cardId=${a}&size=jumbo&auto=0`);
    await page.waitForSelector(".print-cell .card", { timeout: 15000 });

    // Single-card mode → exactly one sheet, one cell, one rendered card.
    await expect(page.locator(".print-page-sheet")).toHaveCount(1);
    await expect(page.locator(".print-cell")).toHaveCount(1);

    const box = await page.locator(".print-cell").first().boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeCloseTo(JUMBO_W_PX, 0);
    expect(box!.height).toBeCloseTo(JUMBO_H_PX, 0);
  });

  test("renders two cards on one landscape sheet (2-up)", async ({ page }) => {
    await page.goto("/");
    const [a, b] = await twoCardIds(page);

    await page.goto(`/print.html?cardId=${a},${b}&size=jumbo&orientation=landscape&auto=0`);
    await page.waitForSelector(".print-cell .card", { timeout: 15000 });

    // Both cards land on a single sheet, two cells side-by-side.
    await expect(page.locator(".print-page-sheet")).toHaveCount(1);
    await expect(page.locator(".print-cell")).toHaveCount(2);

    const box = await page.locator(".print-cell").first().boundingBox();
    expect(box!.width).toBeCloseTo(JUMBO_W_PX, 0);
    expect(box!.height).toBeCloseTo(JUMBO_H_PX, 0);
  });

  test("art=original prints a plain card image (no CSS chrome)", async ({ page }) => {
    await page.goto("/");
    const [a] = await twoCardIds(page);

    await page.goto(`/print.html?cardId=${a}&size=jumbo&art=original&auto=0`);
    // Original/cleaned modes render a plain <img>, not the CSS .card.
    await page.waitForSelector(".print-cell .print-original", { timeout: 15000 });
    await expect(page.locator(".print-cell .card")).toHaveCount(0);

    const box = await page.locator(".print-cell").first().boundingBox();
    expect(box!.width).toBeCloseTo(JUMBO_W_PX, 0);
    expect(box!.height).toBeCloseTo(JUMBO_H_PX, 0);
  });

  // Capture the print URL by stubbing window.open. This is more robust than
  // waitForEvent("popup") here: the real popup carries auto=1, whose
  // window.print() can hang headless Chromium across sequential tests.
  async function captureOpenUrl(page: import("@playwright/test").Page): Promise<string> {
    return page.evaluate(() => (window as unknown as { __jumboOpenUrl?: string }).__jumboOpenUrl ?? "");
  }

  test("lightbox Print Jumbo opens the dialog; single card prints portrait", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".card-thumb", { timeout: 20000 });
    await page.locator(".card-thumb").first().click();
    await page.waitForSelector(".lb-modal", { timeout: 10000 });

    await page.locator(".lb-print-jumbo-btn").click();
    await expect(page.locator(".jumbo-dialog")).toBeVisible();

    await page.evaluate(() => {
      (window as unknown as { __jumboOpenUrl?: string }).__jumboOpenUrl = undefined;
      window.open = (u?: string | URL) => {
        (window as unknown as { __jumboOpenUrl?: string }).__jumboOpenUrl = String(u);
        return null;
      };
    });

    // No second card chosen → single-card portrait (no orientation=landscape).
    await page.locator(".jumbo-dialog .btn-primary").click();
    const url = await captureOpenUrl(page);
    expect(url).toContain("/print.html?");
    expect(url).toContain("size=jumbo");
    expect(url).toMatch(/cardId=[^,&]+(&|$)/); // single id, no comma
    expect(url).not.toContain("orientation=landscape");
    expect(url).toMatch(/art=(proxy|cleaned|original)/);
  });

  test("dialog with a second card prints 2-up landscape", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".card-thumb", { timeout: 20000 });
    await page.locator(".card-thumb").first().click();
    await page.waitForSelector(".lb-modal", { timeout: 10000 });

    await page.locator(".lb-print-jumbo-btn").click();
    await expect(page.locator(".jumbo-dialog")).toBeVisible();

    // Pick a "recent" card as the second slot.
    await page.locator(".jumbo-pick-grid .jumbo-pick").first().click();
    // Two-up becomes the selected layout once a second card is chosen.
    await expect(page.locator('.jumbo-radio input[value="two-up"]')).toBeChecked();

    await page.evaluate(() => {
      (window as unknown as { __jumboOpenUrl?: string }).__jumboOpenUrl = undefined;
      window.open = (u?: string | URL) => {
        (window as unknown as { __jumboOpenUrl?: string }).__jumboOpenUrl = String(u);
        return null;
      };
    });

    await page.locator(".jumbo-dialog .btn-primary").click();
    const url = await captureOpenUrl(page);
    expect(url).toContain("size=jumbo");
    expect(url).toContain("orientation=landscape");
    expect(decodeURIComponent(url)).toMatch(/cardId=[^&]+,[^&]+/); // two comma'd ids
  });

  test("search finds any card (not just deck/recent) and pairs it", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".card-thumb", { timeout: 20000 });
    await page.locator(".card-thumb").first().click();
    await page.waitForSelector(".lb-modal", { timeout: 10000 });

    await page.locator(".lb-print-jumbo-btn").click();
    await expect(page.locator(".jumbo-dialog")).toBeVisible();

    // The search box is the wired-up card search — typing a common species name
    // should surface results from the whole catalogue, not just in-view cards.
    await page.locator(".jumbo-search").fill("Pikachu");
    await page.waitForSelector(".jumbo-pick-grid .jumbo-pick", { timeout: 15000 });
    expect(await page.locator(".jumbo-pick-grid .jumbo-pick").count()).toBeGreaterThan(0);

    await page.locator(".jumbo-pick-grid .jumbo-pick").first().click();
    // Choosing a search result fills the second slot (search box disappears).
    await expect(page.locator(".jumbo-search")).toHaveCount(0);
    await expect(page.locator(".jumbo-slots .jumbo-slot")).toHaveCount(2);
  });

  test("each card carries its own version into the print URL", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".card-thumb", { timeout: 20000 });
    await page.locator(".card-thumb").first().click();
    await page.waitForSelector(".lb-modal", { timeout: 10000 });

    await page.locator(".lb-print-jumbo-btn").click();
    await expect(page.locator(".jumbo-dialog")).toBeVisible();

    // Fill the second slot from the recents.
    await page.locator(".jumbo-pick-grid .jumbo-pick").first().click();

    // Set card 1 → Original, card 2 → Proxy (independent per-slot controls).
    const slots = page.locator(".jumbo-slots .jumbo-slot");
    await slots.nth(0).getByRole("button", { name: "Original" }).click();
    await slots.nth(1).getByRole("button", { name: "Proxy" }).click();

    await page.evaluate(() => {
      (window as unknown as { __jumboOpenUrl?: string }).__jumboOpenUrl = undefined;
      window.open = (u?: string | URL) => {
        (window as unknown as { __jumboOpenUrl?: string }).__jumboOpenUrl = String(u);
        return null;
      };
    });

    await page.locator(".jumbo-dialog .btn-primary").click();
    const url = decodeURIComponent(await captureOpenUrl(page));
    // art list lines up 1:1 with the two card ids: card1=original, card2=proxy.
    expect(url).toMatch(/art=original,proxy/);
  });

  test("per-card art list prints the right chrome for each cell", async ({ page }) => {
    await page.goto("/");
    const [a, b] = await twoCardIds(page);

    // Card A original (plain img), card B proxy (CSS chrome) on one landscape sheet.
    await page.goto(
      `/print.html?cardId=${a},${b}&size=jumbo&orientation=landscape&art=original,proxy&auto=0`,
    );
    await page.waitForSelector(".print-cell", { timeout: 15000 });
    await expect(page.locator(".print-cell")).toHaveCount(2);

    // Exactly one plain image and one CSS-rendered card.
    await expect(page.locator(".print-cell .print-original")).toHaveCount(1);
    await expect(page.locator(".print-cell .card")).toHaveCount(1);
  });
});
