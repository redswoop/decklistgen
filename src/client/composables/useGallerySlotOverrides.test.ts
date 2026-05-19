import { describe, test, expect, beforeEach } from "bun:test";

// Mock localStorage before importing the composable so module-level init
// (loadFromLS at import time) sees the mock.
const store: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = val; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  length: 0,
  key: () => null,
};

const { useGallerySlotOverrides } = await import("./useGallerySlotOverrides.js");

const LS_KEY = "decklistgen-gallery-slot-overrides";

describe("useGallerySlotOverrides", () => {
  beforeEach(() => {
    // Module-scoped state means we have to clear via the public API rather
    // than re-importing. Clear every key the previous test might have set.
    const { overrides, clearOverride } = useGallerySlotOverrides();
    for (const k of Object.keys(overrides.value)) clearOverride(k);
    localStorage.clear();
  });

  test("starts empty", () => {
    const { overrides, getOverride } = useGallerySlotOverrides();
    expect(overrides.value).toEqual({});
    expect(getOverride("sv01-001")).toBeNull();
  });

  test("setOverride persists to localStorage", () => {
    const { setOverride, getOverride } = useGallerySlotOverrides();
    setOverride("sv01-001", "sv02-016");
    expect(getOverride("sv01-001")).toBe("sv02-016");
    expect(JSON.parse(localStorage.getItem(LS_KEY)!)).toEqual({ "sv01-001": "sv02-016" });
  });

  test("setOverride to the same id as original clears the override", () => {
    const { setOverride, getOverride } = useGallerySlotOverrides();
    setOverride("sv01-001", "sv02-016");
    setOverride("sv01-001", "sv01-001");
    expect(getOverride("sv01-001")).toBeNull();
  });

  test("clearOverride removes the entry", () => {
    const { setOverride, clearOverride, getOverride } = useGallerySlotOverrides();
    setOverride("sv01-001", "sv02-016");
    clearOverride("sv01-001");
    expect(getOverride("sv01-001")).toBeNull();
    expect(JSON.parse(localStorage.getItem(LS_KEY)!)).toEqual({});
  });

  test("multiple slot overrides coexist", () => {
    const { setOverride, getOverride, overrides } = useGallerySlotOverrides();
    setOverride("sv01-001", "sv02-016");
    setOverride("cel25-15", "sv03-012");
    expect(getOverride("sv01-001")).toBe("sv02-016");
    expect(getOverride("cel25-15")).toBe("sv03-012");
    expect(Object.keys(overrides.value).sort()).toEqual(["cel25-15", "sv01-001"]);
  });

  test("setting a new override for the same slot replaces the old value", () => {
    const { setOverride, getOverride } = useGallerySlotOverrides();
    setOverride("sv01-001", "sv02-016");
    setOverride("sv01-001", "sv03-099");
    expect(getOverride("sv01-001")).toBe("sv03-099");
  });

  test("overrides ref is reactive — values reflect set/clear immediately", () => {
    const { overrides, setOverride, clearOverride } = useGallerySlotOverrides();
    setOverride("sv01-001", "sv02-016");
    expect(overrides.value["sv01-001"]).toBe("sv02-016");
    clearOverride("sv01-001");
    expect(overrides.value["sv01-001"]).toBeUndefined();
  });
});
