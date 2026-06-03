import { ref, watch, onUnmounted, getCurrentInstance } from "vue";
import { api } from "../lib/client.js";
import type { Card } from "../../shared/types/card.js";

/**
 * Debounced "search cards to add" used by the deck-context card grid. Queries
 * the full card API (not the current deck), showing a dropdown of matches.
 * Network + timer bound — covered by the deck-build e2e, not unit-tested.
 */
export function useCardSearch() {
  const query = ref("");
  const results = ref<Card[]>([]);
  const loading = ref(false);
  const showDropdown = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  watch(query, (q) => {
    if (timer) clearTimeout(timer);
    if (!q || q.length < 2) {
      results.value = [];
      showDropdown.value = false;
      return;
    }
    loading.value = true;
    timer = setTimeout(async () => {
      try {
        const { cards } = await api.getCards({ nameSearch: q }, 1, 20);
        results.value = cards;
        showDropdown.value = cards.length > 0;
      } catch {
        results.value = [];
      } finally {
        loading.value = false;
      }
    }, 250);
  });

  function clear() {
    query.value = "";
    results.value = [];
    showDropdown.value = false;
  }

  /** Hide the dropdown after a tick so a result mousedown still registers. */
  function handleBlur() {
    setTimeout(() => { showDropdown.value = false; }, 200);
  }

  if (getCurrentInstance()) {
    onUnmounted(() => { if (timer) clearTimeout(timer); });
  }

  return { query, results, loading, showDropdown, clear, handleBlur };
}
