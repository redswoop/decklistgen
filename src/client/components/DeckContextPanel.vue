<script setup lang="ts">
import { ref, computed } from "vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import { useDecklist } from "../composables/useDecklist.js";
import { useDecks } from "../composables/useDecks.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import type { Card } from "../../shared/types/card.js";
import type { DeckSummary } from "../../shared/types/deck.js";

const emit = defineEmits<{
  collapse: [];
  "preview-card": [card: Card];
  "go-to-gallery": [];
}>();

const {
  items, totalCards, countColor, stats, DECK_SIZE,
  incrementCard, removeCard,
  currentDeckId, currentDeckName, isDirty, loadSavedDeck,
} = useDecklist();

const { decks, fetchDeck } = useDecks();

const expandedSections = ref<Record<string, boolean>>({});
const showSwitcher = ref(false);
const dirtyGuardTarget = ref<string | null>(null);

const otherDecks = computed(() =>
  decks.value.filter((d) => d.id !== currentDeckId.value)
);

function toggle(section: string) {
  expandedSections.value[section] = !expandedSections.value[section];
}

function openPreview(card: Card) {
  emit("preview-card", card);
}

function coverUrl(deck: DeckSummary): string {
  return deck.coverImage ? cardImageUrl(deck.coverImage, "low") : "";
}

async function switchToDeck(id: string) {
  if (isDirty.value && currentDeckId.value !== id) {
    dirtyGuardTarget.value = id;
    return;
  }
  await doSwitch(id);
}

async function doSwitch(id: string) {
  dirtyGuardTarget.value = null;
  const deck = await fetchDeck(id);
  loadSavedDeck(deck);
  showSwitcher.value = false;
}

function confirmDirtySwitch() {
  if (dirtyGuardTarget.value) {
    doSwitch(dirtyGuardTarget.value);
  }
}
</script>

<template>
  <div class="deck-context-panel">
    <!-- Header with switcher -->
    <div class="dcp-header">
      <div class="dcp-header-top">
        <button class="dcp-gallery-btn" @click="emit('go-to-gallery')">Gallery</button>
        <button class="dcp-collapse-btn" @click="emit('collapse')">&lsaquo;</button>
      </div>
      <div class="dcp-deck-name" @click="showSwitcher = !showSwitcher">
        <span class="dcp-name-text">{{ currentDeckName || 'No Deck' }}</span>
        <span class="dcp-count" :style="{ color: countColor }">{{ totalCards }}/{{ DECK_SIZE }}</span>
        <span class="dcp-chevron">{{ showSwitcher ? '\u25B2' : '\u25BC' }}</span>
      </div>

      <div v-if="showSwitcher" class="dcp-switcher">
        <div
          v-for="deck in otherDecks"
          :key="deck.id"
          class="dcp-switcher-row"
          @click="switchToDeck(deck.id)"
        >
          <img v-if="coverUrl(deck)" :src="coverUrl(deck)" class="dcp-switcher-cover" />
          <div v-else class="dcp-switcher-cover-ph" />
          <div class="dcp-switcher-info">
            <div class="dcp-switcher-name">{{ deck.name }}</div>
            <div class="dcp-switcher-meta">{{ deck.cardCount }}/60</div>
          </div>
        </div>
        <div v-if="otherDecks.length === 0" class="dcp-switcher-empty">No other decks</div>
      </div>
    </div>

    <!-- Deck contents -->
    <div class="dcp-items">
      <div v-if="items.length === 0" class="dcp-empty">
        No cards in deck yet.
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

    <!-- Stats -->
    <div v-if="items.length > 0" class="deck-stats">
      <div class="stats-row" @click="toggle('pokemon')">
        <span class="stats-label">Pokemon</span>
        <span class="stats-count">{{ stats.pokemon.total }}</span>
        <span class="stats-chevron">{{ expandedSections.pokemon ? '\u25BC' : '\u25B6' }}</span>
      </div>
      <div v-if="expandedSections.pokemon" class="stats-sub">
        <div v-if="stats.pokemon.basic" class="stats-sub-row"><span>Basic</span><span>{{ stats.pokemon.basic }}</span></div>
        <div v-if="stats.pokemon.stage1" class="stats-sub-row"><span>Stage 1</span><span>{{ stats.pokemon.stage1 }}</span></div>
        <div v-if="stats.pokemon.stage2" class="stats-sub-row"><span>Stage 2</span><span>{{ stats.pokemon.stage2 }}</span></div>
        <div v-if="stats.pokemon.ex" class="stats-sub-row"><span>ex</span><span>{{ stats.pokemon.ex }}</span></div>
        <div v-if="stats.pokemon.v" class="stats-sub-row"><span>V/VMAX/VSTAR</span><span>{{ stats.pokemon.v }}</span></div>
      </div>

      <div class="stats-row" @click="toggle('trainer')">
        <span class="stats-label">Trainer</span>
        <span class="stats-count">{{ stats.trainer.total }}</span>
        <span class="stats-chevron">{{ expandedSections.trainer ? '\u25BC' : '\u25B6' }}</span>
      </div>
      <div v-if="expandedSections.trainer" class="stats-sub">
        <div v-if="stats.trainer.supporter" class="stats-sub-row"><span>Supporter</span><span>{{ stats.trainer.supporter }}</span></div>
        <div v-if="stats.trainer.item" class="stats-sub-row"><span>Item</span><span>{{ stats.trainer.item }}</span></div>
        <div v-if="stats.trainer.stadium" class="stats-sub-row"><span>Stadium</span><span>{{ stats.trainer.stadium }}</span></div>
        <div v-if="stats.trainer.tool" class="stats-sub-row"><span>Tool</span><span>{{ stats.trainer.tool }}</span></div>
      </div>

      <div class="stats-row">
        <span class="stats-label">Energy</span>
        <span class="stats-count">{{ stats.energy.total }}</span>
        <span class="stats-chevron" style="visibility: hidden">&nbsp;</span>
      </div>
    </div>

    <ConfirmDialog
      v-if="dirtyGuardTarget"
      title="Unsaved Changes"
      message="You have unsaved changes. Discard them and switch decks?"
      confirm-label="Discard & Switch"
      :confirm-danger="false"
      @confirm="confirmDirtySwitch"
      @close="dirtyGuardTarget = null"
    />
  </div>
</template>
