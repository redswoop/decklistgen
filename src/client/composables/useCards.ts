import { ref, watch, computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { api } from "../lib/client.js";
import type { CardFilters } from "../../shared/types/filters.js";

function useDebouncedRef(source: () => string | undefined, delay: number) {
  const debounced = ref(source());
  let timer: ReturnType<typeof setTimeout>;
  watch(source, (newVal) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      debounced.value = newVal;
    }, delay);
  });
  return debounced;
}

export function useCards(filters: CardFilters, page: Ref<number>, pageSize = 60) {
  const debouncedName = useDebouncedRef(() => filters.nameSearch, 300);

  return useQuery({
    queryKey: computed(() => [
      "cards",
      { ...filters, nameSearch: debouncedName.value },
      page.value,
      pageSize,
    ]),
    queryFn: () =>
      api.getCards({ ...filters, nameSearch: debouncedName.value }, page.value, pageSize),
    enabled: computed(() => {
      // Query if era/sets are selected, or if any other filter is active
      // (server may already have cards loaded from this session)
      if (filters.sets?.length || filters.era) return true;
      return !!(filters.category || filters.rarities?.length || filters.energyTypes?.length
        || filters.specialAttributes?.length || filters.nameSearch || filters.trainerType
        || filters.isFullArt || filters.hasFoil);
    }),
  });
}

export function useSets() {
  return useQuery({
    queryKey: ["sets"] as const,
    queryFn: () => api.getSets(),
  });
}

export function useFilterOptions() {
  return useQuery({
    queryKey: ["filterOptions"] as const,
    queryFn: () => api.getFilterOptions(),
  });
}
