import { ref, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { api } from "../api/client.js";

export type ImageMode = "original" | "clean" | "composite";

// Global toggle state shared across components
const imageMode: Ref<ImageMode> = ref("original");

export function usePokeproxy() {
  function setImageMode(mode: ImageMode) {
    imageMode.value = mode;
  }

  return { imageMode, setImageMode };
}

export function usePokeproxyStatus(cardId: Ref<string | undefined>) {
  return useQuery({
    queryKey: ["pokeproxy-status", cardId],
    queryFn: () => api.pokeproxyStatus(cardId.value!),
    enabled: () => !!cardId.value,
  });
}

export function useVariants(cardId: Ref<string | undefined>) {
  return useQuery({
    queryKey: ["variants", cardId],
    queryFn: () => api.getVariants(cardId.value!).then((r) => r.variants),
    enabled: () => !!cardId.value,
  });
}

export function getCardImageUrl(card: { id: string; imageUrl: string }, mode: ImageMode): string {
  if (mode === "original") return card.imageUrl;
  return api.pokeproxyImageUrl(card.id, mode === "clean" ? "clean" : "composite");
}
