<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import FilterSidebar from "./components/FilterSidebar.vue";
import CardGrid from "./components/CardGrid.vue";
import DecklistPanel from "./components/DecklistPanel.vue";
import DeckManagerSidebar from "./components/DeckManagerSidebar.vue";
import DeckView from "./components/DeckView.vue";
import CardsView from "./components/CardsView.vue";
import CardsFilterSidebar from "./components/CardsFilterSidebar.vue";
import PublicDecksView from "./components/PublicDecksView.vue";
import QueueView from "./components/QueueView.vue";
import ExportDialog from "./components/ExportDialog.vue";
import ImportDialog from "./components/ImportDialog.vue";
import SaveDeckDialog from "./components/SaveDeckDialog.vue";
import CardLightbox from "./components/CardLightbox.vue";
import AuthPage from "./components/AuthPage.vue";
import UserMenu from "./components/UserMenu.vue";
import AdminPanel from "./components/AdminPanel.vue";
import ToastContainer from "./components/ToastContainer.vue";
import { useDecklist } from "./composables/useDecklist.js";
import { useDecks } from "./composables/useDecks.js";
import { useAuth } from "./composables/useAuth.js";
import { useRoute, setCardParam } from "./composables/useRoute.js";
import { useIsMobile } from "./composables/useIsMobile.js";
import { useEraLoader } from "./composables/useEraLoader.js";
import { api } from "./lib/client.js";
import { useQueue, useQueueBadge } from "./composables/useQueue.js";
import type { Card } from "../shared/types/card.js";
import type { DeckCard } from "../shared/types/deck.js";
import type { DeckMembership } from "../shared/types/customized-card.js";

const { isLoggedIn, loading: authLoading, checkAuth, isAdmin } = useAuth();
const { activeJobCount } = useQueueBadge();
const { restoreFromUrl } = useEraLoader();

// View + deck selection synced to URL hash, card param for lightbox deep-links
const { currentView, selectedDeckId, previewCardId } = useRoute();

// Instantiate queue polling at app level so completion detection works
// even when the queue tab isn't visible (fixes single-card generation bug)
const queueIsActive = computed(() => currentView.value === 'queue');
useQueue(queueIsActive);
const showAdmin = ref(false);

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

const { items, totalCards, toText, currentDeckName, toDeckCards, markSaved, importSource, importedAt } = useDecklist();
const { createDeck } = useDecks();

const showExport = ref(false);
const showImport = ref(false);
const showSaveDeck = ref(false);
const previewCard = ref<Card | null>(null);
const previewSource = ref<'grid' | 'deck'>('grid');
const gridSearchCards = ref<Card[]>([]);
const previewDeckMembership = ref<DeckMembership[] | undefined>(undefined);
const viewedDeckName = ref<string | null>(null);
const previewDeckName = ref<string | undefined>(undefined);
const previewSavedDeckId = ref<string | undefined>(undefined);
const previewSavedDeckCards = ref<DeckCard[] | undefined>(undefined);
const viewedDeckCards = ref<DeckCard[]>([]);

// Clear deck name when leaving decks view; close mobile panels on tab switch
watch(currentView, (v) => {
  if (v !== 'decks') viewedDeckName.value = null;
  if (isMobile.value) {
    mobileLeftOpen.value = false;
    mobileRightOpen.value = false;
  }
});

function handleDeckLoaded(name: string | null, cards?: DeckCard[]) {
  viewedDeckName.value = name;
  viewedDeckCards.value = cards ?? [];
  // Keep lightbox in sync if it's open with this deck
  if (previewSavedDeckId.value && currentView.value === 'decks') {
    previewSavedDeckCards.value = cards ?? [];
  }
}


const effectiveSearchCards = computed(() => {
  if (previewSource.value === 'deck') {
    return items.value.map(i => i.card);
  }
  return gridSearchCards.value;
});

const isMobile = useIsMobile();
const mobileLeftOpen = ref(false);
const mobileRightOpen = ref(false);

const leftPanelLabel = computed(() => {
  if (currentView.value === 'browse' || currentView.value === 'cards') return 'Filters';
  return 'Manage';
});

// Lock body scroll when a mobile panel is open
watch([mobileLeftOpen, mobileRightOpen], ([left, right]) => {
  document.body.style.overflow = (left || right) ? 'hidden' : '';
});

// Views that take the full center pane (no sidebars)
const fullWidthView = computed(() => currentView.value === 'queue' || currentView.value === 'public');

// Desktop collapsed state persisted to localStorage; on mobile, sidebars are always collapsed
const savedLeftCollapsed = ref(saved.leftCollapsed);
const savedRightCollapsed = ref(saved.rightCollapsed);
const leftCollapsed = computed(() => isMobile.value || savedLeftCollapsed.value || fullWidthView.value);
const rightCollapsed = computed(() => isMobile.value || savedRightCollapsed.value || fullWidthView.value);
const leftPct = ref(saved.left);
const rightPct = ref(saved.right);

// --- Drag-to-resize ---
const dragging = ref<'left' | 'right' | null>(null);
let dragStartX = 0;
let dragStartPct = 0;

function startDrag(side: 'left' | 'right', e: MouseEvent) {
  if (isMobile.value) return;
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
  if (isMobile.value) { mobileLeftOpen.value = false; return; }
  savedLeftCollapsed.value = true;
  saveLayout({ leftCollapsed: true });
}

function collapseRight() {
  if (isMobile.value) { mobileRightOpen.value = false; return; }
  savedRightCollapsed.value = true;
  saveLayout({ rightCollapsed: true });
}

function expandLeft() {
  savedLeftCollapsed.value = false;
  saveLayout({ leftCollapsed: false });
}

function expandRight() {
  savedRightCollapsed.value = false;
  saveLayout({ rightCollapsed: false });
}

function toggleMobileLeft() {
  mobileRightOpen.value = false;
  mobileLeftOpen.value = !mobileLeftOpen.value;
}

function toggleMobileRight() {
  mobileLeftOpen.value = false;
  mobileRightOpen.value = !mobileRightOpen.value;
}

function handlePreview(card: Card, cards: Card[]) {
  previewCard.value = card;
  gridSearchCards.value = cards;
  previewSource.value = 'grid';
  previewDeckMembership.value = undefined;
  const inDecksView = currentView.value === 'decks';
  previewDeckName.value = inDecksView ? (viewedDeckName.value ?? undefined) : undefined;
  previewSavedDeckId.value = inDecksView ? (selectedDeckId.value ?? undefined) : undefined;
  previewSavedDeckCards.value = inDecksView ? viewedDeckCards.value : undefined;
  setCardParam(card.id);
}

function handleDeckPreview(card: Card) {
  previewCard.value = card;
  previewSource.value = 'deck';
  previewDeckMembership.value = undefined;
  previewDeckName.value = currentDeckName.value || undefined;
  previewSavedDeckId.value = undefined;
  previewSavedDeckCards.value = undefined;
  setCardParam(card.id);
}

function handleCardsPreview(card: Card, cards: Card[], membership?: DeckMembership[]) {
  previewCard.value = card;
  gridSearchCards.value = cards;
  previewSource.value = 'grid';
  previewDeckMembership.value = membership;
  setCardParam(card.id);
}

function closeLightbox() {
  previewCard.value = null;
  setCardParam(null);
}

function handleCardChange(cardId: string) {
  setCardParam(cardId, true); // replaceState — don't pollute back stack
}

// React to back/forward changing the card param
watch(previewCardId, async (id) => {
  if (!id) {
    // Back button closed the lightbox
    previewCard.value = null;
    return;
  }
  // Forward button or popstate re-opened — only fetch if lightbox isn't showing this card
  if (!previewCard.value || previewCard.value.id !== id) {
    try {
      const card = await api.getCard(id);
      previewCard.value = card;
      gridSearchCards.value = [card];
      previewSource.value = 'grid';
      previewDeckMembership.value = undefined;
    } catch {
      // Card not found — clear param
      setCardParam(null, true);
    }
  }
});

// Check auth + deep-link hydration on mount
onMounted(async () => {
  await checkAuth();
  // Restore era/set data from URL params — must happen here (not in FilterSidebar)
  // because on mobile the sidebar doesn't mount until the user opens the panel
  restoreFromUrl();
  if (previewCardId.value && !previewCard.value) {
    try {
      const card = await api.getCard(previewCardId.value);
      previewCard.value = card;
      gridSearchCards.value = [card];
      previewSource.value = 'grid';
    } catch {
      setCardParam(null, true);
    }
  }
});

async function handleSaveDeck(name: string) {
  showSaveDeck.value = false;
  try {
    const deck = await createDeck({
      name,
      cards: toDeckCards(),
      importedAt: importedAt.value ?? undefined,
      importSource: importSource.value ?? undefined,
    });
    markSaved(deck.id, deck.name);
  } catch (e) {
    console.error("Save deck failed:", e);
  }
}

function handleSelectDeck(id: string) {
  selectedDeckId.value = id;
  if (isMobile.value) mobileLeftOpen.value = false;
}

// Ref to DeckView for triggering refresh after lightbox replaces a card
const deckViewRef = ref<InstanceType<typeof DeckView> | null>(null);

function handleDeckUpdated() {
  // Trigger DeckView to re-fetch the deck
  deckViewRef.value?.refresh();
}
</script>

<template>
  <!-- Loading state -->
  <div v-if="authLoading" class="app auth-loading">
    <div class="auth-loading-text">Loading...</div>
  </div>

  <!-- Auth gate -->
  <AuthPage v-else-if="!isLoggedIn" />

  <!-- Main app -->
  <div v-else class="app">
    <!-- Navigation bar -->
    <div class="app-nav">
      <span class="app-nav-title">DecklistGen</span>
      <template v-if="currentView === 'decks' && viewedDeckName">
        <span class="app-nav-separator">&rsaquo;</span>
        <span class="app-nav-deck-name">{{ viewedDeckName }}</span>
      </template>
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
        <button
          :class="['app-nav-tab', { active: currentView === 'public' }]"
          @click="currentView = 'public'"
        >Public</button>
        <button
          :class="['app-nav-tab', { active: currentView === 'queue' }]"
          @click="currentView = 'queue'"
        >Queue<span v-if="activeJobCount > 0" class="nav-badge">{{ activeJobCount }}</span></button>
      </div>
      <div class="app-nav-spacer" />
      <button
        v-if="isMobile"
        :class="['mobile-action-btn', { active: mobileLeftOpen }]"
        @click="toggleMobileLeft"
      >
        <span class="mobile-action-icon">&#9881;</span>
        <span>{{ leftPanelLabel }}</span>
      </button>
      <button
        v-if="isMobile"
        :class="['mobile-action-btn', { active: mobileRightOpen }]"
        @click="toggleMobileRight"
      >
        <span class="mobile-action-icon">&#9776;</span>
        <span>Deck</span>
        <span v-if="totalCards > 0" class="mobile-deck-badge">{{ totalCards }}</span>
      </button>
      <UserMenu @open-admin="showAdmin = true" />
    </div>

    <!-- Main content area -->
    <div class="app-content">
      <button
        v-if="leftCollapsed && !isMobile"
        class="expand-btn expand-btn-left"
        @click="expandLeft"
      >&raquo;</button>
      <button
        v-if="rightCollapsed && !isMobile"
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
          <PublicDecksView v-else-if="currentView === 'public'" />
          <QueueView v-else-if="currentView === 'queue'" />
          <DeckView
            v-else
            ref="deckViewRef"
            :deck-id="selectedDeckId"
            @preview-card="handlePreview"
            @export="showExport = true"
            @deck-loaded="handleDeckLoaded"
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

    <!-- Mobile bottom tab bar -->
    <nav v-if="isMobile" class="mobile-tab-bar">
      <button :class="['mobile-tab', { active: currentView === 'browse' }]"
        @click="currentView = 'browse'">Browse</button>
      <button :class="['mobile-tab', { active: currentView === 'decks' }]"
        @click="currentView = 'decks'">Decks</button>
      <button :class="['mobile-tab', { active: currentView === 'cards' }]"
        @click="currentView = 'cards'">Cards</button>
      <button :class="['mobile-tab', { active: currentView === 'public' }]"
        @click="currentView = 'public'">Public</button>
      <button :class="['mobile-tab', { active: currentView === 'queue' }]"
        @click="currentView = 'queue'">Queue<span v-if="activeJobCount > 0" class="nav-badge mobile-nav-badge">{{ activeJobCount }}</span></button>
    </nav>

    <!-- Mobile slide-over panels -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="isMobile && (mobileLeftOpen || mobileRightOpen)"
          class="mobile-backdrop"
          @click="mobileLeftOpen = false; mobileRightOpen = false"
        />
      </Transition>
      <Transition name="slide-down">
        <div v-if="isMobile && mobileLeftOpen" class="mobile-panel mobile-panel-top">
          <FilterSidebar v-if="currentView === 'browse'" @collapse="mobileLeftOpen = false" />
          <CardsFilterSidebar v-else-if="currentView === 'cards'" @collapse="mobileLeftOpen = false" />
          <DeckManagerSidebar
            v-else
            :selected-deck-id="selectedDeckId"
            @select-deck="handleSelectDeck"
            @collapse="mobileLeftOpen = false"
            @import="showImport = true"
          />
        </div>
      </Transition>
      <Transition name="slide-up">
        <div v-if="isMobile && mobileRightOpen" class="mobile-panel mobile-panel-bottom">
          <DecklistPanel
            @collapse="mobileRightOpen = false"
            @export="showExport = true"
            @import="showImport = true"
            @save="showSaveDeck = true"
            @preview-card="handleDeckPreview"
          />
        </div>
      </Transition>
    </Teleport>

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
    <AdminPanel
      v-if="showAdmin && isAdmin"
      @close="showAdmin = false"
    />
    <ToastContainer />
    <CardLightbox
      v-if="previewCard"
      :card="previewCard"
      :search-cards="effectiveSearchCards"
      :source="previewSource"
      :deck-membership="previewDeckMembership"
      :deck-name="previewDeckName"
      :saved-deck-id="previewSavedDeckId"
      :saved-deck-cards="previewSavedDeckCards"
      @close="closeLightbox"
      @card-change="handleCardChange"
      @deck-updated="handleDeckUpdated"
    />
  </div>
</template>
