<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { useFilters } from "../composables/useFilters.js";
import { useUniverseCount } from "../composables/useCards.js";
import { useCardCollection } from "../composables/useCardCollection.js";
import { SAME_ART, type CardStackGroup } from "../../shared/utils/fold-cards.js";
import { formatCardCountLabel } from "../../shared/utils/card-count-label.js";
import { useDecklist } from "../composables/useDecklist.js";
import { usePokeproxy, usePokeproxyBatch, type ImageMode } from "../composables/usePokeproxy.js";
import { useEraLoader } from "../composables/useEraLoader.js";
import CardStack from "./CardStack.vue";
import { api } from "../lib/client.js";
import type { Card } from "../../shared/types/card.js";
import { getRarityRank } from "../../shared/utils/rarity-rank.js";

const props = withDefaults(defineProps<{
  /** External card array — skips API query when provided */
  cards?: Card[];
  /** Count map (cardId → count) to show on tiles instead of deck counts */
  cardCounts?: Record<string, number>;
  /** Tile context — controls which overlays/actions appear */
  context?: "browse" | "deck" | "working-deck" | "cards";
  /** Header label override (replaces "X cards") */
  headerLabel?: string;
  /** Enable selection checkboxes on tiles */
  selectable?: boolean;
  /** Set of selected card IDs */
  selectedIds?: Set<string>;
  /** Set of stale card IDs (shows amber badge) */
  staleIds?: Set<string>;
  /** Click behavior */
  clickMode?: "preview";
}>(), {
  cards: undefined,
  cardCounts: undefined,
  context: "browse",
  headerLabel: undefined,
  selectable: false,
  selectedIds: undefined,
  staleIds: undefined,
  clickMode: "preview",
});

const emit = defineEmits<{
  "preview-card": [card: Card, cards: Card[]];
  "toggle-select": [cardId: string];
  "add-card": [card: Card];
  "remove-card": [card: Card];
  "regenerate-card": [card: Card];
}>();

const { filters, setNameSearch } = useFilters();
const { addCard, getDeckCount } = useDecklist();
const { imageMode, setImageMode } = usePokeproxy();
const { loadingEra } = useEraLoader();

// Only query API when no external cards provided
const localPage = ref(1);
const { data: universeTotal } = useUniverseCount(filters);

// Sort & Group — persisted to localStorage
type GroupBy = "none" | "set" | "energyType" | "rarity" | "category";
type SortBy = "alpha" | "rarity" | "type" | "set" | "count";
type SortDir = "asc" | "desc";

const SORT_GROUP_KEY = "decklistgen-sort-group";

interface SortGroupState {
  groupBy: GroupBy;
  sortBy: SortBy;
  sortDir: SortDir;
  stackReprints: boolean;
}

const sortGroupDefaults: SortGroupState = { groupBy: "none", sortBy: "alpha", sortDir: "asc", stackReprints: true };

function loadSortGroup(): SortGroupState {
  try {
    const raw = localStorage.getItem(SORT_GROUP_KEY);
    if (raw) return { ...sortGroupDefaults, ...JSON.parse(raw) };
  } catch {}
  return { ...sortGroupDefaults };
}

function saveSortGroup() {
  localStorage.setItem(SORT_GROUP_KEY, JSON.stringify({
    groupBy: groupBy.value,
    sortBy: sortBy.value,
    sortDir: sortDir.value,
    stackReprints: stackReprints.value,
  }));
}

const saved = loadSortGroup();
const groupBy = ref<GroupBy>(saved.groupBy);
const sortBy = ref<SortBy>(saved.sortBy);
const sortDir = ref<SortDir>(saved.sortDir);
const stackReprints = ref<boolean>(saved.stackReprints);
const showSortGroupPopup = ref(false);

watch([groupBy, sortBy, sortDir, stackReprints], saveSortGroup);

// Fold same-art reprints into stacks only in the browse grid. Other contexts
// (deck/working-deck/cards via external `cards`) keep one tile per printing.
const foldStrategy = computed(() =>
  stackReprints.value && props.context === "browse" ? SAME_ART : null,
);
const { data, isLoading, groupsFrom } = useCardCollection(filters, localPage, 99999, foldStrategy);

const groupByOptions: { value: GroupBy; label: string }[] = [
  { value: "none", label: "No grouping" },
  { value: "set", label: "Set" },
  { value: "energyType", label: "Energy Type" },
  { value: "rarity", label: "Rarity" },
  { value: "category", label: "Category" },
];

const sortByOptions: { value: SortBy; label: string }[] = [
  { value: "alpha", label: "Alphabetical" },
  { value: "rarity", label: "Rarity" },
  { value: "type", label: "Type" },
  { value: "set", label: "Set" },
  { value: "count", label: "Count" },
];

function toggleSortGroupPopup() {
  showSortGroupPopup.value = !showSortGroupPopup.value;
}

function closeSortGroupPopup() {
  showSortGroupPopup.value = false;
}

function toggleSortDir() {
  sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
}

const sortGroupLabel = computed(() => {
  const group = groupByOptions.find((o) => o.value === groupBy.value)?.label ?? "";
  const sort = sortByOptions.find((o) => o.value === sortBy.value)?.label ?? "";
  const dir = sortDir.value === "asc" ? "\u2191" : "\u2193";
  if (groupBy.value === "none") return `${sort} ${dir}`;
  return `${group} / ${sort} ${dir}`;
});

// Container sizing
const scrollRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);
let resizeObserver: ResizeObserver | null = null;

// Watch scrollRef so we re-measure when the element appears (e.g. switching
// from skeleton/welcome to the main grid via v-if branches).
watch(scrollRef, (el) => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (el) {
    containerWidth.value = el.clientWidth;
    resizeObserver = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) containerWidth.value = w;
    });
    resizeObserver.observe(el);
  }
});
onUnmounted(() => resizeObserver?.disconnect());

const CARD_MIN_WIDTH = 140;
const GAP = 12;
const PADDING = 16;

const cardsPerRow = computed(() => {
  const w = containerWidth.value - PADDING * 2;
  return Math.max(1, Math.floor((w + GAP) / (CARD_MIN_WIDTH + GAP)));
});

const cardWidth = computed(() => {
  const w = containerWidth.value - PADDING * 2;
  const n = cardsPerRow.value;
  return (w - (n - 1) * GAP) / n;
});

const cardRowHeight = computed(() => Math.max(1, Math.ceil(cardWidth.value * 7 / 5) + GAP));

// External or queried cards
const isExternalMode = computed(() => !!props.cards);
const allCardsRaw = computed(() => props.cards ?? data.value?.cards ?? []);

// Local search filter (for external mode)
const localSearch = ref("");
const allCards = computed(() => {
  const cards = allCardsRaw.value;
  if (!isExternalMode.value || !localSearch.value) return cards;
  const q = localSearch.value.toLowerCase();
  return cards.filter((c) => c.name.toLowerCase().includes(q));
});

const hasAnyFilter = computed(() => {
  if (isExternalMode.value) return true; // always show grid in external mode
  return !!(filters.sets?.length || filters.era || filters.category || filters.rarities?.length
    || filters.energyTypes?.length || filters.specialAttributes?.length
    || filters.nameSearch || filters.trainerType || filters.isFullArt || filters.hasFoil);
});

// Sorting
const CATEGORY_ORDER: Record<string, number> = { Pokemon: 0, Trainer: 1, Energy: 2 };

function sortCards(cards: Card[], by: SortBy, dir: SortDir, counts?: Record<string, number>): Card[] {
  const sorted = [...cards].sort((a, b) => {
    switch (by) {
      case "alpha": return a.name.localeCompare(b.name);
      case "rarity": return getRarityRank(b.rarity) - getRarityRank(a.rarity);
      case "type": {
        const ca = CATEGORY_ORDER[a.category] ?? 9;
        const cb = CATEGORY_ORDER[b.category] ?? 9;
        if (ca !== cb) return ca - cb;
        return a.name.localeCompare(b.name);
      }
      case "set": {
        if (a.setCode !== b.setCode) return a.setCode.localeCompare(b.setCode);
        return (parseInt(a.localId) || 0) - (parseInt(b.localId) || 0);
      }
      case "count": {
        const ca = counts?.[a.id] ?? 0;
        const cb = counts?.[b.id] ?? 0;
        if (cb !== ca) return cb - ca;
        return a.name.localeCompare(b.name);
      }
      default: return 0;
    }
  });
  return dir === "desc" ? sorted.reverse() : sorted;
}

// Grouping
type VirtualRow =
  | { type: "header"; label: string; count: number }
  | { type: "cards"; cards: Card[] };

function groupCards(cards: Card[], by: GroupBy): [string, Card[]][] {
  const map = new Map<string, Card[]>();
  for (const card of cards) {
    let key: string;
    switch (by) {
      case "set": key = `${card.setName} (${card.setCode})`; break;
      case "energyType": key = card.energyTypes[0] ?? "Colorless"; break;
      case "rarity": key = card.rarity; break;
      case "category": key = card.trainerType ?? card.category; break;
      default: key = "";
    }
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(card);
  }
  const entries = Array.from(map.entries());
  if (by !== "set") entries.sort((a, b) => a[0].localeCompare(b[0]));
  return entries;
}

function chunkCards(cards: Card[], perRow: number): VirtualRow[] {
  const rows: VirtualRow[] = [];
  for (let i = 0; i < cards.length; i += perRow) {
    rows.push({ type: "cards", cards: cards.slice(i, i + perRow) });
  }
  return rows;
}

// Fold the (locally-filtered) cards into display groups, then drive sorting /
// grouping / virtualization off the representatives. When folding is off every
// group is a singleton, so the rest of the pipeline is unchanged.
const displayGroups = computed(() => groupsFrom(allCards.value));
const groupByRepId = computed(() => {
  const m = new Map<string, CardStackGroup>();
  for (const g of displayGroups.value) m.set(g.representative.id, g);
  return m;
});
const displayCards = computed(() => displayGroups.value.map((g) => g.representative));

function groupFor(card: Card): CardStackGroup {
  return groupByRepId.value.get(card.id) ?? { representative: card, members: [card] };
}

const virtualRows = computed(() => {
  const cards = sortCards(displayCards.value, sortBy.value, sortDir.value, props.cardCounts);
  const perRow = cardsPerRow.value;

  if (groupBy.value === "none") {
    return chunkCards(cards, perRow);
  }

  const groups = groupCards(cards, groupBy.value);
  const rows: VirtualRow[] = [];
  for (const [label, gc] of groups) {
    rows.push({ type: "header", label, count: gc.length });
    rows.push(...chunkCards(gc, perRow));
  }
  return rows;
});

// Cards in display order (respects grouping) for lightbox navigation
const orderedCards = computed(() => {
  const result: Card[] = [];
  for (const row of virtualRows.value) {
    if (row.type === "cards") result.push(...row.cards);
  }
  return result;
});

const HEADER_HEIGHT = 44;

const virtualizer = useVirtualizer(computed(() => ({
  count: virtualRows.value.length,
  getScrollElement: () => scrollRef.value,
  estimateSize: (i: number) =>
    virtualRows.value[i]?.type === "header" ? HEADER_HEIGHT : cardRowHeight.value,
  overscan: 3,
})));

// Pokeproxy batch for visible cards only
const visibleCardIds = computed(() => {
  if (imageMode.value === "original") return [];
  const items = virtualizer.value.getVirtualItems();
  const ids: string[] = [];
  for (const item of items) {
    const row = virtualRows.value[item.index];
    if (row?.type === "cards") {
      for (const card of row.cards) {
        ids.push(card.id);
      }
    }
  }
  return ids;
});
usePokeproxyBatch(visibleCardIds);

const modeOptions: { value: ImageMode; label: string }[] = [
  { value: "original", label: "Original" },
  { value: "proxy", label: "Proxy" },
];

// Deck context API search
const isDeckContext = computed(() => props.context === "deck");
const apiSearchQuery = ref("");
const apiSearchResults = ref<Card[]>([]);
const apiSearchLoading = ref(false);
const showApiDropdown = ref(false);
let apiSearchTimer: ReturnType<typeof setTimeout> | null = null;

watch(apiSearchQuery, (q) => {
  if (apiSearchTimer) clearTimeout(apiSearchTimer);
  if (!q || q.length < 2) {
    apiSearchResults.value = [];
    showApiDropdown.value = false;
    return;
  }
  apiSearchLoading.value = true;
  apiSearchTimer = setTimeout(async () => {
    try {
      const { cards } = await api.getCards({ nameSearch: q }, 1, 20);
      apiSearchResults.value = cards;
      showApiDropdown.value = cards.length > 0;
    } catch {
      apiSearchResults.value = [];
    } finally {
      apiSearchLoading.value = false;
    }
  }, 250);
});

function selectApiResult(card: Card) {
  apiSearchQuery.value = "";
  apiSearchResults.value = [];
  showApiDropdown.value = false;
  handleAdd(card);
}

function handleApiSearchBlur() {
  setTimeout(() => { showApiDropdown.value = false; }, 200);
}

// Search input handler
function handleSearchInput(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  if (isDeckContext.value) {
    apiSearchQuery.value = val;
  } else if (isExternalMode.value) {
    localSearch.value = val;
  } else {
    setNameSearch(val);
  }
}

function clearSearch() {
  if (isDeckContext.value) {
    apiSearchQuery.value = "";
    apiSearchResults.value = [];
    showApiDropdown.value = false;
  } else if (isExternalMode.value) {
    localSearch.value = "";
  } else {
    setNameSearch("");
  }
}

const searchValue = computed(() => {
  if (isDeckContext.value) return apiSearchQuery.value;
  return isExternalMode.value ? localSearch.value : (filters.nameSearch ?? "");
});

const displayLabel = computed(() => {
  if (props.headerLabel) return props.headerLabel;
  if (isExternalMode.value) return `${allCards.value.length} cards`;
  // Server-driven (browse): show "showing X of Y" using the true filtered total.
  const refined = data.value?.total ?? allCards.value.length;
  return formatCardCountLabel(refined, universeTotal.value ?? null);
});

// Skeleton rows for loading state
const skeletonCount = computed(() => cardsPerRow.value * 2);

function handleAdd(card: Card) {
  if (props.context === "cards") return;
  if (props.context === "deck") {
    emit("add-card", card);
    return;
  }
  addCard(card);
}

function getCount(card: Card): number | undefined {
  return props.cardCounts?.[card.id];
}

function handleTilePreview(card: Card) {
  emit("preview-card", card, orderedCards.value);
}

// Map context to CardThumb props
const tileShowAdd = computed(() => props.context !== "cards");
const tileShowRemove = computed(() => props.context === "working-deck" || props.context === "deck");
const tileShowRegen = computed(() => props.context !== "cards");

defineExpose({
  visibleCards: orderedCards,
});
</script>

<template>
  <!-- Normal flow: header always rendered, content switches below -->
  <div class="card-grid-wrapper">
    <div class="card-grid-header">
      <span class="card-count">{{ isLoading && !hasAnyFilter ? '' : displayLabel }}</span>
      <slot name="toolbar" />
      <div class="card-grid-header-controls">
        <div class="grid-search-wrap">
          <input
            type="text"
            class="grid-search"
            :placeholder="isDeckContext ? 'Search cards to add...' : 'Search cards...'"
            :value="searchValue"
            @input="handleSearchInput"
            @focus="isDeckContext && apiSearchResults.length > 0 && (showApiDropdown = true)"
            @blur="isDeckContext && handleApiSearchBlur()"
          />
          <span v-if="isDeckContext && apiSearchLoading" class="grid-search-spinner" />
          <button
            v-if="searchValue"
            class="grid-search-clear"
            @click="clearSearch"
          >&times;</button>
          <!-- API search dropdown (deck context only) -->
          <div v-if="isDeckContext && showApiDropdown" class="grid-search-dropdown">
            <div
              v-for="card in apiSearchResults"
              :key="card.id"
              class="grid-search-result"
              @mousedown.prevent="selectApiResult(card)"
            >
              <img
                v-if="card.imageBase"
                :src="card.imageBase + '/low.png'"
                class="grid-search-thumb"
              />
              <div v-else class="grid-search-thumb-placeholder" />
              <div class="grid-search-result-info">
                <span class="grid-search-result-name">{{ card.name }}</span>
                <span class="grid-search-result-set">{{ card.setCode }} {{ card.localId }}</span>
              </div>
              <span
                v-if="getDeckCount(card.setCode, card.localId) > 0"
                class="grid-search-result-count"
              >&times;{{ getDeckCount(card.setCode, card.localId) }}</span>
            </div>
          </div>
        </div>
        <div class="sort-group-wrap">
          <button class="sort-group-btn" @click="toggleSortGroupPopup">
            {{ sortGroupLabel }}
          </button>
          <div v-if="showSortGroupPopup" class="sort-group-popup">
            <div class="sort-group-backdrop" @click="closeSortGroupPopup" />
            <div class="sort-group-panel">
              <div class="sort-group-section">
                <div class="sort-group-section-title">Sort by</div>
                <div class="sort-group-options">
                  <button
                    v-for="opt in sortByOptions"
                    :key="opt.value"
                    :class="['sort-group-option', { active: sortBy === opt.value }]"
                    @click="sortBy = opt.value"
                  >{{ opt.label }}</button>
                </div>
                <button class="sort-group-dir-btn" @click="toggleSortDir">
                  {{ sortDir === 'asc' ? 'Ascending \u2191' : 'Descending \u2193' }}
                </button>
              </div>
              <div class="sort-group-section">
                <div class="sort-group-section-title">Group by</div>
                <div class="sort-group-options">
                  <button
                    v-for="opt in groupByOptions"
                    :key="opt.value"
                    :class="['sort-group-option', { active: groupBy === opt.value }]"
                    @click="groupBy = opt.value"
                  >{{ opt.label }}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <button
          v-if="context === 'browse'"
          :class="['stack-toggle-btn', { active: stackReprints }]"
          :title="stackReprints
            ? 'Same-art reprints are folded into one tile — click to show every printing'
            : 'Showing every printing — click to fold same-art reprints into one tile'"
          @click="stackReprints = !stackReprints"
        >&#x29C9; Stack reprints</button>
        <div class="image-mode-toggle">
          <button
            v-for="opt in modeOptions"
            :key="opt.value"
            :class="['mode-btn', { active: imageMode === opt.value }]"
            @click="setImageMode(opt.value)"
          >{{ opt.label }}</button>
        </div>
      </div>
    </div>

    <!-- Empty deck state -->
    <div v-if="isDeckContext && allCardsRaw.length === 0" class="dm-welcome">
      <div class="dm-welcome-inner">
        <div class="dm-welcome-title">Your Deck</div>
        <div class="dm-welcome-sub">Search above to find and add cards.</div>
      </div>
    </div>

    <!-- Boot loading state: server-side preload is still running -->
    <div v-else-if="!isExternalMode && loadingEra && allCards.length === 0" class="welcome-content">
      <div class="welcome-card">
        <div class="welcome-title">Loading cards…</div>
        <div class="welcome-loading">
          <div class="era-progress"><div class="era-progress-bar" /></div>
        </div>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-else-if="!isExternalMode && isLoading && allCards.length === 0" class="skeleton-grid" :style="{ padding: `${PADDING}px`, gap: `${GAP}px` }">
      <div
        v-for="i in skeletonCount"
        :key="i"
        class="skeleton-card"
        :style="{ width: `${cardWidth}px`, height: `${Math.ceil(cardWidth * 7 / 5)}px` }"
      />
    </div>

    <!-- Main grid -->
    <div v-else ref="scrollRef" class="card-grid-scroll">
      <div :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }">
        <div
          v-for="vItem in virtualizer.getVirtualItems()"
          :key="vItem.index"
          :ref="(el: any) => el && virtualizer.measureElement(el)"
          :data-index="vItem.index"
          :style="{
            position: 'absolute',
            top: `${vItem.start}px`,
            left: 0,
            width: '100%',
          }"
        >
          <!-- Group header -->
          <div
            v-if="virtualRows[vItem.index].type === 'header'"
            class="group-header"
          >
            <span class="group-header-label">
              {{ (virtualRows[vItem.index] as any).label }}
            </span>
            <span class="group-header-count">
              {{ (virtualRows[vItem.index] as any).count }}
            </span>
          </div>
          <!-- Card row -->
          <div
            v-else
            class="card-row"
            :style="{ padding: `0 ${PADDING}px`, gap: `${GAP}px` }"
          >
            <CardStack
              v-for="card in (virtualRows[vItem.index] as any).cards"
              :key="card.id"
              :group="groupFor(card)"
              :image-mode="imageMode"
              :count="getCount(card)"
              :show-add="tileShowAdd"
              :show-remove="tileShowRemove"
              :show-regen="tileShowRegen"
              :show-name="true"
              :selectable="selectable"
              :selected="selectedIds?.has(card.id)"
              :stale="staleIds?.has(card.id)"
              :style="{ width: `${cardWidth}px`, flexShrink: 0 }"
              @add="handleAdd(card)"
              @remove="emit('remove-card', card)"
              @regenerate="emit('regenerate-card', card)"
              @click="handleTilePreview(card)"
              @toggle-select="emit('toggle-select', $event)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
