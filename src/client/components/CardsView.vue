<script setup lang="ts">
import { ref, computed, watch } from "vue";
import CardGrid from "./CardGrid.vue";
import { useCustomizedCards } from "../composables/useCustomizedCards.js";
import { useGenerationQueryClient } from "../composables/usePokeproxy.js";
import type { Card } from "../../shared/types/card.js";
import type { DeckMembership } from "../../shared/types/customized-card.js";

useGenerationQueryClient();

const emit = defineEmits<{
  "preview-card": [card: Card, cards: Card[], deckMembership?: DeckMembership[]];
}>();

const {
  cards: customizedCards,
  isLoading,
  totalStale,
  selectedIds,
  toggleSelect,
  selectAll,
  clearSelection,
  filters,
  filteredCards,
  batchDelete,
  batchRegenerate,
} = useCustomizedCards();

// Derive Card[] + staleIds for CardGrid
const gridCards = computed(() => filteredCards.value.map((c) => c.card));

const staleIds = computed(() => {
  const set = new Set<string>();
  for (const c of filteredCards.value) {
    if (c.isStale) set.add(c.card.id);
  }
  return set;
});

// Build deck membership lookup for lightbox
const deckMembershipMap = computed(() => {
  const map = new Map<string, DeckMembership[]>();
  for (const c of customizedCards.value) {
    if (c.deckMembership.length > 0) {
      map.set(c.card.id, c.deckMembership);
    }
  }
  return map;
});

// Count map (1:1 for customized cards — no duplicate counts)
const cardCounts = computed(() => {
  const counts: Record<string, number> = {};
  // No count badges needed for cards view
  return counts;
});

const headerLabel = computed(() => {
  const total = filteredCards.value.length;
  const parts = [`${total} card${total !== 1 ? "s" : ""}`];
  if (totalStale.value > 0) parts.push(`${totalStale.value} stale`);
  return parts.join(", ");
});

const selectedCount = computed(() => selectedIds.value.size);

const batchDeleting = ref(false);
const batchRegenerating = ref(false);

async function handleBatchDelete() {
  if (batchDeleting.value || selectedCount.value === 0) return;
  batchDeleting.value = true;
  try {
    await batchDelete([...selectedIds.value]);
  } finally {
    batchDeleting.value = false;
  }
}

async function handleBatchRegenerate() {
  if (batchRegenerating.value || selectedCount.value === 0) return;
  batchRegenerating.value = true;
  try {
    await batchRegenerate([...selectedIds.value]);
  } finally {
    batchRegenerating.value = false;
  }
}

function handlePreview(card: Card, cards: Card[]) {
  const membership = deckMembershipMap.value.get(card.id);
  emit("preview-card", card, cards, membership);
}
</script>

<template>
  <!-- Loading -->
  <div v-if="isLoading" class="dm-welcome">
    <div class="dm-welcome-inner">Loading customized cards...</div>
  </div>

  <!-- Empty state -->
  <div v-else-if="gridCards.length === 0 && !filters.nameSearch && !filters.staleness && !filters.category" class="dm-welcome">
    <div class="dm-welcome-inner">
      <div class="dm-welcome-title">No Customized Cards</div>
      <div class="dm-welcome-sub">Cards with cleaned images, proxy settings, or prompt overrides will appear here.</div>
    </div>
  </div>

  <!-- Main view -->
  <div v-else class="cards-view">
    <!-- Batch toolbar -->
    <div v-if="selectedCount > 0" class="cards-batch-bar">
      <span class="cards-batch-count">{{ selectedCount }} selected</span>
      <button
        class="cards-batch-btn"
        :disabled="batchRegenerating"
        @click="handleBatchRegenerate"
      >
        {{ batchRegenerating ? "Regenerating..." : "Regenerate" }}
      </button>
      <button
        class="cards-batch-btn cards-batch-btn-danger"
        :disabled="batchDeleting"
        @click="handleBatchDelete"
      >
        {{ batchDeleting ? "Deleting..." : "Delete Clean" }}
      </button>
      <button class="cards-batch-btn" @click="selectAll">Select All</button>
      <button class="cards-batch-btn" @click="clearSelection">Clear</button>
    </div>

    <CardGrid
      :cards="gridCards"
      :card-counts="cardCounts"
      :header-label="headerLabel"
      :hide-add="true"
      :selectable="true"
      :selected-ids="selectedIds"
      :stale-ids="staleIds"
      @preview-card="handlePreview"
      @toggle-select="toggleSelect"
    />
  </div>
</template>

<style scoped>
.cards-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.cards-batch-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(15, 52, 96, 0.4);
  border-bottom: 1px solid rgba(15, 52, 96, 0.6);
}

.cards-batch-count {
  font-size: 13px;
  font-weight: 600;
  color: #e2e2e2;
  margin-right: auto;
}

.cards-batch-btn {
  padding: 4px 12px;
  font-size: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  color: #e2e2e2;
  cursor: pointer;
}

.cards-batch-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

.cards-batch-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cards-batch-btn-danger {
  border-color: rgba(233, 69, 96, 0.4);
  color: #e94560;
}

.cards-batch-btn-danger:hover:not(:disabled) {
  background: rgba(233, 69, 96, 0.15);
}
</style>
