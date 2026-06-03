import { describe, it, expect } from "bun:test";
import { ref } from "vue";
import { useCardZoom } from "./useCardZoom.js";
import type { Card } from "../../shared/types/card.js";

function cards(n: number): Card[] {
  return Array.from({ length: n }, (_, i) => ({ name: `c${i}`, imageBase: `b${i}` }) as Card);
}

describe("useCardZoom", () => {
  it("openZoom selects a card; closeZoom clears it", () => {
    const list = ref(cards(3));
    const z = useCardZoom(list);
    expect(z.zoomCard.value).toBeNull();
    z.openZoom(1);
    expect(z.zoomCard.value?.name).toBe("c1");
    z.closeZoom();
    expect(z.zoomCard.value).toBeNull();
  });

  it("zoomStep wraps around both ends", () => {
    const list = ref(cards(3));
    const z = useCardZoom(list);
    z.openZoom(2);
    z.zoomStep(1); // 2 -> 0
    expect(z.zoomIndex.value).toBe(0);
    z.zoomStep(-1); // 0 -> 2
    expect(z.zoomIndex.value).toBe(2);
  });

  it("zoomStep is a no-op when nothing is open or the list is empty", () => {
    const list = ref(cards(0));
    const z = useCardZoom(list);
    z.zoomStep(1);
    expect(z.zoomIndex.value).toBeNull();
    list.value = cards(2);
    z.zoomStep(1); // still closed
    expect(z.zoomIndex.value).toBeNull();
  });

  it("zoomCard is null when the index falls outside the list", () => {
    const list = ref(cards(2));
    const z = useCardZoom(list);
    z.openZoom(1);
    list.value = cards(1); // shrink under the open index
    expect(z.zoomCard.value).toBeNull();
  });
});
