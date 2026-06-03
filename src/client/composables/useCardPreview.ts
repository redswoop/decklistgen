import { ref, computed, watch, type Ref } from "vue";
import type { Card } from "../../shared/types/card.js";
import type { DeckCard } from "../../shared/types/deck.js";
import type { DeckMembership } from "../../shared/types/customized-card.js";
import { api } from "../lib/client.js";
import { setCardParam } from "./useRoute.js";

interface CardPreviewOptions {
  /** The ?card= deep-link id from useRoute (drives back/forward sync). */
  previewCardId: Ref<string | null>;
  /** Working-deck items — the search set when previewing from a deck. */
  deckItems: Ref<{ card: Card }[]>;
  currentDeckName: Ref<string>;
}

/**
 * The lightbox preview state machine + URL deep-link sync. App keeps the
 * handlePreview / handleDeckPreview / handleCardsPreview mediators (children wire
 * to them) as the public surface; this composable owns the preview refs, the
 * effective search set, and the back/forward + on-mount hydration.
 */
export function useCardPreview(opts: CardPreviewOptions) {
  const previewCard = ref<Card | null>(null);
  const previewSource = ref<"grid" | "deck">("grid");
  const gridSearchCards = ref<Card[]>([]);
  const previewDeckMembership = ref<DeckMembership[] | undefined>(undefined);
  const previewDeckName = ref<string | undefined>(undefined);
  const previewSavedDeckId = ref<string | undefined>(undefined);
  const previewSavedDeckCards = ref<DeckCard[] | undefined>(undefined);

  const effectiveSearchCards = computed(() => {
    if (previewSource.value === "deck") return opts.deckItems.value.map((i) => i.card);
    return gridSearchCards.value;
  });

  function handlePreview(card: Card, cards: Card[]) {
    previewCard.value = card;
    gridSearchCards.value = cards;
    previewSource.value = "grid";
    previewDeckMembership.value = undefined;
    previewDeckName.value = undefined;
    previewSavedDeckId.value = undefined;
    previewSavedDeckCards.value = undefined;
    setCardParam(card.id);
  }

  function handleDeckPreview(card: Card) {
    previewCard.value = card;
    previewSource.value = "deck";
    previewDeckMembership.value = undefined;
    previewDeckName.value = opts.currentDeckName.value || undefined;
    previewSavedDeckId.value = undefined;
    previewSavedDeckCards.value = undefined;
    setCardParam(card.id);
  }

  function handleCardsPreview(card: Card, cards: Card[], membership?: DeckMembership[]) {
    previewCard.value = card;
    gridSearchCards.value = cards;
    previewSource.value = "grid";
    previewDeckMembership.value = membership;
    setCardParam(card.id);
  }

  function closeLightbox() {
    previewCard.value = null;
    setCardParam(null);
  }

  function handleCardChange(cardId: string) {
    setCardParam(cardId, true); // replaceState — don't pollute back stack
  }

  // React to back/forward changing the card param.
  watch(opts.previewCardId, async (id) => {
    if (!id) {
      previewCard.value = null;
      return;
    }
    if (!previewCard.value || previewCard.value.id !== id) {
      try {
        const card = await api.getCard(id);
        previewCard.value = card;
        gridSearchCards.value = [card];
        previewSource.value = "grid";
        previewDeckMembership.value = undefined;
      } catch {
        setCardParam(null, true);
      }
    }
  });

  /** Hydrate the lightbox from a ?card= deep-link on first load. */
  async function hydrate() {
    if (opts.previewCardId.value && !previewCard.value) {
      try {
        const card = await api.getCard(opts.previewCardId.value);
        previewCard.value = card;
        gridSearchCards.value = [card];
        previewSource.value = "grid";
      } catch {
        setCardParam(null, true);
      }
    }
  }

  return {
    previewCard, previewSource, gridSearchCards, previewDeckMembership,
    previewDeckName, previewSavedDeckId, previewSavedDeckCards, effectiveSearchCards,
    handlePreview, handleDeckPreview, handleCardsPreview, closeLightbox, handleCardChange,
    hydrate,
  };
}
