import { test, expect, type Page } from "@playwright/test";

// AdminPanel is a thin controller mounting four self-contained sections (Users /
// Codes / Magic Links / Sync). The test user isn't an admin and the routes are
// behind requireAdmin, so we stub /api/auth/me (to become admin) plus the three
// admin list endpoints with fixtures, open the panel, and walk every tab. This
// is the render regression guard for the section extraction; the section logic
// (parseMaxUses, linkStatus, formatDate) is unit-tested separately.

const ADMIN_USER = {
  id: "admin-1",
  email: "boss@test.local",
  displayName: "Boss Admin",
  isAdmin: true,
  isAuthorized: true,
  createdAt: "2026-01-01T12:00:00.000Z",
  updatedAt: "2026-01-01T12:00:00.000Z",
};

const USERS = [
  {
    id: "u-1",
    email: "alice@test.local",
    displayName: "Alice",
    isAdmin: false,
    isAuthorized: true,
    hasPassword: true,
    createdAt: "2026-02-01T12:00:00.000Z",
    updatedAt: "2026-02-01T12:00:00.000Z",
  },
];

const CODES = [
  {
    code: "WORKGROUP",
    label: "Pokemon Work Group",
    isAuthorized: true,
    maxUses: 10,
    useCount: 3,
    createdAt: "2026-03-01T12:00:00.000Z",
  },
];

const LINKS = [
  {
    token: "tok-123",
    email: "bob@test.local",
    displayName: "Bob",
    isAuthorized: true,
    isAdmin: false,
    expiresAt: "2030-01-01T00:00:00.000Z",
    usedAt: null,
    createdAt: "2026-04-01T12:00:00.000Z",
  },
];

async function json(route: import("@playwright/test").Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

async function openAdminPanel(page: Page) {
  await page.route("**/api/auth/me", (r) => json(r, ADMIN_USER));
  await page.route("**/api/admin/users", (r) => json(r, USERS));
  await page.route("**/api/admin/invite-codes", (r) => json(r, CODES));
  await page.route("**/api/admin/magic-links", (r) => json(r, LINKS));

  await page.goto("/");
  await page.waitForSelector(".app-nav", { timeout: 10000 });
  await page.locator(".user-menu-trigger").click();
  await page.getByRole("button", { name: "Admin Panel" }).click();
  await expect(page.locator(".admin-overlay")).toBeVisible();
}

test("Users tab renders the user table (default)", async ({ page }) => {
  await openAdminPanel(page);
  await expect(page.locator(".admin-table")).toBeVisible();
  await expect(page.getByText("Alice", { exact: true })).toBeVisible();
  await expect(page.getByText("alice@test.local")).toBeVisible();
});

test("Codes tab renders the create form and code list", async ({ page }) => {
  await openAdminPanel(page);
  await page.locator(".tab", { hasText: "Codes" }).click();
  await expect(page.getByText("Create Invite Code")).toBeVisible();
  await expect(page.locator(".code-value", { hasText: "WORKGROUP" })).toBeVisible();
  await expect(page.getByText("Pokemon Work Group")).toBeVisible();
});

test("Magic Links tab renders the form and link list", async ({ page }) => {
  await openAdminPanel(page);
  await page.locator(".tab", { hasText: "Magic Links" }).click();
  await expect(page.getByText("Create Magic Link")).toBeVisible();
  await expect(page.getByText("Bob", { exact: true })).toBeVisible();
  await expect(page.locator(".badge", { hasText: "pending" })).toBeVisible();
});

test("Sync tab mounts the sync panel", async ({ page }) => {
  await openAdminPanel(page);
  await page.locator(".tab", { hasText: "Sync" }).click();
  // SyncDecksPanel renders inside the admin body; just assert the tab switched
  // and the users table is gone.
  await expect(page.locator(".admin-table")).toHaveCount(0);
  await expect(page.locator(".tab.active", { hasText: "Sync" })).toBeVisible();
});
