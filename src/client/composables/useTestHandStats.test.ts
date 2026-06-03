import { describe, it, expect } from "bun:test";
import { ref } from "vue";
import { useTestHandStats } from "./useTestHandStats.js";
import type { Card } from "../../shared/types/card.js";

function basic(i: number): Card {
  return { id: `c${i}`, name: `Pikachu ${i}`, category: "Pokemon", stage: "Basic" } as Card;
}

describe("useTestHandStats", () => {
  it("leaves stats null while the deck is empty", () => {
    const deck = ref<Card[]>([]);
    const order = ref<"first" | "second">("first");
    const { stats, recompute } = useTestHandStats(deck, order);
    recompute();
    expect(stats.value).toBeNull();
  });

  it("computes a sim result once the deck has cards", () => {
    const deck = ref<Card[]>(Array.from({ length: 20 }, (_, i) => basic(i)));
    const order = ref<"first" | "second">("first");
    const { stats, recompute, turns } = useTestHandStats(deck, order);
    recompute();
    expect(stats.value).not.toBeNull();
    expect(stats.value!.byCard.length).toBeGreaterThan(0);
    // byTurn arrays are sized to the configured turn count.
    expect(stats.value!.byCard[0].byTurn.length).toBe(turns);
  });
});
