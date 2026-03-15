<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import CardGrid from "./CardGrid.vue";
import BeautifyDialog from "./BeautifyDialog.vue";
import BatchGenerateDialog from "./BatchGenerateDialog.vue";
import VariantPicker from "./VariantPicker.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import PrintDialog from "./PrintDialog.vue";
import { useDecks } from "../composables/useDecks.js";
import { useDecklist } from "../composables/useDecklist.js";
import { generateCleanImage } from "../composables/usePokeproxy.js";
import { api } from "../lib/client.js";
import type { Card } from "../../shared/types/card.js";
import type { SavedDeck } from "../../shared/types/deck.js";

const props = defineProps<{
  deckId: string | null;
  isWorkingDeckSource: boolean;
  workingDeckIsDirty: boolean;
}>();

import type { DeckCard } from "../../shared/types/deck.js";

const emit = defineEmits<{
  "preview-card": [card: Card, cards: Card[]];
  export: [];
  "deck-loaded": [name: string | null, cards?: DeckCard[]];
  "edit-working-deck": [];
  "save-update": [];
  deleted: [];
}>();

const { fetchDeck, updateDeck, deleteDeck, copyDeck } = useDecks();
const { loadSavedDeck, addCard, removeCard, currentDeckId: workingDeckSourceId, items: workingItems, totalCards: workingTotalCards } = useDecklist();

const deck = ref<SavedDeck | null>(null);
const loading = ref(false);

// Fetch deck data when deckId changes — read-only, does NOT modify working deck
// silent=true skips the loading spinner so CardGrid stays mounted (preserves groupBy etc.)
async function loadDeck(id: string, silent = false) {
  if (!silent) loading.value = true;
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

const useLive = computed(() => props.isWorkingDeckSource && props.workingDeckIsDirty);

// Cards for the grid — switch to working deck when actively editing
const deckCards = computed(() => {
  if (!deck.value) return [];
  if (useLive.value) {
    return workingItems.value.filter((i) => i.count > 0).map((i) => i.card);
  }
  return deck.value.cards.map((dc) => dc.card);
});

// Count map: cardId -> count
const cardCounts = computed(() => {
  if (!deck.value) return {};
  const counts: Record<string, number> = {};
  if (useLive.value) {
    for (const item of workingItems.value) {
      if (item.count > 0) counts[item.card.id] = item.count;
    }
  } else {
    for (const dc of deck.value.cards) {
      counts[dc.card.id] = dc.count;
    }
  }
  return counts;
});

const totalCards = computed(() =>
  deck.value?.cards.reduce((s, c) => s + c.count, 0) ?? 0
);

const headerLabel = computed(() => {
  if (!deck.value) return "";
  if (props.isWorkingDeckSource && props.workingDeckIsDirty) {
    const unique = workingItems.value.length;
    return `${unique} unique · ${workingTotalCards.value}/60 total`;
  }
  return `${deck.value.cards.length} unique · ${totalCards.value}/60 total`;
});

const showBeautify = ref(false);
const showBatchGenerate = ref(false);
const showPrintDialog = ref(false);
const variantPickerCard = ref<Card | null>(null);

function handlePickVariant(card: Card) {
  variantPickerCard.value = card;
}

function handleVariantPickerLightbox(card: Card) {
  variantPickerCard.value = null;
  handlePreview(card, deckCards.value);
}

async function handleVariantPickerUpdated() {
  if (props.deckId) {
    await loadDeck(props.deckId, true);
    // Sync working deck so it picks up variant changes from DB
    if (deck.value) loadSavedDeck(deck.value);
  }
}

async function handleBeautifyUpdated() {
  if (props.deckId) {
    await loadDeck(props.deckId, true);
    // Sync working deck so it picks up beautify changes from DB
    if (deck.value) loadSavedDeck(deck.value);
  }
}

/** Re-fetch the current deck (called by parent after lightbox card replace) */
function refresh() {
  if (props.deckId) loadDeck(props.deckId, true);
}

defineExpose({ refresh });

/** Explicitly copy saved deck contents into the working deck, then switch to edit view */
function handleEditDeck() {
  if (!deck.value) return;
  loadSavedDeck(deck.value);
  emit("edit-working-deck");
}

function handlePrint() {
  if (!deck.value) return;
  showPrintDialog.value = true;
}

function handleExport() {
  emit("export");
}

// --- Save ---
const canSave = computed(() => props.isWorkingDeckSource && props.workingDeckIsDirty);
const saveTooltip = computed(() => {
  if (!props.isWorkingDeckSource) return "Load this deck into the working deck first (Edit) to make changes";
  if (!props.workingDeckIsDirty) return "No unsaved changes";
  return "Save changes to this deck";
});

function handleSave() {
  emit("save-update");
}

// --- Rename ---
const renaming = ref(false);
const renameValue = ref("");
const renameInput = ref<HTMLInputElement | null>(null);

function startRename() {
  if (!deck.value) return;
  renameValue.value = deck.value.name;
  renaming.value = true;
  nextTick(() => {
    renameInput.value?.focus();
    renameInput.value?.select();
  });
}

async function confirmRename() {
  if (!deck.value) { renaming.value = false; return; }
  const trimmed = renameValue.value.trim();
  if (trimmed && trimmed !== deck.value.name) {
    await updateDeck({ id: deck.value.id, data: { name: trimmed } });
    await loadDeck(deck.value.id, true);
  }
  renaming.value = false;
}

// --- Duplicate ---
async function handleDuplicate() {
  if (!deck.value) return;
  await copyDeck({ id: deck.value.id });
}

// --- Delete ---
const showDeleteConfirm = ref(false);

async function handleDelete() {
  if (!deck.value) return;
  const id = deck.value.id;
  showDeleteConfirm.value = false;
  await deleteDeck(id);
  emit("deleted");
}

// --- Add card (from + button on card tiles) ---
function handleAddCard(card: Card) {
  if (!deck.value) return;
  // Ensure the working deck is loaded from this saved deck before adding
  if (workingDeckSourceId.value !== deck.value.id) {
    loadSavedDeck(deck.value);
  }
  addCard(card);
}

function handleRemoveCard(card: Card) {
  if (!deck.value) return;
  if (workingDeckSourceId.value !== deck.value.id) {
    loadSavedDeck(deck.value);
  }
  removeCard(card.setCode, card.localId);
}

function handleRegenerate(card: Card) {
  generateCleanImage(card.id, true);
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
      <span v-if="renaming" class="dm-view-name">
        <input
          ref="renameInput"
          v-model="renameValue"
          class="dm-rename-input dm-view-rename-input"
          @keyup.enter="confirmRename"
          @keyup.escape="renaming = false"
          @blur="confirmRename"
        />
      </span>
      <span v-else class="dm-view-name">{{ deck.name }}</span>
      <div class="dm-view-actions">
        <button class="dm-action-btn" title="Edit this deck" @click="handleEditDeck">
          Edit
        </button>
        <button
          class="dm-action-btn"
          :disabled="!canSave"
          :title="saveTooltip"
          @click="handleSave"
        >
          Save
        </button>
        <button class="dm-action-btn" title="Rename this deck" @click="startRename">
          Rename
        </button>
        <button class="dm-action-btn" title="Create a copy of this deck" @click="handleDuplicate">
          Duplicate
        </button>
        <button class="dm-action-btn" title="Upgrade card variants" @click="showBeautify = true">
          Beautify
        </button>
        <button class="dm-action-btn" title="Generate proxy artwork for cards in this deck" @click="showBatchGenerate = true">
          Generate
        </button>
        <button class="dm-action-btn" title="Open printable proxy sheet" @click="handlePrint">Print</button>
        <button class="dm-action-btn" @click="handleExport">Export</button>
        <button class="dm-action-btn dm-action-btn-danger" title="Delete this deck" @click="showDeleteConfirm = true">
          Delete
        </button>
      </div>
    </div>
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
    />

    <BeautifyDialog
      v-if="showBeautify && deck"
      :deck-id="deck.id"
      :deck-name="deck.name"
      @close="showBeautify = false"
      @updated="handleBeautifyUpdated"
    />

    <BatchGenerateDialog
      v-if="showBatchGenerate && deck"
      :cards="deck.cards"
      @close="showBatchGenerate = false"
    />

    <VariantPicker
      v-if="variantPickerCard && deck"
      :card="variantPickerCard"
      :saved-deck-id="deck.id"
      :saved-deck-cards="deck.cards"
      @close="variantPickerCard = null"
      @open-lightbox="handleVariantPickerLightbox"
      @deck-updated="handleVariantPickerUpdated"
    />

    <PrintDialog
      v-if="showPrintDialog && deck"
      :deck-id="deck.id"
      @close="showPrintDialog = false"
    />

    <ConfirmDialog
      v-if="showDeleteConfirm"
      title="Delete Deck"
      :message="`Are you sure you want to delete &quot;${deck.name}&quot;? This cannot be undone.`"
      confirm-label="Delete"
      @confirm="handleDelete"
      @close="showDeleteConfirm = false"
    />
  </div>
</template>
