/** Per-slot card-swap overrides for the Gallery's reference cards.
 *
 *  The Gallery fills empty template buckets with TEST_CARDS (the server's
 *  curated reference set). Users sometimes want to swap one of those out for a
 *  card they're actively evaluating — e.g. pin a long-text trainer in the
 *  trainer slot so they can tune body-text wrapping against it.
 *
 *  Persistence is per-client (localStorage). The map is keyed by the *original*
 *  reference card's id, so:
 *    - removing the override snaps the slot back to the curated default
 *    - the slot label ("PokemonBasic", "TrainerSupporter") stays stable even
 *      while the card data underneath changes.
 */
import { ref } from "vue";

const STORAGE_KEY = "decklistgen-gallery-slot-overrides";

function loadFromLS(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k === "string" && typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

const overrides = ref<Record<string, string>>(loadFromLS());

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides.value));
  } catch {}
}

function setOverride(originalCardId: string, replacementCardId: string) {
  // Setting an override to the original itself is the same as clearing it.
  if (originalCardId === replacementCardId) {
    clearOverride(originalCardId);
    return;
  }
  overrides.value = { ...overrides.value, [originalCardId]: replacementCardId };
  persist();
}

function clearOverride(originalCardId: string) {
  if (!(originalCardId in overrides.value)) return;
  const copy = { ...overrides.value };
  delete copy[originalCardId];
  overrides.value = copy;
  persist();
}

function getOverride(originalCardId: string): string | null {
  return overrides.value[originalCardId] ?? null;
}

export function useGallerySlotOverrides() {
  return { overrides, setOverride, clearOverride, getOverride };
}
