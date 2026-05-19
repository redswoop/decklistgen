import { describe, test, expect, beforeEach } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import {
  getTextModeOverride,
  saveTextModeOverride,
  resetTextModeOverrides,
  getAllTextModeOverrides,
} from "./text-mode-store.js";

const STORE_PATH = process.env.TEXT_MODE_OVERRIDE_STORE_PATH!;

beforeEach(() => {
  resetTextModeOverrides();
});

describe("text-mode-store", () => {
  test("returns empty object when no override is set", () => {
    expect(getTextModeOverride("sv01-001")).toEqual({});
  });

  test("save + retrieve a textMode override", () => {
    saveTextModeOverride("sv01-001", { textMode: "dark" });
    expect(getTextModeOverride("sv01-001")).toEqual({ textMode: "dark" });
  });

  test("save + retrieve an hpTextMode override", () => {
    saveTextModeOverride("sv01-001", { hpTextMode: "light" });
    expect(getTextModeOverride("sv01-001")).toEqual({ hpTextMode: "light" });
  });

  test("save both fields together", () => {
    saveTextModeOverride("sv01-001", { textMode: "dark", hpTextMode: "light" });
    expect(getTextModeOverride("sv01-001")).toEqual({
      textMode: "dark",
      hpTextMode: "light",
    });
  });

  test("subsequent saves merge — unspecified field is preserved", () => {
    saveTextModeOverride("sv01-001", { textMode: "dark" });
    saveTextModeOverride("sv01-001", { hpTextMode: "light" });
    expect(getTextModeOverride("sv01-001")).toEqual({
      textMode: "dark",
      hpTextMode: "light",
    });
  });

  test("passing null clears just that field", () => {
    saveTextModeOverride("sv01-001", { textMode: "dark", hpTextMode: "light" });
    saveTextModeOverride("sv01-001", { textMode: null });
    expect(getTextModeOverride("sv01-001")).toEqual({ hpTextMode: "light" });
  });

  test("clearing both fields removes the entry from the store entirely", () => {
    saveTextModeOverride("sv01-001", { textMode: "dark", hpTextMode: "light" });
    saveTextModeOverride("sv01-001", { textMode: null, hpTextMode: null });
    expect(getTextModeOverride("sv01-001")).toEqual({});
    expect(getAllTextModeOverrides()).toEqual({});
  });

  test("invalid mode values are ignored", () => {
    // Cast through unknown so we can pass garbage at runtime.
    saveTextModeOverride("sv01-001", { textMode: "purple" as unknown as "dark" });
    expect(getTextModeOverride("sv01-001")).toEqual({});
  });

  test("multiple cards keep separate overrides", () => {
    saveTextModeOverride("sv01-001", { textMode: "dark" });
    saveTextModeOverride("sv01-002", { textMode: "light" });
    expect(getTextModeOverride("sv01-001")).toEqual({ textMode: "dark" });
    expect(getTextModeOverride("sv01-002")).toEqual({ textMode: "light" });
  });

  test("persists to disk", () => {
    saveTextModeOverride("sv01-001", { textMode: "dark" });
    expect(existsSync(STORE_PATH)).toBe(true);
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf-8"));
    expect(raw).toEqual({ "sv01-001": { textMode: "dark" } });
  });

  test("resetTextModeOverrides deletes the file", () => {
    saveTextModeOverride("sv01-001", { textMode: "dark" });
    expect(existsSync(STORE_PATH)).toBe(true);
    resetTextModeOverrides();
    expect(existsSync(STORE_PATH)).toBe(false);
    expect(getTextModeOverride("sv01-001")).toEqual({});
  });

  test("file uses env-var override path (not the project's real data file)", () => {
    // Sanity check that we're not nuking the user's data — the env-var must be
    // a per-process temp path (see tests/setup-test-env.ts).
    expect(STORE_PATH).toContain("decklistgen-test-");
    expect(STORE_PATH).not.toContain("/data/text-mode-overrides.json");
  });
});
