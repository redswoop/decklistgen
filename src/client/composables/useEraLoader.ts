import { ref } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { useFilters } from "./useFilters.js";
import { api } from "../lib/client.js";

const loadingEra = ref(false);
const loadingSet = ref<string | null>(null);

export function useEraLoader() {
  const queryClient = useQueryClient();
  const { setEra, setSets, filters, getPendingSetLoads } = useFilters();

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["sets"] });
    queryClient.invalidateQueries({ queryKey: ["filterOptions"] });
    queryClient.invalidateQueries({ queryKey: ["cards"] });
  }

  async function loadEra(era: "sv" | "swsh") {
    loadingEra.value = true;
    try {
      await api.loadEra(era);
      invalidateAll();
      setEra(era);
      setSets([]);
    } finally {
      loadingEra.value = false;
    }
  }

  async function loadAllEras() {
    loadingEra.value = true;
    try {
      await Promise.all([api.loadEra("sv"), api.loadEra("swsh")]);
      invalidateAll();
      setEra("all");
      setSets([]);
    } finally {
      loadingEra.value = false;
    }
  }

  async function loadSet(code: string) {
    loadingSet.value = code;
    try {
      await api.loadSet(code);
      invalidateAll();
      const current = filters.sets ?? [];
      if (!current.includes(code)) {
        setSets([...current, code]);
      }
    } finally {
      loadingSet.value = null;
    }
  }

  async function restoreFromUrl() {
    const pending = getPendingSetLoads();
    if (filters.era && !pending.length) {
      loadingEra.value = true;
      try {
        if (filters.era === "all") {
          await Promise.all([api.loadEra("sv"), api.loadEra("swsh")]);
        } else {
          await api.loadEra(filters.era);
        }
        invalidateAll();
      } finally {
        loadingEra.value = false;
      }
    } else if (pending.length) {
      for (const code of pending) {
        try {
          await api.loadSet(code);
        } catch (e) {
          console.warn(`Failed to load set ${code}:`, e);
        }
      }
      invalidateAll();
    }
  }

  return {
    loadingEra,
    loadingSet,
    loadEra,
    loadAllEras,
    loadSet,
    restoreFromUrl,
  };
}
