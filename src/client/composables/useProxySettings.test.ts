import { describe, test, expect } from "bun:test";

// The composable is now a thin wrapper around API calls.
// Integration behavior is tested via the server-side card-settings tests.
// This file validates the module shape.

describe("useProxySettings", () => {
  test("exports useProxySettings function", async () => {
    const mod = await import("./useProxySettings.js");
    expect(typeof mod.useProxySettings).toBe("function");
  });
});
