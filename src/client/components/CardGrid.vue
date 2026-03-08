<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { useFilters } from "../composables/useFilters.js";
import { useCards } from "../composables/useCards.js";
import { useDecklist } from "../composables/useDecklist.js";
import { usePokeproxy, usePokeproxyBatch, type ImageMode } from "../composables/usePokeproxy.js";
import CardTile from "./CardTile.vue";
import type { Card } from "../../shared/types/card.js";

const emit = defineEmits<{ "preview-card": [card: Card, cards: Card[]] }>();

const { filters } = useFilters();
const { addCard } = useDecklist();
const { imageMode, setImageMode } = usePokeproxy();
const gridSearch = ref("");

// Fetch all matching cards (no pagination)
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
      containerWidth.value = entries[0].contentRect.width;
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

// Filter
const allCards = computed(() => data.value?.cards ?? []);
const filteredCards = computed(() => {
  if (!gridSearch.value.trim()) return allCards.value;
  const q = gridSearch.value.toLowerCase();
  return allCards.value.filter((c) => c.name.toLowerCase().includes(q));
});

const hasAnyFilter = computed(() =>
  !!(filters.sets?.length || filters.era || filters.category || filters.rarities?.length
    || filters.energyTypes?.length || filters.specialAttributes?.length
    || filters.nameSearch || filters.trainerType || filters.isFullArt || filters.hasFoil)
);

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
  const cards = filteredCards.value;
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
  { value: "composite", label: "Cleaned" },
  { value: "clean", label: "Full Clean" },
];

const groupByOptions: { value: GroupBy; label: string }[] = [
  { value: "none", label: "No grouping" },
  { value: "set", label: "Set" },
  { value: "energyType", label: "Energy Type" },
  { value: "rarity", label: "Rarity" },
  { value: "category", label: "Category" },
];
</script>

<template>
  <div v-if="!hasAnyFilter" class="empty-state">
    Select an era from the sidebar to get started.
  </div>
  <div v-else-if="!isLoading && allCards.length === 0 && !filters.era && !filters.sets?.length" class="empty-state">
    No cards loaded. Select an era to load cards first.
  </div>
  <div v-else-if="isLoading" class="loading">Loading cards...</div>
  <div v-else class="card-grid-wrapper">
    <div class="card-grid-header">
      <span>{{ filteredCards.length }} cards</span>
      <div class="image-mode-toggle">
        <button
          v-for="opt in modeOptions"
          :key="opt.value"
          :class="['mode-btn', { active: imageMode === opt.value }]"
          @click="setImageMode(opt.value)"
        >{{ opt.label }}</button>
      </div>
      <select v-model="groupBy" class="group-by-select">
        <option v-for="opt in groupByOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <input
        v-model="gridSearch"
        type="text"
        class="grid-search"
        placeholder="Filter cards..."
      />
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
              :style="{ width: `${cardWidth}px`, flexShrink: 0 }"
              @add="addCard"
              @preview="emit('preview-card', $event, orderedCards)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
