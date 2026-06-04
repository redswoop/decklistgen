import { computed, type Ref } from "vue";
import type { GalleryCardWithSource } from "./useGalleryCardSource.js";
import { usePersistentRef } from "./usePersistentRef.js";

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
  const selectedCardId = usePersistentRef<string | null>(SELECTED_LS_KEY, null);

  const activeCard = computed<GalleryCardWithSource | null>(() => {
    if (!selectedCardId.value || !cards.value) return null;
    return cards.value.find((c) => c.cardId === selectedCardId.value) ?? null;
  });

  function selectCard(card: GalleryCardWithSource) {
    selectedCardId.value = card.cardId;
    opts.onChange?.();
  }

  function selectCardById(cardId: string) {
    const card = cards.value?.find((c) => c.cardId === cardId);
    if (card) selectCard(card);
  }

  function deselectCard() {
    selectedCardId.value = null;
    opts.onChange?.();
  }

  return { selectedCardId, activeCard, selectCard, selectCardById, deselectCard };
}
