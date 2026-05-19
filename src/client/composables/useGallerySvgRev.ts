/** Per-card SVG cache-bust revisions for the Gallery.
 *
 *  Every gallery thumb (and the inspector preview) keys its SVG fetch on
 *  `(cardId, cacheBust)`. Bumping a single global counter for every change —
 *  even a one-card override — forces the whole grid to flicker through
 *  "Loading SVG…" while the server re-renders cards that didn't change.
 *
 *  This composable splits the cache-bust into two layers:
 *    - `globalRev`    — bumped when something genuinely affects every card
 *                       (font-family change, font-size save).
 *    - `perCardRev[]` — bumped when only one card changed (text-mode
 *                       override, regen, clean).
 *
 *  The effective bust for any card is `max(globalRev, perCardRev[cardId])` so
 *  a global bump still invalidates everything; a per-card bump only that
 *  thumb. State is module-scoped — single shared instance for the whole
 *  Gallery, like `useGallerySvgCache`.
 */
import { ref, reactive } from "vue";

const globalRev = ref(Date.now());
const perCardRev = reactive<Record<string, number>>({});

function revFor(cardId: string): number {
  const card = perCardRev[cardId] ?? 0;
  return card > globalRev.value ? card : globalRev.value;
}

function bumpGlobal(): void {
  globalRev.value = Date.now();
}

function bumpCard(cardId: string): void {
  perCardRev[cardId] = Date.now();
}

export function useGallerySvgRev() {
  return { globalRev, perCardRev, revFor, bumpGlobal, bumpCard };
}
