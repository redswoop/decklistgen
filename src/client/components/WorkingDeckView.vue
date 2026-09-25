<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import CardGrid from "./CardGrid.vue";
import BeautifyDialog from "./BeautifyDialog.vue";
import BatchGenerateDialog from "./BatchGenerateDialog.vue";
import PrintDialog from "./PrintDialog.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import DeleteDeckDialog from "./DeleteDeckDialog.vue";
import DeckLegalityPill from "./DeckLegalityPill.vue";
import { checkDeckLegality } from "../../shared/utils/deck-legality.js";
import { gridForPaper } from "../../shared/utils/print-grid.js";
import { summarizePrint } from "../../shared/utils/print-summary.js";
import { useDecklist } from "../composables/useDecklist.js";
import { useDecks } from "../composables/useDecks.js";
import { useAuth } from "../composables/useAuth.js";
import { usePrintPlan } from "../composables/usePrintPlan.js";
import { generateCleanImage } from "../composables/usePokeproxy.js";
import { loadPrintOptions } from "../lib/print-options.js";
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
  addCard, removeCard, clear, sweepZeroCount, hasZeroCount,
  currentDeckId, currentDeckName, isDirty,
  toDeckCards, loadSavedDeck,
} = useDecklist();

const { fetchDeck, deleteDeck } = useDecks();
const { isLoggedIn } = useAuth();

/** If an art override is set, return a card with the art card's imageBase for display */
function displayCard(card: Card, artCard?: Card): Card {
  if (!artCard) return card;
  return { ...card, imageBase: artCard.imageBase };
}

// Zero-count items remain in the underlying list so undo can restore them,
// but they shouldn't render in the grid or count toward the unique total.
const visibleItems = computed(() => items.value.filter((i) => i.count > 0));

const deckCards = computed(() =>
  visibleItems.value.map((i) => displayCard(i.card, i.artCard))
);

const cardCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const item of visibleItems.value) {
    counts[item.card.id] = item.count;
  }
  return counts;
});

const legalityIssues = computed(() =>
  checkDeckLegality(visibleItems.value.map((i) => ({ card: i.card, count: i.count })))
);

// --- Print mode -------------------------------------------------------------
// The grid flips into a print plan: tile −/+ edit print counts (capped by the
// deck), group headers become all/none/mixed checkboxes, and the toolbar shows
// the live sheet fit. Deck edits are off until Done. See usePrintPlan.
const printMode = ref(false);
const planEntries = computed(() =>
  visibleItems.value.map((i) => ({ id: i.card.id, deckCount: i.count })),
);
const plan = usePrintPlan(currentDeckId, planEntries);

// Paper/orientation live in the print dialog's stored options; re-read them
// whenever the dialog closes so the bar's sheet estimate tracks the last pick.
const optionsVersion = ref(0);
const printSummary = computed(() => {
  void optionsVersion.value;
  const opts = loadPrintOptions();
  return summarizePrint(plan.total.value, gridForPaper(opts.paper, opts.orientation).cardsPerSheet);
});

const headerLabel = computed(() => {
  if (printMode.value) return `${plan.total.value} of ${totalCards.value} copies to print`;
  return `${visibleItems.value.length} unique · ${totalCards.value}/60 total`;
});

function enterPrintMode() {
  printMode.value = true;
}
function exitPrintMode() {
  showPrintDialog.value = false;
  printMode.value = false;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && printMode.value && !showPrintDialog.value) exitPrintMode();
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

// A deck switch (or clear) ends the mode — the plan is per deck.
watch(currentDeckId, () => { printMode.value = false; });

const showBeautify = ref(false);
const showBatchGenerate = ref(false);
const showPrintDialog = ref(false);
const showSaveBeforePrint = ref(false);
const showSweepConfirm = ref(false);
const showDeleteConfirm = ref(false);

watch(showPrintDialog, (open) => { if (!open) optionsVersion.value++; });

const deleteTooltip = computed(() => {
  if (!isLoggedIn.value) return "Sign in to delete saved decks";
  if (!currentDeckId.value) return "Save the deck first to delete it";
  return "Delete this saved deck";
});

async function handleDelete() {
  if (!currentDeckId.value) return;
  const id = currentDeckId.value;
  showDeleteConfirm.value = false;
  await deleteDeck(id);
  clear();
}

function handleSweep() {
  sweepZeroCount();
  showSweepConfirm.value = false;
}

// --- Card grid handlers ---
// In print mode the tile controls edit the plan, never the deck.
function handleRemoveCard(card: Card) {
  if (printMode.value) {
    plan.decrement(card.id);
    return;
  }
  removeCard(card.setCode, card.localId);
}

function handleAddCard(card: Card) {
  if (printMode.value) {
    plan.increment(card.id);
    return;
  }
  addCard(card);
}

function handleSetGroupCount(cards: Card[], on: boolean) {
  plan.setGroup(cards.map((c) => c.id), on);
}

function handleRegenerate(card: Card) {
  generateCleanImage(card.id, true);
}

function handlePreview(card: Card, cards: Card[]) {
  emit("preview-card", card, cards);
}

// The sheet prints the saved deck, so unsaved changes have to land first.
function handlePrint() {
  if (!currentDeckId.value) return;
  if (isDirty.value) {
    showSaveBeforePrint.value = true;
    return;
  }
  enterPrintMode();
}

async function handleSaveAndPrint() {
  showSaveBeforePrint.value = false;
  emit("save-update");
  // Brief delay to let the save complete before opening print
  await new Promise((r) => setTimeout(r, 300));
  enterPrintMode();
}

function handlePrinted() {
  plan.recordPrinted();
  showPrintDialog.value = false;
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
  <div :class="['dm-view', { 'dm-view-print-mode': printMode }]">
    <!-- Card grid (always rendered so search is available) -->
    <CardGrid
      :cards="deckCards"
      :card-counts="printMode ? plan.counts.value : cardCounts"
      :max-counts="printMode ? cardCounts : undefined"
      :header-label="headerLabel"
      :context="printMode ? 'print' : 'deck'"
      @preview-card="handlePreview"
      @add-card="handleAddCard"
      @remove-card="handleRemoveCard"
      @regenerate-card="handleRegenerate"
      @set-group-count="handleSetGroupCount"
    >
      <template #toolbar>
        <div v-if="printMode" class="dm-view-actions dm-print-bar" data-testid="print-bar">
          <span class="dm-print-mode-tag">Print mode</span>
          <span
            :class="['dm-print-summary', { 'dm-print-summary-warn': printSummary.incomplete }]"
            data-testid="print-bar-summary"
            :title="printSummary.incomplete ? `Last sheet has ${printSummary.emptySlots} empty slots — bump a count to fill it` : 'Sheets at the last-used paper size'"
          >
            {{ printSummary.sheets }} sheet{{ printSummary.sheets === 1 ? '' : 's' }}<template v-if="printSummary.incomplete"> · {{ printSummary.emptySlots }} empty</template>
          </span>
          <button
            class="dm-action-btn"
            :disabled="plan.isFull.value"
            :title="plan.isFull.value ? 'Every card is already at its deck count' : 'Print every copy in the deck'"
            @click="plan.setAll()"
          >All</button>
          <button class="dm-action-btn" title="Print one copy of each card (a proof sheet)" @click="plan.setOneEach()">1 each</button>
          <button
            class="dm-action-btn"
            :disabled="!plan.hasLastPrinted.value"
            :title="plan.hasLastPrinted.value ? 'Print only copies added since the last print of this deck' : 'No previous print of this deck recorded yet'"
            @click="plan.setSinceLastPrint()"
          >Since last print</button>
          <button
            class="dm-action-btn dm-action-btn-primary"
            :disabled="plan.total.value === 0"
            :title="plan.total.value === 0 ? 'Every card is set to 0 copies' : 'Choose paper and open the print sheet'"
            @click="showPrintDialog = true"
          >Print…</button>
          <button class="dm-action-btn" title="Leave print mode (Esc)" @click="exitPrintMode">Done</button>
        </div>
        <div v-else class="dm-view-actions">
          <DeckLegalityPill :issues="legalityIssues" :card-count="totalCards" />
          <button class="dm-action-btn" @click="showBeautify = true" :disabled="items.length === 0">Beautify</button>
          <button class="dm-action-btn" @click="showBatchGenerate = true" :disabled="items.length === 0 || !isLoggedIn" :title="!isLoggedIn ? 'Sign in to generate card images' : undefined">Generate</button>
          <button class="dm-action-btn" :disabled="!currentDeckId" :title="!isLoggedIn ? 'Sign in to save and print decks' : (!currentDeckId ? 'Save the deck first to print' : 'Pick which cards to print')" @click="handlePrint">Print</button>
          <button class="dm-action-btn" @click="emit('import')">Import</button>
          <button class="dm-action-btn" @click="emit('export')" :disabled="items.length === 0">Export</button>
          <button
            class="dm-action-btn"
            @click="showSweepConfirm = true"
            :disabled="!hasZeroCount"
            :title="hasZeroCount ? 'Remove cards with 0 copies from the deck' : 'No cards with 0 copies to sweep'"
          >Sweep</button>
          <button class="dm-action-btn dm-action-btn-danger" @click="clear()" :disabled="items.length === 0">Clear</button>
          <button
            class="dm-action-btn dm-action-btn-danger"
            :disabled="!currentDeckId || !isLoggedIn"
            :title="deleteTooltip"
            @click="showDeleteConfirm = true"
          >Delete</button>
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

    <PrintDialog
      v-if="showPrintDialog && currentDeckId"
      :deck-id="currentDeckId"
      :copies="plan.total.value"
      :counts="plan.encoded.value"
      @close="showPrintDialog = false"
      @printed="handlePrinted"
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

    <ConfirmDialog
      v-if="showSweepConfirm"
      title="Sweep Zero-Count Cards"
      message="Remove all cards with 0 copies from the deck? This can be undone."
      confirm-label="Sweep"
      @confirm="handleSweep"
      @close="showSweepConfirm = false"
    />

    <DeleteDeckDialog
      v-if="showDeleteConfirm && currentDeckId"
      :deck-name="currentDeckName || 'Untitled Deck'"
      @confirm="handleDelete"
      @close="showDeleteConfirm = false"
    />
  </div>
</template>
