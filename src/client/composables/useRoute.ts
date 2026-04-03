import { ref, watch, onMounted, onUnmounted } from "vue";

export type AppView = "browse" | "build" | "cards" | "public" | "queue" | "editor" | "gallery" | "variants";

function parseHash(): { view: AppView } {
  const hash = window.location.hash.replace(/^#\/?/, "");
  // Backward compat: #/decks* → build
  if (hash === "decks" || hash.startsWith("decks/")) {
    return { view: "build" };
  }
  if (hash === "build") {
    return { view: "build" };
  }
  if (hash === "browse") {
    return { view: "browse" };
  }
  if (hash === "cards") {
    return { view: "cards" };
  }
  if (hash === "public" || hash.startsWith("public/")) {
    return { view: "public" };
  }
  if (hash === "queue") {
    return { view: "queue" };
  }
  if (hash === "editor" || hash.startsWith("editor/")) {
    return { view: "editor" };
  }
  if (hash === "gallery" || hash.startsWith("gallery/")) {
    return { view: "gallery" };
  }
  if (hash === "variants") {
    return { view: "variants" };
  }
  // Default: browse (accessible without auth)
  return { view: "browse" };
}

function parseCardParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("card") || null;
}

function toHash(view: AppView): string {
  if (view === "build") return "#/build";
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
  const previewCardId = ref<string | null>(parseCardParam());

  // Sync URL when view state changes
  let suppressHashSync = false;

  watch(currentView, (view) => {
    const target = toHash(view);
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
    previewCardId.value = parseCardParam();
  }

  onMounted(() => {
    window.addEventListener("popstate", onHashChange);
    window.addEventListener("hashchange", onHashChange);
    // Set initial hash if empty
    if (!window.location.hash) {
      suppressHashSync = true;
      window.location.hash = toHash(currentView.value);
    }
  });

  onUnmounted(() => {
    window.removeEventListener("popstate", onHashChange);
    window.removeEventListener("hashchange", onHashChange);
  });

  return { currentView, previewCardId };
}
