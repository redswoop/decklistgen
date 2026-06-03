import { test, expect, type Page, type Route } from "@playwright/test";

// SyncDecksPanel is a three-phase wizard (connect -> pick -> result) reached via
// Admin -> Sync. The remote server and admin routes can't run in the test env,
// so we stub /api/auth/me (become admin) plus the two sync endpoints and drive
// the full happy path. This is the safety net for Pass 2's controller/leaf
// extraction — written against current behavior, must stay green after.

const ADMIN_USER = {
  id: "admin-1",
  email: "boss@test.local",
  displayName: "Boss Admin",
  isAdmin: true,
  isAuthorized: true,
  createdAt: "2026-01-01T12:00:00.000Z",
  updatedAt: "2026-01-01T12:00:00.000Z",
};

const REMOTE_DECKS = {
  url: "https://remote.example.com",
  decks: [
    { id: "d-1", name: "Charizard Control", cardCount: 60, updatedAt: "2026-05-01T12:00:00.000Z" },
    { id: "d-2", name: "Lost Box", cardCount: 60, updatedAt: "2026-05-02T12:00:00.000Z" },
  ],
};

const IMPORT_RESULT = {
  imported: ["d-1"],
  skipped: [],
  overwritten: [],
  errors: [],
};

function json(route: Route, body: unknown) {
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

async function openSyncTab(page: Page) {
  await page.route("**/api/auth/me", (r) => json(r, ADMIN_USER));
  await page.route("**/api/admin/users", (r) => json(r, []));
  await page.route("**/api/admin/sync/list", (r) => json(r, REMOTE_DECKS));
  await page.route("**/api/admin/sync/import", (r) => json(r, IMPORT_RESULT));

  await page.goto("/");
  await page.waitForSelector(".app-nav", { timeout: 10000 });
  await page.locator(".user-menu-trigger").click();
  await page.getByRole("button", { name: "Admin Panel" }).click();
  await page.locator(".tab", { hasText: "Sync" }).click();
  await expect(page.locator(".sync-panel")).toBeVisible();
}

test("connect phase validates and advances to pick", async ({ page }) => {
  await openSyncTab(page);
  const connect = page.getByRole("button", { name: "Connect" });
  await expect(connect).toBeDisabled();

  await page.getByPlaceholder("https://decklistgen.example.com").fill("https://remote.example.com");
  await page.getByPlaceholder("you@example.com").fill("me@test.local");
  await page.getByPlaceholder("password on remote server").fill("secret");
  await expect(connect).toBeEnabled();

  await connect.click();
  await expect(page.getByText("Pick decks to import")).toBeVisible();
  await expect(page.getByText("Charizard Control")).toBeVisible();
  await expect(page.getByText("Lost Box")).toBeVisible();
});

test("pick phase selects decks and imports to the result phase", async ({ page }) => {
  await openSyncTab(page);
  await page.getByPlaceholder("https://decklistgen.example.com").fill("https://remote.example.com");
  await page.getByPlaceholder("you@example.com").fill("me@test.local");
  await page.getByPlaceholder("password on remote server").fill("secret");
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByText("Pick decks to import")).toBeVisible();

  // Import button disabled with nothing selected, enabled after selecting all.
  const importBtn = page.locator(".form-submit", { hasText: "Import" });
  await expect(importBtn).toBeDisabled();
  await page.getByRole("button", { name: "Select all" }).click();
  await expect(page.getByText("2 of 2 selected")).toBeVisible();
  await expect(importBtn).toBeEnabled();

  await importBtn.click();
  await expect(page.getByText("Sync complete")).toBeVisible();
  await expect(page.locator(".result-stats")).toContainText("1");
  await expect(page.getByRole("button", { name: "Pick more decks" })).toBeVisible();
});

test("result phase can return to pick", async ({ page }) => {
  await openSyncTab(page);
  await page.getByPlaceholder("https://decklistgen.example.com").fill("https://remote.example.com");
  await page.getByPlaceholder("you@example.com").fill("me@test.local");
  await page.getByPlaceholder("password on remote server").fill("secret");
  await page.getByRole("button", { name: "Connect" }).click();
  await page.getByRole("button", { name: "Select all" }).click();
  await page.locator(".form-submit", { hasText: "Import" }).click();
  await expect(page.getByText("Sync complete")).toBeVisible();

  await page.getByRole("button", { name: "Pick more decks" }).click();
  await expect(page.getByText("Pick decks to import")).toBeVisible();
});
