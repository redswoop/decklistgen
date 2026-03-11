<script setup lang="ts">
import { ref, computed, watch } from "vue";
import CardGrid from "./CardGrid.vue";
import BeautifyDialog from "./BeautifyDialog.vue";
import { useDecks } from "../composables/useDecks.js";
import { useDecklist } from "../composables/useDecklist.js";
import type { Card } from "../../shared/types/card.js";
import type { SavedDeck } from "../../shared/types/deck.js";

const props = defineProps<{
  deckId: string | null;
}>();

import type { DeckCard } from "../../shared/types/deck.js";

const emit = defineEmits<{
  "preview-card": [card: Card, cards: Card[]];
  export: [];
  "deck-loaded": [name: string | null, cards?: DeckCard[]];
}>();

const { fetchDeck } = useDecks();
const { loadSavedDeck } = useDecklist();

const deck = ref<SavedDeck | null>(null);
const loading = ref(false);
const loadedMsg = ref("");

// Fetch deck data when deckId changes — read-only, does NOT modify working deck
async function loadDeck(id: string) {
  loadedMsg.value = "";
  loading.value = true;
  try {
    deck.value = await fetchDeck(id);
    emit("deck-loaded", deck.value.name, deck.value.cards);
  } catch {
    deck.value = null;
    emit("deck-loaded", null);
  } finally {
    loading.value = false;
  }
}

watch(() => props.deckId, (id) => {
  if (!id) {
    deck.value = null;
    emit("deck-loaded", null);
    return;
  }
  loadDeck(id);
}, { immediate: true });

// Cards for the grid (from the saved deck, NOT the working deck)
const deckCards = computed(() => {
  if (!deck.value) return [];
  return deck.value.cards.map((dc) => dc.card);
});

// Count map: cardId -> count
const cardCounts = computed(() => {
  if (!deck.value) return {};
  const counts: Record<string, number> = {};
  for (const dc of deck.value.cards) {
    counts[dc.card.id] = dc.count;
  }
  return counts;
});

const totalCards = computed(() =>
  deck.value?.cards.reduce((s, c) => s + c.count, 0) ?? 0
);

const headerLabel = computed(() => {
  if (!deck.value) return "";
  return `${deck.value.cards.length} unique · ${totalCards.value}/60 total`;
});

const showBeautify = ref(false);

async function handleBeautifyUpdated() {
  if (props.deckId) await loadDeck(props.deckId);
}

/** Re-fetch the current deck (called by parent after lightbox card replace) */
function refresh() {
  if (props.deckId) loadDeck(props.deckId);
}

defineExpose({ refresh });

/** Explicitly copy saved deck contents into the working deck (shopping cart) */
function handleLoadToWorkingDeck() {
  if (!deck.value) return;
  loadSavedDeck(deck.value);
  loadedMsg.value = "Loaded into working deck";
  setTimeout(() => { loadedMsg.value = ""; }, 2000);
}

function handleExport() {
  emit("export");
}

function handlePreview(card: Card, cards: Card[]) {
  emit("preview-card", card, cards);
}
</script>

<template>
  <!-- No deck selected -->
  <div v-if="!deckId" class="dm-welcome">
    <div class="dm-welcome-inner">
      <div class="dm-welcome-title">Deck Manager</div>
      <div class="dm-welcome-sub">Select a deck from the sidebar to view and manage it.</div>
    </div>
  </div>

  <!-- Loading -->
  <div v-else-if="loading" class="dm-welcome">
    <div class="dm-welcome-inner">Loading deck...</div>
  </div>

  <!-- Deck loaded -->
  <div v-else-if="deck" class="dm-view">
    <div class="dm-view-toolbar">
      <span class="dm-view-name">{{ deck.name }}</span>
      <span v-if="loadedMsg" class="dm-loaded-msg">{{ loadedMsg }}</span>
      <div class="dm-view-actions">
        <button class="dm-action-btn" title="Copy this deck into the working deck (right panel)" @click="handleLoadToWorkingDeck">
          Load to Deck
        </button>
        <button class="dm-action-btn" title="Upgrade card variants" @click="showBeautify = true">
          Beautify
        </button>
        <button class="dm-action-btn" @click="handleExport">Export</button>
      </div>
    </div>
    <CardGrid
      :cards="deckCards"
      :card-counts="cardCounts"
      :header-label="headerLabel"
      :hide-add="false"
      @preview-card="handlePreview"
    />

    <BeautifyDialog
      v-if="showBeautify && deck"
      :deck-id="deck.id"
      :deck-name="deck.name"
      @close="showBeautify = false"
      @updated="handleBeautifyUpdated"
    />
  </div>
</template>
