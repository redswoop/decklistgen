<script setup lang="ts">
import { ref, computed } from "vue";
import CardGrid from "./CardGrid.vue";
import BeautifyDialog from "./BeautifyDialog.vue";
import BatchGenerateDialog from "./BatchGenerateDialog.vue";
import { useDecklist } from "../composables/useDecklist.js";
import { generateCleanImage } from "../composables/usePokeproxy.js";
import { api } from "../lib/client.js";
import type { Card } from "../../shared/types/card.js";

const emit = defineEmits<{
  "preview-card": [card: Card, cards: Card[]];
  export: [];
  import: [];
  save: [];
  "save-update": [];
}>();

const {
  items, totalCards, countColor, DECK_SIZE,
  addCard, removeCard, clear,
  currentDeckId, currentDeckName, isDirty,
  toDeckCards,
} = useDecklist();

const deckCards = computed(() => items.value.map((i) => i.card));

const cardCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const item of items.value) {
    counts[item.card.id] = item.count;
  }
  return counts;
});

const headerLabel = computed(() => {
  return `${items.value.length} unique · ${totalCards.value}/60 total`;
});

const showBeautify = ref(false);
const showBatchGenerate = ref(false);

function handleRemoveCard(card: Card) {
  removeCard(card.setCode, card.localId);
}

function handleRegenerate(card: Card) {
  generateCleanImage(card.id, true);
}

function handlePreview(card: Card, cards: Card[]) {
  emit("preview-card", card, cards);
}

function handleSave() {
  if (items.value.length === 0) return;
  if (currentDeckId.value && isDirty.value) {
    emit("save-update");
  } else {
    emit("save");
  }
}

function handlePrint() {
  if (!currentDeckId.value) return;
  window.open(api.deckPrintUrl(currentDeckId.value), "_blank");
}
</script>

<template>
  <!-- Empty state -->
  <div v-if="items.length === 0" class="dm-welcome">
    <div class="dm-welcome-inner">
      <div class="dm-welcome-title">Working Deck</div>
      <div class="dm-welcome-sub">No cards yet. Browse cards and add them to your deck.</div>
    </div>
  </div>

  <!-- Working deck view -->
  <div v-else class="dm-view">
    <div class="dm-view-toolbar">
      <span class="dm-view-name">{{ currentDeckName || 'Untitled Deck' }}</span>
      <span class="deck-count" :style="{ color: countColor }">
        {{ totalCards }}/{{ DECK_SIZE }}
      </span>
      <span v-if="isDirty" class="dm-unsaved-badge">Unsaved</span>
      <div class="dm-view-actions">
        <button class="dm-action-btn" :disabled="items.length === 0" @click="handleSave">
          {{ currentDeckId && isDirty ? 'Save' : 'Save As...' }}
        </button>
        <button class="dm-action-btn" @click="showBeautify = true">Beautify</button>
        <button class="dm-action-btn" @click="showBatchGenerate = true">Generate</button>
        <button class="dm-action-btn" :disabled="!currentDeckId" :title="currentDeckId ? 'Open printable proxy sheet' : 'Save the deck first to print'" @click="handlePrint">Print</button>
        <button class="dm-action-btn" @click="emit('import')">Import</button>
        <button class="dm-action-btn" @click="emit('export')">Export</button>
        <button class="dm-action-btn dm-action-btn-danger" @click="clear()">Clear</button>
      </div>
    </div>
    <CardGrid
      :cards="deckCards"
      :card-counts="cardCounts"
      :header-label="headerLabel"
      context="working-deck"
      @preview-card="handlePreview"
      @remove-card="handleRemoveCard"
      @regenerate-card="handleRegenerate"
    />

    <BeautifyDialog
      v-if="showBeautify"
      :deck-id="currentDeckId"
      :deck-name="currentDeckName || 'Working Deck'"
      :deck-cards="toDeckCards()"
      @close="showBeautify = false"
      @updated="showBeautify = false"
    />

    <BatchGenerateDialog
      v-if="showBatchGenerate"
      :cards="toDeckCards()"
      @close="showBatchGenerate = false"
    />
  </div>
</template>
