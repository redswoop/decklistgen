import { computed } from "vue";
import { useQuery, useQueryClient, useMutation } from "@tanstack/vue-query";
import { api } from "../lib/client.js";
import type { SavedDeck, DeckCard } from "../../shared/types/deck.js";
import type { BeautifyOptions } from "../../shared/types/beautify.js";

const DECKS_KEY = ["decks"] as const;

export function useDecks() {
  const queryClient = useQueryClient();

  const { data: decks, isLoading } = useQuery({
    queryKey: DECKS_KEY,
    queryFn: () => api.listDecks(),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: DECKS_KEY });
  }

  const createMutation = useMutation({
    mutationFn: (data: { name: string; cards: DeckCard[]; importedAt?: string; importSource?: string }) =>
      api.createDeck(data),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SavedDeck> }) =>
      api.updateDeck(id, data),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDeck(id),
    onSuccess: invalidate,
  });

  const copyMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name?: string }) =>
      api.copyDeck(id, name),
    onSuccess: invalidate,
  });

  const beautifyMutation = useMutation({
    mutationFn: ({ id, options }: { id: string; options: BeautifyOptions }) =>
      api.beautifyDeck(id, options),
    onSuccess: invalidate,
  });

  async function fetchDeck(id: string): Promise<SavedDeck> {
    return api.getDeck(id);
  }

  return {
    decks: computed(() => decks.value ?? []),
    isLoading,
    createDeck: createMutation.mutateAsync,
    updateDeck: updateMutation.mutateAsync,
    deleteDeck: deleteMutation.mutateAsync,
    copyDeck: copyMutation.mutateAsync,
    beautifyDeck: beautifyMutation.mutateAsync,
    fetchDeck,
    invalidate,
  };
}
