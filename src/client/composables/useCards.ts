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
  });
}

/**
 * Counts cards in the selected "universe" — the set/era + category selection,
 * before the finer refinement filters narrow it down. Used by the grid header
 * to show "showing X of Y". Keyed only on the universe-defining fields so it
 * refetches when those change but stays cached while you tweak rarity/type/etc.
 * Only runs once a set or era is chosen (otherwise there's no universe to count).
 */
export function useUniverseCount(filters: CardFilters) {
  return useQuery({
    queryKey: computed(() => [
      "universe-count",
      filters.sets,
      filters.era,
      filters.category,
    ]),
    queryFn: () =>
      api
        .getCards(
          { sets: filters.sets, era: filters.era, category: filters.category },
          1,
          1,
        )
        .then((r) => r.total),
    enabled: computed(() => !!(filters.sets?.length || filters.era)),
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
