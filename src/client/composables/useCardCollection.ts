import { type Ref } from "vue";
import { useCards } from "./useCards.js";
import { foldCards, type CardStackGroup, type FoldStrategy } from "../../shared/utils/fold-cards.js";
import type { Card } from "../../shared/types/card.js";
import type { CardFilters } from "../../shared/types/filters.js";

/**
 * Data-layer wrapper over {@link useCards} that adds folding. Components bind to
 * `groupsFrom` to turn a flat card list into display groups without owning any
 * fold logic themselves: when `foldStrategy` is set the cards are folded by it,
 * otherwise every card becomes its own singleton group — so consumers always
 * see one uniform `CardStackGroup[]` shape.
 */
export function useCardCollection(
  filters: CardFilters,
  page: Ref<number>,
  pageSize: number,
  foldStrategy: Ref<FoldStrategy | null>,
) {
  const query = useCards(filters, page, pageSize);

  function groupsFrom(cards: Card[]): CardStackGroup[] {
    const strategy = foldStrategy.value;
    if (!strategy) return cards.map((c) => ({ representative: c, members: [c] }));
    return foldCards(cards, strategy);
  }

  return {
    data: query.data,
    isLoading: query.isLoading,
    groupsFrom,
  };
}
