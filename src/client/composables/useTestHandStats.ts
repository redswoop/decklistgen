import { ref, watch, onMounted, onUnmounted, getCurrentInstance, type Ref } from "vue";
import { runMonteCarlo, type SimResult } from "../../shared/utils/hand-sim.js";
import type { PlayOrder } from "../../shared/utils/hand-sim.js";
import type { Card } from "../../shared/types/card.js";

const TURNS = 5;
const ITERATIONS = 10000;

/**
 * Monte-Carlo "what will I see by turn N" stats for the test-hand panel.
 * Recomputes (debounced, so live count-tuning doesn't jank) whenever the deck or
 * play order changes. The sim itself (runMonteCarlo) is unit-tested in
 * hand-sim.test.ts; here we test the null/recompute wiring.
 */
export function useTestHandStats(deckCards: Ref<Card[]>, playOrder: Ref<PlayOrder>) {
  const stats = ref<SimResult | null>(null);
  let debounce: ReturnType<typeof setTimeout> | null = null;

  function recompute() {
    if (deckCards.value.length === 0) {
      stats.value = null;
      return;
    }
    stats.value = runMonteCarlo({
      deck: deckCards.value,
      iterations: ITERATIONS,
      turns: TURNS,
      order: playOrder.value,
    });
  }

  watch([deckCards, playOrder], () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(recompute, 150);
  });

  if (getCurrentInstance()) {
    onMounted(recompute);
    onUnmounted(() => {
      if (debounce) clearTimeout(debounce);
    });
  }

  return { stats, recompute, turns: TURNS };
}
