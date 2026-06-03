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

const { useGalleryFilter } = await import("./useGalleryFilter.js");
import type { GalleryCardWithSource } from "./useGalleryCardSource.js";

// templateForGalleryCard reads category/effect/stage/isFullArt; set those so the
// bucket is deterministic.
function card(p: Partial<GalleryCardWithSource>): GalleryCardWithSource {
  return { cardId: "x", name: "X", category: "Pokemon", isFullArt: true, ...p } as GalleryCardWithSource;
}

const CARDS = [
  card({ cardId: "svi-1", name: "Pikachu", isFullArt: true }), // pokemon-fullart
  card({ cardId: "svi-2", name: "Raichu", isFullArt: false }), // pokemon-standard
  card({ cardId: "svi-3", name: "Fire Energy", category: "Energy" }), // basic-energy
];

describe("useGalleryFilter", () => {
  beforeEach(() => localStorage.clear());

  it("persists the template filter", async () => {
    const f = useGalleryFilter(ref(CARDS));
    f.templateFilter.value = "trainer";
    await nextTick();
    expect(store["decklistgen-gallery-filter"]).toBe("trainer");
  });

  it("counts cards per template bucket", () => {
    const f = useGalleryFilter(ref(CARDS));
    expect(f.templateCounts.value["pokemon-fullart"]).toBe(1);
    expect(f.templateCounts.value["pokemon-standard"]).toBe(1);
    expect(f.templateCounts.value["basic-energy"]).toBe(1);
  });

  it("filters by search across name and id", () => {
    const f = useGalleryFilter(ref(CARDS));
    f.search.value = "raichu";
    expect(f.filteredCards.value.map((c) => c.cardId)).toEqual(["svi-2"]);
    f.search.value = "svi-3";
    expect(f.filteredCards.value.map((c) => c.name)).toEqual(["Fire Energy"]);
  });

  it("filters by template bucket", () => {
    const f = useGalleryFilter(ref(CARDS));
    f.templateFilter.value = "basic-energy";
    expect(f.filteredCards.value.map((c) => c.name)).toEqual(["Fire Energy"]);
  });
});
