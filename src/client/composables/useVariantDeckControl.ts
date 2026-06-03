import { computed, type Ref } from "vue";
import type { Card } from "../../shared/types/card.js";
import type { DeckCard } from "../../shared/types/deck.js";
import { useDecklist } from "./useDecklist.js";
import { useDecks } from "./useDecks.js";
import { addVariant, removeVariant, swapVariant } from "../../shared/utils/variant-deck-ops.js";

interface VariantDeckControlOptions {
  isDeckContext: Ref<boolean>;
  savedDeckId: Ref<string | undefined>;
  savedDeckCards: Ref<DeckCard[] | undefined>;
  activeCard: Ref<Card>;
  variants: Ref<Card[] | undefined>;
  /** Called after a saved-deck mutation so the host can emit deckUpdated. */
  onDeckUpdated: () => void;
}

/**
 * Variant-picker deck operations. Two paths: the working deck (useDecklist) and a
 * saved deck (useDecks.updateDeck over savedDeckCards). The saved-deck array math
 * lives in the pure variant-deck-ops helpers; this composable wires the path
 * choice, the per-variant counts, and the swap anchor.
 */
export function useVariantDeckControl(opts: VariantDeckControlOptions) {
  const { addCard, removeCard, getDeckCount, items: deckItems, swapCard } = useDecklist();
  const { updateDeck } = useDecks();

  // Deck-stack entry for the lightbox's anchor card (the swap source).
  const activeDeckEntry = computed(() => {
    if (!opts.isDeckContext.value) return undefined;
    const { setCode, localId } = opts.activeCard.value;
    if (opts.savedDeckCards.value) {
      return opts.savedDeckCards.value.find(
        (dc) => dc.card.setCode === setCode && dc.card.localId === localId,
      );
    }
    return deckItems.value.find((i) => i.setCode === setCode && i.localId === localId);
  });

  const variantCounts = computed(() => {
    const counts = new Map<string, number>();
    if (!opts.variants.value) return counts;
    for (const v of opts.variants.value) {
      const count = opts.savedDeckCards.value
        ? opts.savedDeckCards.value.find(
            (dc) => dc.card.setCode === v.setCode && dc.card.localId === v.localId,
          )?.count ?? 0
        : getDeckCount(v.setCode, v.localId);
      counts.set(v.id, count);
    }
    return counts;
  });

  function getVariantDeckCount(v: Card): number {
    return variantCounts.value.get(v.id) ?? 0;
  }

  const totalNameCount = computed(() => {
    let sum = 0;
    for (const c of variantCounts.value.values()) sum += c;
    return sum;
  });

  async function saveDeck(cards: DeckCard[]) {
    await updateDeck({ id: opts.savedDeckId.value!, data: { cards } });
    opts.onDeckUpdated();
  }

  async function handleVariantAdd(v: Card) {
    if (opts.savedDeckId.value && opts.savedDeckCards.value) {
      await saveDeck(addVariant(opts.savedDeckCards.value, v));
    } else {
      addCard(v);
    }
  }

  async function handleVariantRemove(v: Card) {
    if (opts.savedDeckCards.value && opts.savedDeckId.value) {
      await saveDeck(removeVariant(opts.savedDeckCards.value, v));
    } else {
      removeCard(v.setCode, v.localId);
    }
  }

  // Swap-to-this-printing: replace all copies of activeCard with N copies of `v`.
  // After swap the lightbox stays anchored on activeCard (now count 0); the
  // onUnmounted sweep cleans it up on close.
  async function handleVariantSwap(v: Card) {
    if (!opts.isDeckContext.value || v.id === opts.activeCard.value.id) return;
    const entryCount = activeDeckEntry.value?.count ?? 0;
    if (entryCount <= 0) return;
    const from = { setCode: opts.activeCard.value.setCode, localId: opts.activeCard.value.localId };
    if (opts.savedDeckId.value && opts.savedDeckCards.value) {
      await saveDeck(swapVariant(opts.savedDeckCards.value, from, v));
    } else {
      swapCard(from.setCode, from.localId, v);
    }
  }

  return {
    activeDeckEntry, variantCounts, getVariantDeckCount, totalNameCount,
    handleVariantAdd, handleVariantRemove, handleVariantSwap,
  };
}
