import { ref, computed, watch, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { api } from "../lib/client.js";

export type ImageMode = "original" | "clean" | "composite";

// Global toggle state shared across components
const imageMode: Ref<ImageMode> = ref("original");

// Cache of which cards have pokeproxy assets
const statusCache = new Map<string, { hasClean: boolean; hasComposite: boolean; hasSvg: boolean }>();

export function usePokeproxy() {
  function setImageMode(mode: ImageMode) {
    imageMode.value = mode;
  }

  return { imageMode, setImageMode };
}

/** Batch-fetch pokeproxy status for a list of cards, populating the cache */
export function usePokeproxyBatch(cardIds: Ref<string[]>) {
  const query = useQuery({
    queryKey: computed(() => ["pokeproxy-batch", cardIds.value]),
    queryFn: async () => {
      // Only fetch IDs we haven't cached yet
      const uncached = cardIds.value.filter((id) => !statusCache.has(id));
      if (uncached.length > 0) {
        const results = await api.pokeproxyBatchStatus(uncached);
        for (const [id, status] of Object.entries(results)) {
          statusCache.set(id, status);
        }
      }
      // Return full status map for current cards
      const out: Record<string, { hasClean: boolean; hasComposite: boolean; hasSvg: boolean }> = {};
      for (const id of cardIds.value) {
        out[id] = statusCache.get(id) ?? { hasClean: false, hasComposite: false, hasSvg: false };
      }
      return out;
    },
    enabled: computed(() => cardIds.value.length > 0 && imageMode.value !== "original"),
    staleTime: 300_000,
  });

  return query;
}

export function usePokeproxyStatus(cardId: Ref<string | undefined>) {
  return useQuery({
    queryKey: computed(() => ["pokeproxy-status", cardId.value]),
    queryFn: () => api.pokeproxyStatus(cardId.value!),
    enabled: computed(() => !!cardId.value),
  });
}

export function useVariants(cardId: Ref<string | undefined>) {
  return useQuery({
    queryKey: computed(() => ["variants", cardId.value]),
    queryFn: () => api.getVariants(cardId.value!).then((r) => r.variants),
    enabled: computed(() => !!cardId.value),
  });
}

export function getCardImageUrl(card: { id: string; imageUrl: string }, mode: ImageMode): string {
  if (mode === "original") return card.imageUrl;

  const status = statusCache.get(card.id);
  if (!status) return card.imageUrl; // Not checked yet, use original

  if (mode === "composite" && status.hasComposite) {
    return api.pokeproxyImageUrl(card.id, "composite");
  }
  if (mode === "clean" && status.hasClean) {
    return api.pokeproxyImageUrl(card.id, "clean");
  }

  return card.imageUrl; // Fallback to original if not available
}
