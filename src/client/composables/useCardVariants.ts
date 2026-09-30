import { ref, computed, watch, type Ref } from "vue";
import type { Card } from "../../shared/types/card.js";
import { useVariants } from "./usePokeproxy.js";
import { deduplicateByArt, artTier } from "../../shared/utils/variant-allocation.js";

/**
 * Same-name variant set for the lightbox: fetches every printing, dedupes
 * same-art reprints, and tracks which one is selected (variantIndex /
 * currentCard). Also surfaces the same-art printings of the current card.
 */
export function useCardVariants(activeCard: Ref<Card>) {
  const activeCardId = computed(() => activeCard.value.id);
  const alwaysByName = ref(true);
  const { data: rawVariants } = useVariants(activeCardId, alwaysByName);
  // Pin the opened card as its art group's representative so a same-art
  // reprint can't replace it in the picker.
  const variants = computed(() =>
    rawVariants.value ? deduplicateByArt(rawVariants.value, activeCardId.value) : undefined,
  );
  const variantIndex = ref(0);

  // -1 (opened card missing from the set) falls through to activeCard rather
  // than silently showing whichever printing happens to be first.
  const currentCard = computed(() => {
    if (!variants.value?.length) return activeCard.value;
    return variants.value[variantIndex.value] ?? activeCard.value;
  });

  // Same-art printings of the current card (same card, illustrator + art tier, other set).
  const sameArtPrintings = computed(() => {
    if (!rawVariants.value) return [];
    const current = currentCard.value;
    if (!current.illustrator) return [];
    const currentTier = artTier(current.rarity);
    return rawVariants.value.filter(
      (v) =>
        v.id !== current.id &&
        v.mechanicsHash === current.mechanicsHash &&
        v.illustrator === current.illustrator &&
        artTier(v.rarity) === currentTier,
    );
  });

  watch([variants, activeCardId], () => {
    if (!variants.value) return;
    variantIndex.value = variants.value.findIndex((c) => c.id === activeCard.value.id);
  }, { immediate: true });

  const hasMultipleVariants = computed(() => (variants.value?.length ?? 1) > 1);

  return {
    activeCardId, rawVariants, variants, variantIndex, currentCard,
    sameArtPrintings, hasMultipleVariants,
  };
}
