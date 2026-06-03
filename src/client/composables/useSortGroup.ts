import { ref, computed, watch, type Ref } from "vue";
import { SAME_ART, SAME_CARD, type FoldStrategy } from "../../shared/utils/fold-cards.js";
import type { GroupBy, SortBy, SortDir } from "../../shared/utils/card-sort-group.js";

export type DeckFoldMode = "off" | "same-art" | "by-card";
type GridContext = "browse" | "deck" | "working-deck" | "cards";

const SORT_GROUP_KEY = "decklistgen-sort-group";

interface SortGroupState {
  groupBy: GroupBy;
  sortBy: SortBy;
  sortDir: SortDir;
  stackReprints: boolean;
  deckFoldMode: DeckFoldMode;
}

const sortGroupDefaults: SortGroupState = {
  groupBy: "none", sortBy: "alpha", sortDir: "asc", stackReprints: true, deckFoldMode: "same-art",
};

function loadSortGroup(): SortGroupState {
  try {
    const raw = localStorage.getItem(SORT_GROUP_KEY);
    if (raw) return { ...sortGroupDefaults, ...JSON.parse(raw) };
  } catch {}
  return { ...sortGroupDefaults };
}

export const groupByOptions: { value: GroupBy; label: string }[] = [
  { value: "none", label: "No grouping" },
  { value: "set", label: "Set" },
  { value: "energyType", label: "Energy Type" },
  { value: "rarity", label: "Rarity" },
  { value: "category", label: "Category" },
];

export const sortByOptions: { value: SortBy; label: string }[] = [
  { value: "alpha", label: "Alphabetical" },
  { value: "rarity", label: "Rarity" },
  { value: "type", label: "Type" },
  { value: "set", label: "Set" },
  { value: "count", label: "Count" },
];

export const deckFoldOptions: { value: DeckFoldMode; label: string }[] = [
  { value: "off", label: "No fold" },
  { value: "same-art", label: "Same art" },
  { value: "by-card", label: "By card" },
];

/**
 * Sort / group / fold controls for the card grid, persisted to localStorage.
 * `context` decides the folding strategy: same-art reprints in browse (toggled by
 * stackReprints); an Off/Same-art/By-card mode in the deck grid; never elsewhere.
 */
export function useSortGroup(context: Ref<GridContext>) {
  const saved = loadSortGroup();
  const groupBy = ref<GroupBy>(saved.groupBy);
  const sortBy = ref<SortBy>(saved.sortBy);
  const sortDir = ref<SortDir>(saved.sortDir);
  const stackReprints = ref<boolean>(saved.stackReprints);
  const deckFoldMode = ref<DeckFoldMode>(saved.deckFoldMode);
  const showSortGroupPopup = ref(false);

  watch([groupBy, sortBy, sortDir, stackReprints, deckFoldMode], () => {
    localStorage.setItem(SORT_GROUP_KEY, JSON.stringify({
      groupBy: groupBy.value,
      sortBy: sortBy.value,
      sortDir: sortDir.value,
      stackReprints: stackReprints.value,
      deckFoldMode: deckFoldMode.value,
    }));
  });

  const foldStrategy = computed<FoldStrategy | null>(() => {
    if (context.value === "browse") return stackReprints.value ? SAME_ART : null;
    if (context.value === "deck") {
      return deckFoldMode.value === "same-art" ? SAME_ART
        : deckFoldMode.value === "by-card" ? SAME_CARD
        : null;
    }
    return null;
  });

  const sortGroupLabel = computed(() => {
    const group = groupByOptions.find((o) => o.value === groupBy.value)?.label ?? "";
    const sort = sortByOptions.find((o) => o.value === sortBy.value)?.label ?? "";
    const dir = sortDir.value === "asc" ? "↑" : "↓";
    if (groupBy.value === "none") return `${sort} ${dir}`;
    return `${group} / ${sort} ${dir}`;
  });

  function toggleSortGroupPopup() {
    showSortGroupPopup.value = !showSortGroupPopup.value;
  }
  function closeSortGroupPopup() {
    showSortGroupPopup.value = false;
  }
  function toggleSortDir() {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
  }

  return {
    groupBy, sortBy, sortDir, stackReprints, deckFoldMode, showSortGroupPopup,
    groupByOptions, sortByOptions, deckFoldOptions,
    foldStrategy, sortGroupLabel,
    toggleSortGroupPopup, closeSortGroupPopup, toggleSortDir,
  };
}
