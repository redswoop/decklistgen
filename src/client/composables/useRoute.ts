import { ref, watch, onMounted, onUnmounted } from "vue";

export type AppView = "browse" | "decks" | "cards" | "public" | "queue";

function parseHash(): { view: AppView; deckId: string | null } {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash === "decks/working") {
    return { view: "decks", deckId: "__working__" };
  }
  if (hash.startsWith("decks/")) {
    return { view: "decks", deckId: hash.slice(6) || null };
  }
  if (hash === "decks") {
    return { view: "decks", deckId: null };
  }
  if (hash === "cards") {
    return { view: "cards", deckId: null };
  }
  if (hash === "public" || hash.startsWith("public/")) {
    return { view: "public", deckId: null };
  }
  if (hash === "queue") {
    return { view: "queue", deckId: null };
  }
  return { view: "browse", deckId: null };
}

function parseCardParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("card") || null;
}

function toHash(view: AppView, deckId: string | null): string {
  if (view === "decks" && deckId === "__working__") return "#/decks/working";
  if (view === "decks" && deckId) return `#/decks/${deckId}`;
  if (view === "decks") return "#/decks";
  if (view === "cards") return "#/cards";
  if (view === "public") return "#/public";
  if (view === "queue") return "#/queue";
  return "#/browse";
}

/** Update the ?card= query param without touching the hash. */
export function setCardParam(id: string | null, replace = false) {
  const url = new URL(window.location.href);
  if (id) {
    url.searchParams.set("card", id);
  } else {
    url.searchParams.delete("card");
  }
  if (replace) {
    history.replaceState(null, "", url.toString());
  } else {
    history.pushState(null, "", url.toString());
  }
}

export function useRoute() {
  const initial = parseHash();
  const currentView = ref<AppView>(initial.view);
  const selectedDeckId = ref<string | null>(initial.deckId);
  const previewCardId = ref<string | null>(parseCardParam());

  // Sync URL when view/deck state changes
  let suppressPopstate = false;

  watch([currentView, selectedDeckId], ([view, deckId]) => {
    const target = toHash(view, deckId);
    if (window.location.hash !== target) {
      suppressPopstate = true;
      window.location.hash = target;
    }
  });

  // React to back/forward navigation (covers both hash and pushState)
  function onPopstate() {
    if (suppressPopstate) {
      suppressPopstate = false;
      return;
    }
    const parsed = parseHash();
    currentView.value = parsed.view;
    selectedDeckId.value = parsed.deckId;
    previewCardId.value = parseCardParam();
  }

  onMounted(() => {
    window.addEventListener("popstate", onPopstate);
    // Set initial hash if empty
    if (!window.location.hash) {
      suppressPopstate = true;
      window.location.hash = toHash(currentView.value, selectedDeckId.value);
    }
  });

  onUnmounted(() => {
    window.removeEventListener("popstate", onPopstate);
  });

  return { currentView, selectedDeckId, previewCardId };
}
