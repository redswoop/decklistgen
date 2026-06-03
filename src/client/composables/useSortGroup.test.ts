import { describe, it, expect, beforeEach } from "bun:test";
import { ref, nextTick } from "vue";

const store: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  length: 0,
  key: () => null,
};

const { useSortGroup } = await import("./useSortGroup.js");
import { SAME_ART, SAME_CARD } from "../../shared/utils/fold-cards.js";

describe("useSortGroup", () => {
  beforeEach(() => localStorage.clear());

  it("starts from defaults (alpha asc, no grouping, stack on)", () => {
    const sg = useSortGroup(ref("browse"));
    expect(sg.groupBy.value).toBe("none");
    expect(sg.sortBy.value).toBe("alpha");
    expect(sg.sortDir.value).toBe("asc");
    expect(sg.stackReprints.value).toBe(true);
    expect(sg.sortGroupLabel.value).toBe("Alphabetical ↑");
  });

  it("loads persisted state", () => {
    store["decklistgen-sort-group"] = JSON.stringify({ groupBy: "set", sortBy: "rarity", sortDir: "desc" });
    const sg = useSortGroup(ref("browse"));
    expect(sg.groupBy.value).toBe("set");
    expect(sg.sortGroupLabel.value).toBe("Set / Rarity ↓");
  });

  it("persists changes to localStorage", async () => {
    const sg = useSortGroup(ref("deck"));
    sg.sortBy.value = "count";
    await nextTick();
    expect(JSON.parse(store["decklistgen-sort-group"]).sortBy).toBe("count");
  });

  it("toggleSortDir flips direction", () => {
    const sg = useSortGroup(ref("browse"));
    sg.toggleSortDir();
    expect(sg.sortDir.value).toBe("desc");
  });

  it("maps fold strategy by context", () => {
    const ctx = ref<"browse" | "deck" | "cards">("browse");
    const sg = useSortGroup(ctx as never);
    // browse: stackReprints on -> SAME_ART
    expect(sg.foldStrategy.value).toBe(SAME_ART);
    sg.stackReprints.value = false;
    expect(sg.foldStrategy.value).toBeNull();

    ctx.value = "deck";
    sg.deckFoldMode.value = "same-art";
    expect(sg.foldStrategy.value).toBe(SAME_ART);
    sg.deckFoldMode.value = "by-card";
    expect(sg.foldStrategy.value).toBe(SAME_CARD);
    sg.deckFoldMode.value = "off";
    expect(sg.foldStrategy.value).toBeNull();

    ctx.value = "cards";
    expect(sg.foldStrategy.value).toBeNull();
  });
});
