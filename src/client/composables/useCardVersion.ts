import { usePersistentRef } from "./usePersistentRef.js";

/**
 * Which rendering of a card to show/print:
 *   original — the untouched TCGdex scan
 *   cleaned  — the cleaned art PNG, no CSS chrome
 *   proxy    — the CSS-rendered card composited over the cleaned art
 */
export type CardVersion = "original" | "cleaned" | "proxy";

const VERSION_LS_KEY = "decklistgen-card-version";

/**
 * Sticky card-version selection, persisted to localStorage so the lightbox
 * reopens on whatever the user last picked. Per-call instance (one lightbox is
 * open at a time); initializes from storage and writes through on every change.
 */
export function useCardVersion() {
  const selectedVersion = usePersistentRef<CardVersion>(VERSION_LS_KEY, "proxy");

  function selectVersion(v: CardVersion) {
    selectedVersion.value = v;
  }

  return { selectedVersion, selectVersion };
}
