import { describe, test, expect, beforeEach } from "bun:test";

// Mock localStorage for Node/Bun environment
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const key of Object.keys(store)) delete store[key]; },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

// @ts-expect-error - mock for test environment
globalThis.localStorage = mockLocalStorage;

// Must be imported after localStorage mock is set up
// Using dynamic import to ensure mock is in place
let useProxySettings: typeof import("./useProxySettings.js").useProxySettings;

describe("useProxySettings", () => {
  beforeEach(async () => {
    mockLocalStorage.clear();
    // Re-import to get fresh state
    const mod = await import("./useProxySettings.js");
    useProxySettings = mod.useProxySettings;
  });

  test("getSettings returns empty object for unknown card", () => {
    const { getSettings } = useProxySettings();
    const settings = getSettings("SV1", "001");
    expect(settings).toEqual({});
  });

  test("updateSettings stores and retrieves settings", () => {
    const { getSettings, updateSettings } = useProxySettings();
    updateSettings("SV1", "001", { fontSize: 32 });
    const settings = getSettings("SV1", "001");
    expect(settings.fontSize).toBe(32);
  });

  test("updateSettings merges with existing settings", () => {
    const { getSettings, updateSettings } = useProxySettings();
    updateSettings("SV1", "001", { fontSize: 32 });
    updateSettings("SV1", "001", { maxCover: 0.4 });
    const settings = getSettings("SV1", "001");
    expect(settings.fontSize).toBe(32);
    expect(settings.maxCover).toBe(0.4);
  });

  test("clearSettings removes card settings", () => {
    const { getSettings, updateSettings, clearSettings } = useProxySettings();
    updateSettings("SV1", "001", { fontSize: 32 });
    clearSettings("SV1", "001");
    const settings = getSettings("SV1", "001");
    expect(settings).toEqual({});
  });
});
