<script setup lang="ts">
// Presentational "find a second card" panel for the jumbo pair-picker: a search
// box (bound to the parent's usePrintCardSearch state) plus result and recent
// pick grids. Emits the picked card. Styling: global .jumbo-* in styles/jumbo.css.
import type { Card } from "../../../shared/types/card.js";
import { cardImageUrl } from "../../../shared/utils/card-image-url.js";

defineProps<{
  searching: boolean;
  results: Card[];
  recentPicks: Card[];
}>();

const query = defineModel<string>("query", { required: true });

const emit = defineEmits<{ pick: [card: Card] }>();
</script>

<template>
  <div class="jumbo-section-label">Find a second card</div>
  <input
    v-model="query"
    type="text"
    class="jumbo-search"
    placeholder="Search any card by name…"
  />
  <div v-if="searching" class="jumbo-hint">Searching…</div>
  <div v-else-if="query.trim().length >= 2 && results.length === 0" class="jumbo-hint">
    No matches.
  </div>
  <div v-else-if="results.length" class="jumbo-pick-grid">
    <button
      v-for="c in results"
      :key="c.id"
      type="button"
      class="jumbo-pick"
      :title="c.name"
      @click="emit('pick', c)"
    >
      <img :src="cardImageUrl(c.imageBase, 'low') ?? ''" :alt="c.name" loading="lazy" />
    </button>
  </div>

  <template v-if="recentPicks.length">
    <div class="jumbo-section-label">Recent</div>
    <div class="jumbo-pick-grid">
      <button
        v-for="c in recentPicks"
        :key="c.id"
        type="button"
        class="jumbo-pick"
        :title="c.name"
        @click="emit('pick', c)"
      >
        <img :src="cardImageUrl(c.imageBase, 'low') ?? ''" :alt="c.name" loading="lazy" />
      </button>
    </div>
  </template>
</template>
