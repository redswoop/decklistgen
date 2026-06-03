import { describe, it, expect, beforeEach } from "bun:test";
import { ref } from "vue";

const store: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  length: 0,
  key: () => null,
};

const { useGallerySelection } = await import("./useGallerySelection.js");
import type { GalleryCardWithSource } from "./useGalleryCardSource.js";

function card(id: string): GalleryCardWithSource {
  return { cardId: id, name: id } as GalleryCardWithSource;
}

describe("useGallerySelection", () => {
  beforeEach(() => localStorage.clear());

  it("selects a card, exposes activeCard, and persists the id", () => {
    const cards = ref([card("a"), card("b")]);
    const s = useGallerySelection(cards);
    s.selectCard(cards.value[1]);
    expect(s.selectedCardId.value).toBe("b");
    expect(s.activeCard.value?.cardId).toBe("b");
    expect(store["decklistgen-gallery-selected"]).toBe("b");
  });

  it("initializes selection from persisted storage", () => {
    store["decklistgen-gallery-selected"] = "a";
    const cards = ref([card("a")]);
    const s = useGallerySelection(cards);
    expect(s.activeCard.value?.cardId).toBe("a");
  });

  it("selectCardById ignores ids not in the set", () => {
    const cards = ref([card("a")]);
    const s = useGallerySelection(cards);
    s.selectCardById("missing");
    expect(s.selectedCardId.value).toBeNull();
    s.selectCardById("a");
    expect(s.selectedCardId.value).toBe("a");
  });

  it("deselect clears the id and storage", () => {
    const cards = ref([card("a")]);
    const s = useGallerySelection(cards);
    s.selectCard(cards.value[0]);
    s.deselectCard();
    expect(s.selectedCardId.value).toBeNull();
    expect(store["decklistgen-gallery-selected"]).toBeUndefined();
  });

  it("fires onChange after select and deselect", () => {
    const cards = ref([card("a")]);
    let n = 0;
    const s = useGallerySelection(cards, { onChange: () => n++ });
    s.selectCard(cards.value[0]);
    s.deselectCard();
    expect(n).toBe(2);
  });
});
