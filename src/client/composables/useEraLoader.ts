import { ref } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { api } from "../lib/client.js";

const loadingEra = ref(false);

export function useEraLoader() {
  const queryClient = useQueryClient();

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["sets"] });
    queryClient.invalidateQueries({ queryKey: ["filterOptions"] });
    queryClient.invalidateQueries({ queryKey: ["cards"] });
  }

  /** Eager-load every era on app boot. Idempotent on the server side, so this
   *  is safe to call once per page load — a warm server returns immediately. */
  async function loadAllEras() {
    if (loadingEra.value) return;
    loadingEra.value = true;
    try {
      await Promise.all([api.loadEra("sv"), api.loadEra("swsh"), api.loadEra("me")]);
      invalidateAll();
    } finally {
      loadingEra.value = false;
    }
  }

  return {
    loadingEra,
    loadAllEras,
  };
}
