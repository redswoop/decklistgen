import { ref, computed, watch, type Ref } from "vue";
import type { Card } from "../../shared/types/card.js";

/**
 * Lightbox search-set navigation. `activeCard` is the source of truth and stays
 * stable across searchCards mutations (e.g. a deck decrement that removes an
 * item) — searchIndex is derived from its id, so the lightbox doesn't shift to a
 * neighbour when the list shrinks.
 */
export function useCardNavigation(card: Ref<Card>, searchCards: Ref<Card[]>) {
  const activeCard = ref<Card>(card.value);

  watch(() => card.value.id, () => {
    activeCard.value = card.value;
  });

  const searchIndex = computed(() =>
    searchCards.value.findIndex((c) => c.id === activeCard.value.id),
  );

  function prevCard() {
    const idx = searchIndex.value;
    if (idx > 0) activeCard.value = searchCards.value[idx - 1];
  }
  function nextCard() {
    const idx = searchIndex.value;
    if (idx >= 0 && idx < searchCards.value.length - 1) {
      activeCard.value = searchCards.value[idx + 1];
    }
  }

  return { activeCard, searchIndex, prevCard, nextCard };
}
