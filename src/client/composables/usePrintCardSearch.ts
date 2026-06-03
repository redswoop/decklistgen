import { ref, watch, onUnmounted, getCurrentInstance, type Ref } from "vue";
import { api } from "../lib/client.js";
import type { Card } from "../../shared/types/card.js";

/**
 * Debounced "search any card by name" used by the jumbo pair-picker. Queries the
 * full card API (not just the deck), drops the excluded card (so you can't pair a
 * card with itself), and requires ≥2 chars before searching. Network + timer
 * bound — covered by the jumbo-print e2e, not unit-tested.
 */
export function usePrintCardSearch(excludeId: Ref<string>) {
  const query = ref("");
  const results = ref<Card[]>([]);
  const searching = ref(false);
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  watch(query, (q) => {
    clearTimeout(searchTimer);
    const term = q.trim();
    if (term.length < 2) {
      results.value = [];
      searching.value = false;
      return;
    }
    searching.value = true;
    searchTimer = setTimeout(async () => {
      try {
        const { cards } = await api.getCards({ nameSearch: term }, 1, 24);
        results.value = cards.filter((c) => c.id !== excludeId.value);
      } catch {
        results.value = [];
      } finally {
        searching.value = false;
      }
    }, 250);
  });

  if (getCurrentInstance()) {
    onUnmounted(() => clearTimeout(searchTimer));
  }

  return { query, results, searching };
}
