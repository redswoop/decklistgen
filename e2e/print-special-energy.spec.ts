import { test, expect, type Page } from "@playwright/test";

// Special energy (Energy card with effect text, e.g. Jet Energy) must be its own
// print-filter bucket: excluded only by `specialenergy`, never by the Pokemon or
// Trainer toggles, and never by the basic-energy toggle.

const SPECIAL_ENERGY_ID = "sv02-190"; // Jet Energy (has effect → special)

const cells = (p: Page) => p.locator(".print-cell");
const status = (p: Page) => p.locator(".status");

async function openPrint(page: Page, query: string) {
  await page.goto("/");
  await page.evaluate(
    (id) => sessionStorage.setItem("gallery-print-ids", JSON.stringify([id])),
    SPECIAL_ENERGY_ID,
  );
  await page.goto(`/print.html?gallery=1&${query}`);
  // Wait until the sheet renders or the "nothing to print" status shows.
  await page.locator(".print-sheet, .status").first().waitFor({ timeout: 15000 });
}

test("special energy survives the Pokemon exclusion", async ({ page }) => {
  await openPrint(page, "exclude=pokemon");
  await expect(cells(page)).toHaveCount(1);
});

test("special energy survives every Trainer exclusion", async ({ page }) => {
  await openPrint(page, "exclude=supporters,items,tools,stadiums");
  await expect(cells(page)).toHaveCount(1);
});

test("special energy survives the basic-energy toggle", async ({ page }) => {
  await openPrint(page, "noBasicEnergy=1");
  await expect(cells(page)).toHaveCount(1);
});

test("special energy IS removed by its own filter", async ({ page }) => {
  await openPrint(page, "exclude=specialenergy");
  await expect(cells(page)).toHaveCount(0);
  await expect(status(page)).toContainText("Nothing to print");
});
