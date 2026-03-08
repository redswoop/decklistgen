import { ref, watch, onMounted, onUnmounted } from "vue";

export type AppView = "browse" | "decks";

function parseHash(): { view: AppView; deckId: string | null } {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash.startsWith("decks/")) {
    return { view: "decks", deckId: hash.slice(6) || null };
  }
  if (hash === "decks") {
    return { view: "decks", deckId: null };
  }
  return { view: "browse", deckId: null };
}

function toHash(view: AppView, deckId: string | null): string {
  if (view === "decks" && deckId) return `#/decks/${deckId}`;
  if (view === "decks") return "#/decks";
  return "#/browse";
}

export function useRoute() {
  const initial = parseHash();
  const currentView = ref<AppView>(initial.view);
  const selectedDeckId = ref<string | null>(initial.deckId);

  // Sync URL when state changes
  let suppressHashChange = false;

  watch([currentView, selectedDeckId], ([view, deckId]) => {
    const target = toHash(view, deckId);
    if (window.location.hash !== target) {
      suppressHashChange = true;
      window.location.hash = target;
    }
  });

  // React to back/forward navigation
  function onHashChange() {
    if (suppressHashChange) {
      suppressHashChange = false;
      return;
    }
    const parsed = parseHash();
    currentView.value = parsed.view;
    selectedDeckId.value = parsed.deckId;
  }

  onMounted(() => {
    window.addEventListener("hashchange", onHashChange);
    // Set initial hash if empty
    if (!window.location.hash) {
      suppressHashChange = true;
      window.location.hash = toHash(currentView.value, selectedDeckId.value);
    }
  });

  onUnmounted(() => {
    window.removeEventListener("hashchange", onHashChange);
  });

  return { currentView, selectedDeckId };
}
