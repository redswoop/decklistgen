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

const { useGalleryPreview } = await import("./useGalleryPreview.js");

describe("useGalleryPreview", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to editing mode at 180px and persists changes", async () => {
    const phys = ref({ w: 240, h: 336 });
    const p = useGalleryPreview(phys);
    expect(p.previewMode.value).toBe("editing");
    expect(p.previewThumbWidth.value).toBe(180);

    p.editingThumbWidth.value = 220;
    expect(p.previewThumbWidth.value).toBe(220);
    await nextTick();
    expect(store["decklistgen-gallery-zoom"]).toBe("220");
  });

  it("physical mode uses the rounded calibrated width", async () => {
    const phys = ref({ w: 239.6, h: 335 });
    const p = useGalleryPreview(phys);
    p.previewMode.value = "physical";
    expect(p.previewThumbWidth.value).toBe(240);
    await nextTick();
    expect(store["decklistgen-gallery-preview-mode"]).toBe("physical");
  });

  it("initializes from persisted mode and zoom", () => {
    store["decklistgen-gallery-preview-mode"] = "editing";
    store["decklistgen-gallery-zoom"] = "150";
    const p = useGalleryPreview(ref({ w: 240, h: 336 }));
    expect(p.previewThumbWidth.value).toBe(150);
  });
});
