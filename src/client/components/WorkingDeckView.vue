<script setup lang="ts">
import { ref, computed } from "vue";
import CardGrid from "./CardGrid.vue";
import BeautifyDialog from "./BeautifyDialog.vue";
import BatchGenerateDialog from "./BatchGenerateDialog.vue";
import VariantPicker from "./VariantPicker.vue";
import PrintDialog from "./PrintDialog.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import { useDecklist } from "../composables/useDecklist.js";
import { useDecks } from "../composables/useDecks.js";
import { useAuth } from "../composables/useAuth.js";
import { generateCleanImage } from "../composables/usePokeproxy.js";
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
  toDeckCards, loadSavedDeck,
} = useDecklist();

const { fetchDeck } = useDecks();
const { isLoggedIn } = useAuth();

/** If an art override is set, return a card with the art card's imageBase for display */
function displayCard(card: Card, artCard?: Card): Card {
  if (!artCard) return card;
  return { ...card, imageBase: artCard.imageBase };
}

const deckCards = computed(() =>
  items.value.map((i) => displayCard(i.card, i.artCard))
);

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
const showPrintDialog = ref(false);
const showSaveBeforePrint = ref(false);
const variantPickerCard = ref<Card | null>(null);

// --- Card grid handlers ---
function handleRemoveCard(card: Card) {
  removeCard(card.setCode, card.localId);
}

function handleAddCard(card: Card) {
  addCard(card);
}

function handleRegenerate(card: Card) {
  generateCleanImage(card.id, true);
}

function handlePreview(card: Card, cards: Card[]) {
  emit("preview-card", card, cards);
}

function handlePrint() {
  if (!currentDeckId.value) return;
  if (isDirty.value) {
    showSaveBeforePrint.value = true;
    return;
  }
  showPrintDialog.value = true;
}

async function handleSaveAndPrint() {
  showSaveBeforePrint.value = false;
  emit("save-update");
  // Brief delay to let the save complete before opening print
  await new Promise((r) => setTimeout(r, 300));
  showPrintDialog.value = true;
}

// --- Variant picker ---
function handlePickVariant(card: Card) {
  variantPickerCard.value = card;
}

function handleVariantPickerLightbox(card: Card) {
  variantPickerCard.value = null;
  handlePreview(card, deckCards.value);
}

async function handleVariantPickerUpdated() {
  if (currentDeckId.value) {
    const deck = await fetchDeck(currentDeckId.value);
    loadSavedDeck(deck);
  }
}

async function handleBeautifyUpdated() {
  showBeautify.value = false;
  if (currentDeckId.value) {
    const deck = await fetchDeck(currentDeckId.value);
    loadSavedDeck(deck);
  }
}
</script>

<template>
  <div class="dm-view">
    <!-- Card grid (always rendered so search is available) -->
    <CardGrid
      :cards="deckCards"
      :card-counts="cardCounts"
      :header-label="headerLabel"
      context="deck"
      @preview-card="handlePreview"
      @pick-variant="handlePickVariant"
      @add-card="handleAddCard"
      @remove-card="handleRemoveCard"
      @regenerate-card="handleRegenerate"
    >
      <template #toolbar>
        <div class="dm-view-actions">
          <button class="dm-action-btn" @click="showBeautify = true" :disabled="items.length === 0">Beautify</button>
          <button class="dm-action-btn" @click="showBatchGenerate = true" :disabled="items.length === 0 || !isLoggedIn" :title="!isLoggedIn ? 'Sign in to generate card images' : undefined">Generate</button>
          <button class="dm-action-btn" :disabled="!currentDeckId" :title="!isLoggedIn ? 'Sign in to save and print decks' : (!currentDeckId ? 'Save the deck first to print' : 'Open printable proxy sheet')" @click="handlePrint">Print</button>
          <button class="dm-action-btn" @click="emit('import')">Import</button>
          <button class="dm-action-btn" @click="emit('export')" :disabled="items.length === 0">Export</button>
          <button class="dm-action-btn dm-action-btn-danger" @click="clear()" :disabled="items.length === 0">Clear</button>
        </div>
      </template>
    </CardGrid>

    <BeautifyDialog
      v-if="showBeautify"
      :deck-id="currentDeckId"
      :deck-name="currentDeckName || 'Working Deck'"
      :deck-cards="toDeckCards()"
      @close="showBeautify = false"
      @updated="handleBeautifyUpdated"
    />

    <BatchGenerateDialog
      v-if="showBatchGenerate"
      :cards="toDeckCards()"
      @close="showBatchGenerate = false"
    />

    <VariantPicker
      v-if="variantPickerCard && currentDeckId"
      :card="variantPickerCard"
      :saved-deck-id="currentDeckId"
      :saved-deck-cards="toDeckCards()"
      @close="variantPickerCard = null"
      @open-lightbox="handleVariantPickerLightbox"
      @deck-updated="handleVariantPickerUpdated"
    />

    <PrintDialog
      v-if="showPrintDialog && currentDeckId"
      :deck-id="currentDeckId"
      @close="showPrintDialog = false"
    />

    <ConfirmDialog
      v-if="showSaveBeforePrint"
      title="Unsaved Changes"
      message="Your deck has unsaved changes. Save before printing?"
      confirm-label="Save & Print"
      :confirm-danger="false"
      @confirm="handleSaveAndPrint"
      @close="showSaveBeforePrint = false"
    />
  </div>
</template>
