import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { api } from "../lib/client.js";

export function useCardDetail(cardId: Ref<string | undefined>, enabled: Ref<boolean>) {
  return useQuery({
    queryKey: computed(() => ["card-detail", cardId.value]),
    queryFn: () => api.getCardDetail(cardId.value!),
    enabled: computed(() => enabled.value && !!cardId.value),
    staleTime: 5 * 60_000,
  });
}
