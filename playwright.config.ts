import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:5173",
    headless: false,
    actionTimeout: 10_000,
  },
  webServer: undefined, // Assumes dev servers are already running
});
