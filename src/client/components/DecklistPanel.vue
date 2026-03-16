<script setup lang="ts">
import { ref } from "vue";
import { useDecklist } from "../composables/useDecklist.js";
import type { Card } from "../../shared/types/card.js";

const emit = defineEmits<{
  collapse: [];
  "preview-card": [card: Card];
}>();

const {
  items, totalCards, countColor, stats, DECK_SIZE,
  incrementCard, removeCard,
  currentDeckName,
} = useDecklist();

const expandedSections = ref<Record<string, boolean>>({});

function toggle(section: string) {
  expandedSections.value[section] = !expandedSections.value[section];
}

function openPreview(card: Card) {
  emit("preview-card", card);
}
</script>

<template>
  <div class="decklist-panel">
    <div class="decklist-header">
      <h3>{{ currentDeckName || 'New Deck' }}</h3>
      <span class="deck-count" :style="{ color: countColor }">
        {{ totalCards }}/{{ DECK_SIZE }}
      </span>
      <button class="decklist-collapse-btn" @click="emit('collapse')">&rsaquo;</button>
    </div>

    <div class="decklist-items">
      <div v-if="items.length === 0" class="empty-state">
        Click cards to add them to your decklist.
      </div>
      <div
        v-for="item in items"
        :key="`${item.setCode}-${item.localId}`"
        class="decklist-item"
        @click="openPreview(item.card)"
      >
        <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" />
        <div
          v-else
          :style="{ width: '32px', height: '45px', background: '#0f3460', borderRadius: '3px' }"
        />
        <div class="item-info">
          <div class="item-name">{{ item.name }}</div>
          <div class="item-set">{{ item.setCode }} {{ item.localId }}</div>
        </div>
        <div class="item-controls">
          <button @click.stop="removeCard(item.setCode, item.localId)">-</button>
          <span class="item-count">{{ item.count }}</span>
          <button @click.stop="incrementCard(item.setCode, item.localId)">+</button>
        </div>
      </div>
    </div>

    <!-- Stats box -->
    <div v-if="items.length > 0" class="deck-stats">
      <div class="stats-row" @click="toggle('pokemon')">
        <span class="stats-label">Pokemon</span>
        <span class="stats-count">{{ stats.pokemon.total }}</span>
        <span class="stats-chevron">{{ expandedSections.pokemon ? '\u25BC' : '\u25B6' }}</span>
      </div>
      <div v-if="expandedSections.pokemon" class="stats-sub">
        <div v-if="stats.pokemon.basic" class="stats-sub-row">
          <span>Basic</span><span>{{ stats.pokemon.basic }}</span>
        </div>
        <div v-if="stats.pokemon.stage1" class="stats-sub-row">
          <span>Stage 1</span><span>{{ stats.pokemon.stage1 }}</span>
        </div>
        <div v-if="stats.pokemon.stage2" class="stats-sub-row">
          <span>Stage 2</span><span>{{ stats.pokemon.stage2 }}</span>
        </div>
        <div v-if="stats.pokemon.ex" class="stats-sub-row">
          <span>ex</span><span>{{ stats.pokemon.ex }}</span>
        </div>
        <div v-if="stats.pokemon.v" class="stats-sub-row">
          <span>V/VMAX/VSTAR</span><span>{{ stats.pokemon.v }}</span>
        </div>
      </div>

      <div class="stats-row" @click="toggle('trainer')">
        <span class="stats-label">Trainer</span>
        <span class="stats-count">{{ stats.trainer.total }}</span>
        <span class="stats-chevron">{{ expandedSections.trainer ? '\u25BC' : '\u25B6' }}</span>
      </div>
      <div v-if="expandedSections.trainer" class="stats-sub">
        <div v-if="stats.trainer.supporter" class="stats-sub-row">
          <span>Supporter</span><span>{{ stats.trainer.supporter }}</span>
        </div>
        <div v-if="stats.trainer.item" class="stats-sub-row">
          <span>Item</span><span>{{ stats.trainer.item }}</span>
        </div>
        <div v-if="stats.trainer.stadium" class="stats-sub-row">
          <span>Stadium</span><span>{{ stats.trainer.stadium }}</span>
        </div>
        <div v-if="stats.trainer.tool" class="stats-sub-row">
          <span>Tool</span><span>{{ stats.trainer.tool }}</span>
        </div>
      </div>

      <div class="stats-row">
        <span class="stats-label">Energy</span>
        <span class="stats-count">{{ stats.energy.total }}</span>
        <span class="stats-chevron" style="visibility: hidden">&nbsp;</span>
      </div>
    </div>
  </div>
</template>
