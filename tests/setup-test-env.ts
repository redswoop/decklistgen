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
 */
export {};
