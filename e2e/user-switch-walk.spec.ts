import { test, expect, type Page, type Route } from "@playwright/test";

// Verification walk for the "decks don't update when logging in as a different
// user until refresh" bug. Two users are simulated via route interception so we
// don't need a second real account. Asserts the gallery swaps from user A's
// decks to user B's decks across a sign-out / sign-in WITHOUT a page reload.

const USER_A = { id: "user-a", email: "a@test.local", displayName: "Alice", isAdmin: false, isAuthorized: true, createdAt: "", updatedAt: "" };
const USER_B = { id: "user-b", email: "b@test.local", displayName: "Bob", isAdmin: false, isAuthorized: true, createdAt: "", updatedAt: "" };

function summary(id: string, name: string) {
  return { id, name, cardCount: 0, uniqueCards: 0, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
}

const DECKS_A = [summary("a1", "Alice Deck One")];
const DECKS_B = [summary("b1", "Bob Deck Only")];

async function json(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

test("logging in as a different user refreshes the deck gallery without a reload", async ({ page }) => {
  let loggedIn: typeof USER_A | typeof USER_B | null = null;

  // Auth state driven by `loggedIn`.
  await page.route("**/api/auth/me", (r) => {
    if (loggedIn) return json(r, loggedIn);
    return r.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "unauthorized" }) });
  });
  await page.route("**/api/auth/login", async (r) => {
    const body = JSON.parse(r.request().postData() ?? "{}");
    loggedIn = body.email === USER_B.email ? USER_B : USER_A;
    await json(r, loggedIn);
  });
  await page.route("**/api/auth/logout", async (r) => {
    loggedIn = null;
    await json(r, { ok: true });
  });
  // Decks scoped to whoever is logged in.
  await page.route("**/api/decks", (r) => json(r, loggedIn === USER_B ? DECKS_B : DECKS_A));

  async function signIn(email: string) {
    await page.locator(".sign-in-btn").click();
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill("whatever-1");
    await page.getByRole("button", { name: "Log In" }).click();
    await expect(page.locator(".sign-in-btn")).toHaveCount(0);
  }

  await page.goto("/");
  await page.waitForSelector(".app-nav");

  // --- Sign in as Alice, open Deck tab, see Alice's deck ---
  await signIn(USER_A.email);
  await page.getByRole("button", { name: "Deck", exact: true }).click();
  await expect(page.getByText("Alice Deck One")).toBeVisible();
  await expect(page.locator(".deck-gallery-title")).toHaveText("Your Decks");

  // --- Sign out, then sign in as Bob (no page reload) ---
  await page.locator(".user-menu-trigger").click();
  await page.getByRole("button", { name: /Sign Out|Log Out/i }).click();
  await signIn(USER_B.email);
  await page.getByRole("button", { name: "Deck", exact: true }).click();

  // The gallery must now show Bob's deck and NOT Alice's — the bug was that
  // Alice's cached decks lingered until a manual refresh.
  await expect(page.getByText("Bob Deck Only")).toBeVisible();
  await expect(page.getByText("Alice Deck One")).toHaveCount(0);
});
