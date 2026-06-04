import { ref, computed, type Ref } from "vue";
import type { Card } from "../../shared/types/card.js";
import { bulkGenerateClean } from "./usePokeproxy.js";
import { useToast } from "./useToast.js";
import { MAX_GENERATE_BATCH_NON_ADMIN } from "../../shared/constants/generate-limits.js";
import { clampForAdmin } from "../components/browse-generate-gating.js";

/**
 * Browse-view multi-select + bulk generate. Tracks the selected card ids, derives
 * the effective count (selection, else the visible grid, clamped for non-admins),
 * and queues generation. `getVisibleCards` reads the grid's exposed visibleCards.
 */
export function useBrowseGenerate(isAdmin: Ref<boolean>, getVisibleCards: () => Card[]) {
  const browseSelectedIds = ref(new Set<string>());
  const showBrowseGenerate = ref(false);
  const browseGenerating = ref(false);

  function toggleBrowseSelect(cardId: string) {
    const next = new Set(browseSelectedIds.value);
    if (next.has(cardId)) next.delete(cardId);
    else next.add(cardId);
    browseSelectedIds.value = next;
  }

  const browseVisibleCount = computed(() => getVisibleCards().length);

  const browseActualCount = computed(() =>
    browseSelectedIds.value.size > 0 ? browseSelectedIds.value.size : browseVisibleCount.value,
  );

  const browseEffectiveCount = computed(() =>
    clampForAdmin(isAdmin.value, browseActualCount.value),
  );

  function openBrowseGenerate() {
    showBrowseGenerate.value = true;
  }

  async function handleBrowseGenerate({ force }: { force: boolean }) {
    if (browseGenerating.value) return;
    browseGenerating.value = true;
    showBrowseGenerate.value = false;
    const toast = useToast();
    try {
      const sourceIds = browseSelectedIds.value.size > 0
        ? Array.from(browseSelectedIds.value)
        : getVisibleCards().map((c) => c.id);
      const limit = isAdmin.value ? sourceIds.length : MAX_GENERATE_BATCH_NON_ADMIN;
      const ids = sourceIds.slice(0, limit);
      const queued = await bulkGenerateClean(ids, force);
      toast.info(`${queued} card${queued !== 1 ? "s" : ""} queued for generation`);
    } finally {
      browseGenerating.value = false;
    }
  }

  return {
    browseSelectedIds, showBrowseGenerate, browseGenerating,
    toggleBrowseSelect, browseVisibleCount, browseActualCount, browseEffectiveCount,
    openBrowseGenerate, handleBrowseGenerate,
  };
}
