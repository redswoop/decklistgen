import { describe, it, expect, beforeEach } from "bun:test";
import { nextTick } from "vue";

// Mock localStorage before importing the composable (module reads it at call time).
const store: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = val; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  length: 0,
  key: () => null,
};

const { useCardVersion } = await import("./useCardVersion.js");

describe("useCardVersion", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to 'proxy' when nothing is stored", () => {
    const { selectedVersion } = useCardVersion();
    expect(selectedVersion.value).toBe("proxy");
  });

  it("initializes from the persisted value", () => {
    store["decklistgen-card-version"] = "cleaned";
    const { selectedVersion } = useCardVersion();
    expect(selectedVersion.value).toBe("cleaned");
  });

  it("selectVersion updates the ref and writes through to localStorage", async () => {
    const { selectedVersion, selectVersion } = useCardVersion();
    selectVersion("original");
    expect(selectedVersion.value).toBe("original");
    await nextTick();
    expect(store["decklistgen-card-version"]).toBe("original");
  });
});
