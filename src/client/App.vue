<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import FilterSidebar from "./components/FilterSidebar.vue";
import CardGrid from "./components/CardGrid.vue";
import DecklistPanel from "./components/DecklistPanel.vue";
import DeckManagerSidebar from "./components/DeckManagerSidebar.vue";
import DeckView from "./components/DeckView.vue";
import CardsView from "./components/CardsView.vue";
import CardsFilterSidebar from "./components/CardsFilterSidebar.vue";
import ExportDialog from "./components/ExportDialog.vue";
import ImportDialog from "./components/ImportDialog.vue";
import SaveDeckDialog from "./components/SaveDeckDialog.vue";
import CardLightbox from "./components/CardLightbox.vue";
import { useDecklist } from "./composables/useDecklist.js";
import { useDecks } from "./composables/useDecks.js";
import { useRoute } from "./composables/useRoute.js";
import type { Card } from "../shared/types/card.js";
import type { DeckMembership } from "../shared/types/customized-card.js";

// View + deck selection synced to URL hash
const { currentView, selectedDeckId } = useRoute();

// Layout persistence
const LAYOUT_KEY = "decklistgen-layout";

interface LayoutState {
  left: number;
  right: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

const defaults: LayoutState = { left: 15, right: 15, leftCollapsed: false, rightCollapsed: false };

function loadLayout(): LayoutState {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return { ...defaults };
}

function saveLayout(partial: Partial<LayoutState>) {
  const current = loadLayout();
  Object.assign(current, partial);
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(current));
}

const saved = loadLayout();

const { items, toText, currentDeckName, toDeckCards, markSaved, importSource, importedAt } = useDecklist();
const { createDeck } = useDecks();

const showExport = ref(false);
const showImport = ref(false);
const showSaveDeck = ref(false);
const previewCard = ref<Card | null>(null);
const previewSource = ref<'grid' | 'deck'>('grid');
const gridSearchCards = ref<Card[]>([]);
const previewDeckMembership = ref<DeckMembership[] | undefined>(undefined);


const effectiveSearchCards = computed(() => {
  if (previewSource.value === 'deck') {
    return items.value.map(i => i.card);
  }
  return gridSearchCards.value;
});

const leftCollapsed = ref(saved.leftCollapsed);
const rightCollapsed = ref(saved.rightCollapsed);
const leftPct = ref(saved.left);
const rightPct = ref(saved.right);

// --- Drag-to-resize ---
const dragging = ref<'left' | 'right' | null>(null);
let dragStartX = 0;
let dragStartPct = 0;

function startDrag(side: 'left' | 'right', e: MouseEvent) {
  e.preventDefault();
  dragging.value = side;
  dragStartX = e.clientX;
  dragStartPct = side === 'left' ? leftPct.value : rightPct.value;
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

function onDragMove(e: MouseEvent) {
  const container = document.querySelector('.layout') as HTMLElement | null;
  if (!container) return;
  const totalWidth = container.clientWidth;
  const dx = e.clientX - dragStartX;
  const dPct = (dx / totalWidth) * 100;

  if (dragging.value === 'left') {
    leftPct.value = Math.max(10, Math.min(40, dragStartPct + dPct));
  } else {
    rightPct.value = Math.max(10, Math.min(40, dragStartPct - dPct));
  }
}

function onDragEnd() {
  dragging.value = null;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  saveLayout({ left: leftPct.value, right: rightPct.value });
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
});

function collapseLeft() {
  leftCollapsed.value = true;
  saveLayout({ leftCollapsed: true });
}

function collapseRight() {
  rightCollapsed.value = true;
  saveLayout({ rightCollapsed: true });
}

function expandLeft() {
  leftCollapsed.value = false;
  saveLayout({ leftCollapsed: false });
}

function expandRight() {
  rightCollapsed.value = false;
  saveLayout({ rightCollapsed: false });
}

function handlePreview(card: Card, cards: Card[]) {
  previewCard.value = card;
  gridSearchCards.value = cards;
  previewSource.value = 'grid';
  previewDeckMembership.value = undefined;
}

function handleDeckPreview(card: Card) {
  previewCard.value = card;
  previewSource.value = 'deck';
  previewDeckMembership.value = undefined;
}

function handleCardsPreview(card: Card, cards: Card[], membership?: DeckMembership[]) {
  previewCard.value = card;
  gridSearchCards.value = cards;
  previewSource.value = 'grid';
  previewDeckMembership.value = membership;
}

async function handleSaveDeck(name: string) {
  showSaveDeck.value = false;
  const deck = await createDeck({
    name,
    cards: toDeckCards(),
    importedAt: importedAt.value ?? undefined,
    importSource: importSource.value ?? undefined,
  });
  markSaved(deck.id, deck.name);
}

function handleSelectDeck(id: string) {
  selectedDeckId.value = id;
}
</script>

<template>
  <div class="app">
    <!-- Navigation bar -->
    <div class="app-nav">
      <span class="app-nav-title">DecklistGen</span>
      <div class="app-nav-tabs">
        <button
          :class="['app-nav-tab', { active: currentView === 'browse' }]"
          @click="currentView = 'browse'"
        >Browse</button>
        <button
          :class="['app-nav-tab', { active: currentView === 'decks' }]"
          @click="currentView = 'decks'"
        >Decks</button>
        <button
          :class="['app-nav-tab', { active: currentView === 'cards' }]"
          @click="currentView = 'cards'"
        >Cards</button>
      </div>
    </div>

    <!-- Main content area -->
    <div class="app-content">
      <button
        v-if="leftCollapsed"
        class="expand-btn expand-btn-left"
        @click="expandLeft"
      >&raquo;</button>
      <button
        v-if="rightCollapsed"
        class="expand-btn expand-btn-right"
        @click="expandRight"
      >&laquo;</button>

      <div class="layout" :class="{ 'is-dragging': dragging }">
        <!-- Left pane -->
        <div v-if="!leftCollapsed" class="layout-pane layout-side" :style="{ width: leftPct + '%' }">
          <FilterSidebar v-if="currentView === 'browse'" @collapse="collapseLeft" />
          <CardsFilterSidebar
            v-else-if="currentView === 'cards'"
            @collapse="collapseLeft"
          />
          <DeckManagerSidebar
            v-else
            :selected-deck-id="selectedDeckId"
            @select-deck="handleSelectDeck"
            @collapse="collapseLeft"
            @import="showImport = true"
          />
        </div>

        <!-- Left divider -->
        <div
          v-if="!leftCollapsed"
          class="layout-divider"
          @mousedown="startDrag('left', $event)"
        />

        <!-- Center pane — always flex:1, absorbs all freed space -->
        <div class="layout-pane layout-center">
          <CardGrid v-if="currentView === 'browse'" @preview-card="handlePreview" />
          <CardsView
            v-else-if="currentView === 'cards'"
            @preview-card="handleCardsPreview"
          />
          <DeckView
            v-else
            :deck-id="selectedDeckId"
            @preview-card="handlePreview"
            @export="showExport = true"
          />
        </div>

        <!-- Right divider -->
        <div
          v-if="!rightCollapsed"
          class="layout-divider"
          @mousedown="startDrag('right', $event)"
        />

        <!-- Right pane -->
        <div v-if="!rightCollapsed" class="layout-pane layout-side" :style="{ width: rightPct + '%' }">
          <DecklistPanel
            @collapse="collapseRight"
            @export="showExport = true"
            @import="showImport = true"
            @save="showSaveDeck = true"
            @preview-card="handleDeckPreview"
          />
        </div>
      </div>
    </div>

    <!-- Dialogs -->
    <ImportDialog
      v-if="showImport"
      @close="showImport = false"
    />
    <ExportDialog
      v-if="showExport"
      :text="toText()"
      @close="showExport = false"
    />
    <SaveDeckDialog
      v-if="showSaveDeck"
      :initial-name="currentDeckName || ''"
      @save="handleSaveDeck"
      @close="showSaveDeck = false"
    />
    <CardLightbox
      v-if="previewCard"
      :card="previewCard"
      :search-cards="effectiveSearchCards"
      :source="previewSource"
      :deck-membership="previewDeckMembership"
      @close="previewCard = null"
    />
  </div>
</template>
