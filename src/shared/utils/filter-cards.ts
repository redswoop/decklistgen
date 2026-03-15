import type { Card } from "../types/card.js";
import type { CardFilters } from "../types/filters.js";

/** Match "CRE 063", "CRE063", "CRE-063", "sv06-036" patterns */
const DECK_CODE_RE = /^([A-Za-z][A-Za-z0-9.]*?)[-\s]+(\d+)$|^([A-Za-z]{2,4})(\d{1,4})$/;

function matchesDeckCode(card: Card, search: string): boolean {
  const m = search.match(DECK_CODE_RE);
  if (!m) return false;
  // Groups 1,2 for separator form; groups 3,4 for no-separator form
  const code = m[1] ?? m[3];
  const num = m[2] ?? m[4];
  const codeUpper = code.toUpperCase();
  // Match against setCode (PTCGL code like "CRE") or setId (TCGdex ID like "swsh6")
  if (card.setCode.toUpperCase() !== codeUpper && card.setId.toLowerCase() !== code.toLowerCase()) return false;
  // Compare card number — strip leading zeros for both
  const cardNum = card.localId.replace(/^0+/, "") || "0";
  const searchNum = num.replace(/^0+/, "") || "0";
  return cardNum === searchNum;
}

export function applyFilters(cards: Card[], filters: CardFilters): Card[] {
  return cards.filter((card) => {
    if (filters.sets?.length && !filters.sets.includes(card.setCode)) return false;
    if (filters.era && filters.era !== "all" && card.era !== filters.era) return false;
    if (filters.category && card.category !== filters.category) return false;
    if (filters.trainerType) {
      if (!filters.category || filters.category === "Trainer") {
        if (card.trainerType !== filters.trainerType) return false;
      }
    }
    if (filters.rarities?.length && !filters.rarities.includes(card.rarity)) return false;
    if (filters.energyTypes?.length) {
      if (!filters.category || filters.category === "Pokemon") {
        if (!filters.energyTypes.some((t) => card.energyTypes.includes(t))) return false;
      }
    }
    if (filters.isFullArt !== undefined && card.isFullArt !== filters.isFullArt) return false;
    if (filters.hasFoil !== undefined && card.hasFoil !== filters.hasFoil) return false;

    if (filters.nameSearch) {
      const search = filters.nameSearch.trim();
      // Try deck code match first (e.g. "CRE 063"), fall back to name substring
      if (!matchesDeckCode(card, search) && !card.name.toLowerCase().includes(search.toLowerCase())) return false;
    }

    if (filters.specialAttributes?.length) {
      if (!filters.category || filters.category === "Pokemon") {
        const attrMap: Record<string, boolean> = {
          ex: card.isEx,
          V: card.isV,
          VMAX: card.isVmax,
          VSTAR: card.isVstar,
          Ancient: card.isAncient,
          Future: card.isFuture,
          Tera: card.isTera,
        };
        if (!filters.specialAttributes.some((attr) => attrMap[attr])) return false;
      }
    }

    return true;
  });
}
