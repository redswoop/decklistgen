import { ref, computed, onMounted, onUnmounted, getCurrentInstance, type Ref } from "vue";
import type { Card } from "../../shared/types/card.js";

/**
 * Click-to-zoom over a list of cards with wrap-around keyboard navigation
 * (← / → step, Esc close). Reusable across the test-hand panel, lightbox, etc.
 * Takes the cards as a Ref so the zoomed card stays in sync if the list changes.
 *
 * The window keydown listener is bound only when used inside a component
 * (guarded by getCurrentInstance) so the index logic can be unit-tested by
 * calling this composable directly.
 */
export function useCardZoom(cards: Ref<Card[]>) {
  const zoomIndex = ref<number | null>(null);

  const zoomCard = computed(() =>
    zoomIndex.value !== null ? cards.value[zoomIndex.value] ?? null : null,
  );

  function openZoom(i: number) {
    zoomIndex.value = i;
  }

  function closeZoom() {
    zoomIndex.value = null;
  }

  function zoomStep(delta: number) {
    if (zoomIndex.value === null || cards.value.length === 0) return;
    const n = cards.value.length;
    zoomIndex.value = (zoomIndex.value + delta + n) % n;
  }

  function onZoomKey(e: KeyboardEvent) {
    if (zoomIndex.value === null) return;
    if (e.key === "Escape") closeZoom();
    else if (e.key === "ArrowRight") zoomStep(1);
    else if (e.key === "ArrowLeft") zoomStep(-1);
  }

  if (getCurrentInstance()) {
    onMounted(() => window.addEventListener("keydown", onZoomKey));
    onUnmounted(() => window.removeEventListener("keydown", onZoomKey));
  }

  return { zoomIndex, zoomCard, openZoom, closeZoom, zoomStep };
}
