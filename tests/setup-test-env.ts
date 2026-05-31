/**
 * Test preload — redirects file-backed stores to per-process temp files so the
 * user's real overrides in data/*.json are never touched by tests.
 *
 * Wired via bunfig.toml's [test] preload.
 *
 * No stores require redirection right now (the SVG renderer's override stores
 * were retired). When you add a new file-backed store, register its
 * STORE_PATH env var here — otherwise `bun test` may unlink the user's real
 * data/*.json on every run.
 *
 * Also provides a minimal in-memory `localStorage` so client composables that
 * persist to it (e.g. useDecklist's `watch(items)` writer) don't throw under
 * Bun, which has no DOM `localStorage`.
 */
if (typeof (globalThis as { localStorage?: unknown }).localStorage === "undefined") {
  const store = new Map<string, string>();
  (globalThis as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

export {};
