import { ref, reactive, computed, type Ref } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { api } from "../lib/client.js";
import { generateCleanImage } from "./usePokeproxy.js";
import type { CustomizedCard } from "../../shared/types/customized-card.js";

// Module-level shared state — survives component remounts
const filters = reactive({
  nameSearch: "",
  staleness: undefined as "stale" | "fresh" | undefined,
  category: undefined as "Pokemon" | "Trainer" | "Energy" | undefined,
});

const selectedIds = ref(new Set<string>());

export function useCustomizedCards() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["customized-cards"],
    queryFn: () => api.getCustomizedCards(),
    staleTime: 30_000,
  });

  const cards = computed(() => data.value?.cards ?? []);
  const totalClean = computed(() => data.value?.totalClean ?? 0);
  const totalSettings = computed(() => data.value?.totalSettings ?? 0);
  const totalStale = computed(() => data.value?.totalStale ?? 0);

  function toggleSelect(cardId: string) {
    const next = new Set(selectedIds.value);
    if (next.has(cardId)) next.delete(cardId);
    else next.add(cardId);
    selectedIds.value = next;
  }

  function selectAll() {
    selectedIds.value = new Set(filteredCards.value.map((c) => c.card.id));
  }

  function clearSelection() {
    selectedIds.value = new Set();
  }

  const filteredCards = computed(() => {
    let result = cards.value;

    if (filters.nameSearch) {
      const q = filters.nameSearch.toLowerCase();
      result = result.filter((c) => c.card.name.toLowerCase().includes(q));
    }

    if (filters.staleness === "stale") {
      result = result.filter((c) => c.isStale);
    } else if (filters.staleness === "fresh") {
      result = result.filter((c) => !c.isStale);
    }

    if (filters.category) {
      result = result.filter((c) => c.card.category === filters.category);
    }

    return result;
  });

  function resetFilters() {
    filters.nameSearch = "";
    filters.staleness = undefined;
    filters.category = undefined;
  }

  // Batch operations
  async function batchDelete(cardIds: string[]) {
    await api.batchDeleteCustomizations(cardIds);
    const next = new Set(selectedIds.value);
    for (const id of cardIds) next.delete(id);
    selectedIds.value = next;
    queryClient.invalidateQueries({ queryKey: ["customized-cards"] });
  }

  async function batchRegenerate(cardIds: string[]) {
    for (const cardId of cardIds) {
      await generateCleanImage(cardId, true);
    }
    queryClient.invalidateQueries({ queryKey: ["customized-cards"] });
  }

  return {
    cards,
    isLoading,
    totalClean,
    totalSettings,
    totalStale,
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    filters,
    filteredCards,
    resetFilters,
    batchDelete,
    batchRegenerate,
    refetch,
  };
}
