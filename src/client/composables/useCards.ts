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

export function useCards(filters: CardFilters, page: Ref<number>) {
  const debouncedName = useDebouncedRef(() => filters.nameSearch, 300);

  return useQuery({
    queryKey: computed(() => [
      "cards",
      { ...filters, nameSearch: debouncedName.value },
      page.value,
    ]),
    queryFn: () =>
      api.getCards({ ...filters, nameSearch: debouncedName.value }, page.value),
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
