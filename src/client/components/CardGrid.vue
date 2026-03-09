<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { useFilters } from "../composables/useFilters.js";
import { useCards } from "../composables/useCards.js";
import { useDecklist } from "../composables/useDecklist.js";
import { usePokeproxy, usePokeproxyBatch, type ImageMode } from "../composables/usePokeproxy.js";
import { useEraLoader } from "../composables/useEraLoader.js";
import CardTile from "./CardTile.vue";
import type { Card } from "../../shared/types/card.js";

const props = withDefaults(defineProps<{
  /** External card array — skips API query when provided */
  cards?: Card[];
  /** Count map (cardId → count) to show on tiles instead of deck counts */
  cardCounts?: Record<string, number>;
  /** Hide the add-to-deck button on tiles */
  hideAdd?: boolean;
  /** Header label override (replaces "X cards") */
  headerLabel?: string;
  /** Enable selection checkboxes on tiles */
  selectable?: boolean;
  /** Set of selected card IDs */
  selectedIds?: Set<string>;
  /** Set of stale card IDs (shows amber badge) */
  staleIds?: Set<string>;
}>(), {
  cards: undefined,
  cardCounts: undefined,
  hideAdd: false,
  headerLabel: undefined,
  selectable: false,
  selectedIds: undefined,
  staleIds: undefined,
});

const emit = defineEmits<{
  "preview-card": [card: Card, cards: Card[]];
  "toggle-select": [cardId: string];
}>();

const { filters, setNameSearch } = useFilters();
const { addCard } = useDecklist();
const { imageMode, setImageMode } = usePokeproxy();
const { loadingEra, loadEra } = useEraLoader();

// Only query API when no external cards provided
const localPage = ref(1);
const { data, isLoading } = useCards(filters, localPage, 99999);

// Group-by
type GroupBy = "none" | "set" | "energyType" | "rarity" | "category";
const groupBy = ref<GroupBy>("set");

// Container sizing
const scrollRef = ref<HTMLElement | null>(null);
const containerWidth = ref(800);
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (scrollRef.value) {
    containerWidth.value = scrollRef.value.clientWidth;
    resizeObserver = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) containerWidth.value = w;
    });
    resizeObserver.observe(scrollRef.value);
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

const cardRowHeight = computed(() => Math.ceil(cardWidth.value * 7 / 5) + GAP);

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

const virtualRows = computed(() => {
  const cards = allCards.value;
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

const groupByOptions: { value: GroupBy; label: string }[] = [
  { value: "none", label: "No grouping" },
  { value: "set", label: "Set" },
  { value: "energyType", label: "Energy Type" },
  { value: "rarity", label: "Rarity" },
  { value: "category", label: "Category" },
];

// Search input handler
function handleSearchInput(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  if (isExternalMode.value) {
    localSearch.value = val;
  } else {
    setNameSearch(val);
  }
}

function clearSearch() {
  if (isExternalMode.value) {
    localSearch.value = "";
  } else {
    setNameSearch("");
  }
}

const searchValue = computed(() =>
  isExternalMode.value ? localSearch.value : (filters.nameSearch ?? "")
);

const displayLabel = computed(() => {
  if (props.headerLabel) return props.headerLabel;
  return `${allCards.value.length} cards`;
});

// Skeleton rows for loading state
const skeletonCount = computed(() => cardsPerRow.value * 2);

function handleAdd(card: Card) {
  if (!props.hideAdd) addCard(card);
}

function getCount(card: Card): number | undefined {
  return props.cardCounts?.[card.id];
}
</script>

<template>
  <!-- Welcome state: no filters active (only in API mode) -->
  <div v-if="!isExternalMode && !hasAnyFilter" class="welcome-state">
    <div class="welcome-card">
      <div class="welcome-title">Pokemon TCG Card Browser</div>
      <div class="welcome-subtitle">Load an era to browse cards</div>
      <div class="welcome-buttons">
        <button
          class="welcome-btn welcome-btn-sv"
          :disabled="loadingEra"
          @click="loadEra('sv')"
        >
          <span class="welcome-btn-label">Scarlet &amp; Violet</span>
        </button>
        <button
          class="welcome-btn welcome-btn-swsh"
          :disabled="loadingEra"
          @click="loadEra('swsh')"
        >
          <span class="welcome-btn-label">Sword &amp; Shield</span>
        </button>
      </div>
      <div v-if="loadingEra" class="welcome-loading">
        <div class="era-progress"><div class="era-progress-bar" /></div>
      </div>
      <div class="welcome-hint">or pick individual sets from the sidebar</div>
    </div>
  </div>

  <!-- Loading skeleton (API mode only) -->
  <div v-else-if="!isExternalMode && isLoading" class="card-grid-wrapper">
    <div class="card-grid-header">
      <span class="card-count">Loading...</span>
      <div class="grid-search-wrap">
        <input type="text" class="grid-search" placeholder="Search cards..." disabled />
      </div>
      <select class="group-by-select" disabled>
        <option>Set</option>
      </select>
      <div class="image-mode-toggle">
        <button class="mode-btn active">Original</button>
        <button class="mode-btn">Proxy</button>
      </div>
    </div>
    <div class="skeleton-grid" :style="{ padding: `${PADDING}px`, gap: `${GAP}px` }">
      <div
        v-for="i in skeletonCount"
        :key="i"
        class="skeleton-card"
        :style="{ width: `${cardWidth}px`, height: `${Math.ceil(cardWidth * 7 / 5)}px` }"
      />
    </div>
  </div>

  <!-- Empty state (external mode) -->
  <div v-else-if="isExternalMode && allCardsRaw.length === 0" class="empty-state">
    No cards in this deck.
  </div>

  <!-- No cards loaded (API mode) -->
  <div v-else-if="!isExternalMode && allCards.length === 0 && !filters.era && !filters.sets?.length" class="empty-state">
    No cards loaded. Select an era to load cards first.
  </div>

  <!-- Main grid -->
  <div v-else class="card-grid-wrapper">
    <div class="card-grid-header">
      <span class="card-count">{{ displayLabel }}</span>
      <div class="grid-search-wrap">
        <input
          type="text"
          class="grid-search"
          placeholder="Search cards..."
          :value="searchValue"
          @input="handleSearchInput"
        />
        <button
          v-if="searchValue"
          class="grid-search-clear"
          @click="clearSearch"
        >&times;</button>
      </div>
      <select v-model="groupBy" class="group-by-select">
        <option v-for="opt in groupByOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <div class="image-mode-toggle">
        <button
          v-for="opt in modeOptions"
          :key="opt.value"
          :class="['mode-btn', { active: imageMode === opt.value }]"
          @click="setImageMode(opt.value)"
        >{{ opt.label }}</button>
      </div>
    </div>
    <div ref="scrollRef" class="card-grid-scroll">
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
            <CardTile
              v-for="card in (virtualRows[vItem.index] as any).cards"
              :key="card.id"
              :card="card"
              :image-mode="imageMode"
              :count="getCount(card)"
              :hide-add="hideAdd"
              :selectable="selectable"
              :selected="selectedIds?.has(card.id)"
              :stale="staleIds?.has(card.id)"
              :style="{ width: `${cardWidth}px`, flexShrink: 0 }"
              @add="handleAdd"
              @preview="emit('preview-card', $event, orderedCards)"
              @toggle-select="emit('toggle-select', $event)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
