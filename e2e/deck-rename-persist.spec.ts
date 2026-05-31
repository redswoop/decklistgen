import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth.js";

// Verifies a deck rename through the DeckContextBar actually reaches the server,
// not just localStorage. Creates a throwaway deck via the API, renames it in the
// UI, then reads it back from the server to confirm persistence. Cleans up after.

test("renaming a saved deck persists to the server", async ({ page }) => {
  await login(page);

  // A real card to give the deck a body.
  const cardRes = await page.request.get("/api/cards?era=sv&pageSize=1");
  const card = (await cardRes.json()).cards[0];

  const origName = "Rename Persist — Original";
  const newName = "Rename Persist — Updated";

  const createRes = await page.request.post("/api/decks", {
    data: { name: origName, cards: [{ count: 1, card }] },
  });
  expect(createRes.ok()).toBeTruthy();
  const deckId = (await createRes.json()).id as string;

  try {
    // Make it the current working deck so the context bar shows its name.
    await page.evaluate(
      ({ id, name }) => {
        localStorage.setItem(
          "decklistgen-deck-meta",
          JSON.stringify({
            deckId: id,
            deckName: name,
            importSource: null,
            importedAt: null,
            lastSavedSnapshot: "",
          }),
        );
      },
      { id: deckId, name: origName },
    );
    await page.reload();
    await page.locator(".app-nav").waitFor({ timeout: 10000 });

    const nameBtn = page.locator(".dcb-name");
    await expect(nameBtn).toHaveText(origName);

    // Rename via the UI: click the name → edit → Enter.
    await nameBtn.click();
    const input = page.locator(".dcb-rename-input");
    await input.fill(newName);
    await input.press("Enter");

    // UI reflects the change…
    await expect(page.locator(".dcb-name")).toHaveText(newName);

    // …and the server actually persisted it (the real assertion).
    await expect
      .poll(
        async () => {
          const r = await page.request.get(`/api/decks/${deckId}`);
          return (await r.json()).name;
        },
        { timeout: 10000 },
      )
      .toBe(newName);
  } finally {
    await page.request.delete(`/api/decks/${deckId}`);
  }
});
