import type { Card } from "../types/card.js";
import type { CardFilters } from "../types/filters.js";

export function applyFilters(cards: Card[], filters: CardFilters): Card[] {
  return cards.filter((card) => {
    if (filters.sets?.length && !filters.sets.includes(card.setCode)) return false;
    if (filters.era && card.era !== filters.era) return false;
    if (filters.category && card.category !== filters.category) return false;
    if (filters.trainerType && card.trainerType !== filters.trainerType) return false;
    if (filters.rarities?.length && !filters.rarities.includes(card.rarity)) return false;
    if (filters.energyTypes?.length && !filters.energyTypes.some((t) => card.energyTypes.includes(t))) return false;
    if (filters.isFullArt !== undefined && card.isFullArt !== filters.isFullArt) return false;
    if (filters.hasFoil !== undefined && card.hasFoil !== filters.hasFoil) return false;

    if (filters.nameSearch) {
      const search = filters.nameSearch.toLowerCase();
      if (!card.name.toLowerCase().includes(search)) return false;
    }

    if (filters.specialAttributes?.length) {
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

    return true;
  });
}
