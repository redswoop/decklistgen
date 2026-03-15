import { ref, watch, onMounted, onUnmounted } from "vue";

export type AppView = "browse" | "decks" | "cards" | "public" | "queue" | "editor" | "gallery" | "variants";

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
  if (hash === "editor" || hash.startsWith("editor/")) {
    return { view: "editor", deckId: null };
  }
  if (hash === "gallery" || hash.startsWith("gallery/")) {
    return { view: "gallery", deckId: null };
  }
  if (hash === "variants") {
    return { view: "variants", deckId: null };
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
  if (view === "editor") return "#/editor";
  if (view === "gallery") return "#/gallery";
  if (view === "variants") return "#/variants";
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
  let suppressHashSync = false;

  watch([currentView, selectedDeckId], ([view, deckId]) => {
    const target = toHash(view, deckId);
    const current = window.location.hash;
    // Don't clobber sub-paths (e.g. #/editor/cardId → #/editor)
    if (current !== target && !current.startsWith(target + "/")) {
      suppressHashSync = true;
      window.location.hash = target;
    }
  });

  // React to back/forward navigation and programmatic hash changes
  function onHashChange() {
    if (suppressHashSync) {
      suppressHashSync = false;
      return;
    }
    const parsed = parseHash();
    currentView.value = parsed.view;
    selectedDeckId.value = parsed.deckId;
    previewCardId.value = parseCardParam();
  }

  onMounted(() => {
    window.addEventListener("popstate", onHashChange);
    window.addEventListener("hashchange", onHashChange);
    // Set initial hash if empty
    if (!window.location.hash) {
      suppressHashSync = true;
      window.location.hash = toHash(currentView.value, selectedDeckId.value);
    }
  });

  onUnmounted(() => {
    window.removeEventListener("popstate", onHashChange);
    window.removeEventListener("hashchange", onHashChange);
  });

  return { currentView, selectedDeckId, previewCardId };
}
