import { ref, computed, watch, type Ref } from "vue";
import { generateCleanImage, getGenerationVersion } from "./usePokeproxy.js";
import { useToast } from "./useToast.js";
import type { GalleryCardWithSource } from "./useGalleryCardSource.js";

/**
 * Toolbar bulk generation: queue ComfyUI for every card missing artwork, or
 * force-regenerate the whole set. Also watches the global generation-version map
 * and refreshes tiles when any gallery card finishes. Network bound — exercised
 * manually, not unit-tested.
 */
export function useGalleryBulkGeneration(
  cards: Ref<GalleryCardWithSource[] | undefined>,
  refetch: () => Promise<void>,
  imageCacheBust: Ref<number>,
) {
  const toast = useToast();
  const bulkBusy = ref(false);

  const missingCount = computed(
    () => (cards.value ?? []).filter((c) => !c.hasClean && !c.hasComposite).length,
  );

  async function generateMissing() {
    if (bulkBusy.value || !cards.value) return;
    bulkBusy.value = true;
    try {
      const targets = cards.value.filter((c) => !c.hasClean && !c.hasComposite);
      if (targets.length === 0) {
        toast.info("Nothing to do — every card already has artwork");
        return;
      }
      let queued = 0;
      for (const c of targets) {
        try {
          await generateCleanImage(c.cardId, false);
          queued++;
        } catch { /* per-card errors surfaced via toast inside generateCleanImage */ }
      }
      toast.info(`${queued} card${queued !== 1 ? "s" : ""} queued for generation`);
    } finally {
      bulkBusy.value = false;
    }
  }

  async function forceRegenerateAll() {
    if (bulkBusy.value || !cards.value) return;
    bulkBusy.value = true;
    try {
      let queued = 0;
      for (const c of cards.value) {
        try {
          await generateCleanImage(c.cardId, true);
          queued++;
        } catch { /* ignored — toast already shown */ }
      }
      toast.info(`${queued} card${queued !== 1 ? "s" : ""} queued for force-regeneration`);
    } finally {
      bulkBusy.value = false;
    }
  }

  // Sum the per-card generation counters; when the total ticks up, a ComfyUI job
  // just finished for one of our cards — refresh tiles broadly (we can't pinpoint
  // which card from the sum alone).
  const galleryGenerationTick = computed(() => {
    if (!cards.value) return 0;
    let sum = 0;
    for (const c of cards.value) sum += getGenerationVersion(c.cardId);
    return sum;
  });

  watch(galleryGenerationTick, (next, prev) => {
    if (next > prev) {
      imageCacheBust.value = Date.now();
      refetch();
    }
  });

  return { bulkBusy, missingCount, generateMissing, forceRegenerateAll };
}
