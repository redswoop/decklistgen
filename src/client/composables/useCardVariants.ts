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
  const variants = computed(() =>
    rawVariants.value ? deduplicateByArt(rawVariants.value) : undefined,
  );
  const variantIndex = ref(0);

  const currentCard = computed(() => {
    if (!variants.value?.length) return activeCard.value;
    return variants.value[variantIndex.value] ?? activeCard.value;
  });

  // Same-art printings of the current card (same illustrator + art tier, other set).
  const sameArtPrintings = computed(() => {
    if (!rawVariants.value) return [];
    const current = currentCard.value;
    if (!current.illustrator) return [];
    const currentTier = artTier(current.rarity);
    return rawVariants.value.filter(
      (v) => v.id !== current.id && v.illustrator === current.illustrator && artTier(v.rarity) === currentTier,
    );
  });

  watch([variants, activeCardId], () => {
    if (!variants.value) return;
    const idx = variants.value.findIndex((c) => c.id === activeCard.value.id);
    variantIndex.value = idx >= 0 ? idx : 0;
  }, { immediate: true });

  const hasMultipleVariants = computed(() => (variants.value?.length ?? 1) > 1);

  return {
    activeCardId, rawVariants, variants, variantIndex, currentCard,
    sameArtPrintings, hasMultipleVariants,
  };
}
