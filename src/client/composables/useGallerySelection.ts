import { ref, computed, type Ref } from "vue";
import type { GalleryCardWithSource } from "./useGalleryCardSource.js";

const SELECTED_LS_KEY = "decklistgen-gallery-selected";

/**
 * Right-rail selection for the gallery, persisted across reload. `onChange` fires
 * after any selection change so the controller can reset transient status (clean
 * progress, prompt-save) tied to the previously selected card.
 */
export function useGallerySelection(
  cards: Ref<GalleryCardWithSource[] | undefined>,
  opts: { onChange?: () => void } = {},
) {
  const selectedCardId = ref<string | null>(localStorage.getItem(SELECTED_LS_KEY));

  const activeCard = computed<GalleryCardWithSource | null>(() => {
    if (!selectedCardId.value || !cards.value) return null;
    return cards.value.find((c) => c.cardId === selectedCardId.value) ?? null;
  });

  function selectCard(card: GalleryCardWithSource) {
    selectedCardId.value = card.cardId;
    localStorage.setItem(SELECTED_LS_KEY, card.cardId);
    opts.onChange?.();
  }

  function selectCardById(cardId: string) {
    const card = cards.value?.find((c) => c.cardId === cardId);
    if (card) selectCard(card);
  }

  function deselectCard() {
    selectedCardId.value = null;
    localStorage.removeItem(SELECTED_LS_KEY);
    opts.onChange?.();
  }

  return { selectedCardId, activeCard, selectCard, selectCardById, deselectCard };
}
