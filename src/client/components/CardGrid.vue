<script setup lang="ts">
import { ref, computed } from "vue";
import { useFilters } from "../composables/useFilters.js";
import { useCards } from "../composables/useCards.js";
import { useDecklist } from "../composables/useDecklist.js";
import { usePokeproxy, usePokeproxyBatch, type ImageMode } from "../composables/usePokeproxy.js";
import CardTile from "./CardTile.vue";
import type { Card } from "../../shared/types/card.js";

const emit = defineEmits<{ "preview-card": [card: Card, cards: Card[]] }>();

const { filters, page } = useFilters();
const { addCard } = useDecklist();
const { imageMode, setImageMode } = usePokeproxy();
const gridSearch = ref("");
const { data, isLoading } = useCards(filters, page);

// Pre-fetch pokeproxy status for visible cards (only when not in original mode)
const visibleCardIds = computed(() =>
  imageMode.value !== "original" ? (data.value?.cards?.map((c) => c.id) ?? []) : []
);
usePokeproxyBatch(visibleCardIds);

const filteredCards = computed(() => {
  if (!data.value?.cards || !gridSearch.value.trim()) return data.value?.cards ?? [];
  const q = gridSearch.value.toLowerCase();
  return data.value.cards.filter((card) => card.name.toLowerCase().includes(q));
});

const totalPages = computed(() =>
  data.value ? Math.ceil(data.value.total / data.value.pageSize) : 0
);

const hasFilters = computed(() => !!(filters.sets?.length || filters.era));

const modeOptions: { value: ImageMode; label: string }[] = [
  { value: "original", label: "Original" },
  { value: "composite", label: "Cleaned" },
  { value: "clean", label: "Full Clean" },
];
</script>

<template>
  <div v-if="!hasFilters" class="empty-state">
    Load a set or era from the sidebar to get started.
  </div>
  <div v-else-if="isLoading" class="loading">Loading cards...</div>
  <div v-else class="card-grid-container">
    <div class="card-grid-header">
      <span>{{ data?.total ?? 0 }} cards found</span>
      <div class="image-mode-toggle">
        <button
          v-for="opt in modeOptions"
          :key="opt.value"
          :class="['mode-btn', { active: imageMode === opt.value }]"
          @click="setImageMode(opt.value)"
        >{{ opt.label }}</button>
      </div>
      <input
        v-model="gridSearch"
        type="text"
        class="grid-search"
        placeholder="Filter this page..."
      />
      <span v-if="totalPages > 1">Page {{ page }} of {{ totalPages }}</span>
    </div>
    <div class="card-grid">
      <CardTile
        v-for="card in filteredCards"
        :key="card.id"
        :card="card"
        :image-mode="imageMode"
        @add="addCard"
        @preview="emit('preview-card', $event, filteredCards)"
      />
    </div>
    <div v-if="totalPages > 1" class="pagination">
      <button :disabled="page <= 1" @click="page--">Prev</button>
      <button :disabled="page >= totalPages" @click="page++">Next</button>
    </div>
  </div>
</template>
