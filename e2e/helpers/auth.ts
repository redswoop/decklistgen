import type { Page } from "@playwright/test";

export const TEST_EMAIL = "claude@test.local";
export const TEST_PASSWORD = "playwright-test-2024";

/**
 * Programmatic login. Posts to /api/auth/login to set the session cookie,
 * then navigates to / and waits for the main nav. Skips the click-to-open
 * sign-in dialog the UI now uses since anonymous browsing became default.
 */
export async function login(page: Page): Promise<void> {
  await page.context().request.post("/api/auth/login", {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  await page.goto("/");
  await page.waitForSelector(".app-nav", { timeout: 10000 });
}
