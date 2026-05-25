import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";

// Phase B verification: the `headered` template-set renders cards with a top
// header pill instead of floating name/HP/evolves-from. Loads the SVG into a
// Page and screenshots it for visual comparison with default.

const CARDS = [
  { label: "pokemon-standard", id: "me01-001" }, // Bulbasaur — Basic Pokemon
  { label: "trainer", id: "me01-113" }, // Iono
  { label: "basic-energy", id: "mee-001" }, // Grass Energy
  { label: "pokemon-fullart", id: "me01-003" }, // Mega Venusaur ex (fullart)
];

test.describe.serial("Headered set rendering", () => {
  test("headered set is discoverable via the sets API", async ({ request }) => {
    const resp = await request.get("/gallery/editor/sets");
    expect(resp.ok()).toBe(true);
    const sets = await resp.json();
    const ids = sets.map((s: any) => s.id);
    expect(ids).toContain("headered");
    expect(ids).toContain("default");
  });

  for (const { label, id } of CARDS) {
    test(`renders ${label} (${id}) in both default and headered`, async ({ page }) => {
      for (const setId of ["default", "headered"] as const) {
        await page.goto(`/api/pokeproxy/svg/${id}?deckSetId=${setId}`);
        await page.waitForSelector("svg", { timeout: 15000 });
        const screenshot = await page.locator("svg").screenshot();
        const out = test.info().outputPath(`${label}-${setId}.png`);
        writeFileSync(out, screenshot);
      }
    });
  }
});
