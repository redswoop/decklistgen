<script setup lang="ts">
import { computed } from "vue";
import { useCustomizedCards } from "../composables/useCustomizedCards.js";

const emit = defineEmits<{
  collapse: [];
}>();

const {
  totalClean,
  totalSettings,
  totalStale,
  filteredCards,
  filters,
  resetFilters,
} = useCustomizedCards();

const totalCards = computed(() => filteredCards.value.length);

function handleStalenessChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value;
  filters.staleness = val ? (val as "stale" | "fresh") : undefined;
}

function handleCategoryChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value;
  filters.category = val ? (val as "Pokemon" | "Trainer" | "Energy") : undefined;
}

const hasActiveFilters = computed(() =>
  filters.staleness || filters.category
);
</script>

<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <span class="sidebar-header-title">Cards</span>
      <button class="sidebar-collapse-btn" @click="emit('collapse')">&lsaquo;</button>
    </div>

    <div class="sidebar-body">
      <!-- Summary stats -->
      <div class="sidebar-section-label">Summary</div>

      <div class="cards-stats">
        <div class="cards-stat" @click="filters.staleness = undefined">
          <span class="cards-stat-value">{{ totalCards }}</span>
          <span class="cards-stat-label">Total</span>
        </div>
        <div class="cards-stat" @click="filters.staleness = undefined">
          <span class="cards-stat-value">{{ totalClean }}</span>
          <span class="cards-stat-label">Cleaned</span>
        </div>
        <div
          class="cards-stat"
          :class="{ clickable: totalStale > 0 }"
          @click="totalStale > 0 && (filters.staleness = 'stale')"
        >
          <span class="cards-stat-value" :class="{ warn: totalStale > 0 }">{{ totalStale }}</span>
          <span class="cards-stat-label">Stale</span>
        </div>
        <div class="cards-stat">
          <span class="cards-stat-value">{{ totalSettings }}</span>
          <span class="cards-stat-label">Settings</span>
        </div>
      </div>

      <div class="sidebar-divider" />
      <div class="sidebar-section-label">Filters</div>

      <h2>Staleness</h2>
      <select :value="filters.staleness ?? ''" @change="handleStalenessChange">
        <option value="">All</option>
        <option value="stale">Stale</option>
        <option value="fresh">Fresh</option>
      </select>

      <h2>Category</h2>
      <select :value="filters.category ?? ''" @change="handleCategoryChange">
        <option value="">All</option>
        <option value="Pokemon">Pokemon</option>
        <option value="Trainer">Trainer</option>
        <option value="Energy">Energy</option>
      </select>

      <button
        v-if="hasActiveFilters"
        class="secondary"
        @click="resetFilters"
      >Reset Filters</button>
    </div>
  </div>
</template>

<style scoped>
.cards-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 8px;
}

.cards-stat {
  background: rgba(15, 52, 96, 0.3);
  border-radius: 6px;
  padding: 8px;
  text-align: center;
  cursor: default;
}

.cards-stat.clickable {
  cursor: pointer;
}

.cards-stat.clickable:hover {
  background: rgba(15, 52, 96, 0.5);
}

.cards-stat-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: #e2e2e2;
}

.cards-stat-value.warn {
  color: #f0a030;
}

.cards-stat-label {
  display: block;
  font-size: 11px;
  color: #7f8fa6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}
</style>
