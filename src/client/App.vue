<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import InlineFilterBar from "./components/InlineFilterBar.vue";
import CardGrid from "./components/CardGrid.vue";
import DeckContextPanel from "./components/DeckContextPanel.vue";
import DeckContextBar from "./components/DeckContextBar.vue";
import DeckGalleryView from "./components/DeckGalleryView.vue";
import WorkingDeckView from "./components/WorkingDeckView.vue";
import CardsView from "./components/CardsView.vue";
import CardsFilterSidebar from "./components/CardsFilterSidebar.vue";
import PublicDecksView from "./components/PublicDecksView.vue";
import QueueView from "./components/QueueView.vue";
import EditorView from "./components/editor/EditorView.vue";
import GalleryView from "./components/GalleryView.vue";
import VariantsView from "./components/VariantsView.vue";
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
import { generateCleanImage } from "./composables/usePokeproxy.js";
import type { Card } from "../shared/types/card.js";
import type { DeckCard } from "../shared/types/deck.js";
import type { DeckMembership } from "../shared/types/customized-card.js";

const { isLoggedIn, loading: authLoading, checkAuth, isAdmin } = useAuth();
const { activeJobCount } = useQueueBadge();
const { restoreFromUrl } = useEraLoader();

// View synced to URL hash, card param for lightbox deep-links
const { currentView, previewCardId } = useRoute();

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

const { items, totalCards, toText, currentDeckName, currentDeckId, isDirty, toDeckCards, markSaved, importSource, importedAt, undo, redo } = useDecklist();
const { createDeck, updateDeck } = useDecks();

// Deck sub-view: gallery (home) vs build (working deck)
const deckSubView = ref<'gallery' | 'build'>(currentDeckId.value ? 'build' : 'gallery');

const showExport = ref(false);
const showImport = ref(false);
const showSaveDeck = ref(false);
const previewCard = ref<Card | null>(null);
const previewSource = ref<'grid' | 'deck'>('grid');
const gridSearchCards = ref<Card[]>([]);
const previewDeckMembership = ref<DeckMembership[] | undefined>(undefined);
const previewDeckName = ref<string | undefined>(undefined);
const previewSavedDeckId = ref<string | undefined>(undefined);
const previewSavedDeckCards = ref<DeckCard[] | undefined>(undefined);

// Close mobile panels on tab switch
watch(currentView, () => {
  if (isMobile.value) {
    mobileLeftOpen.value = false;
    mobileRightOpen.value = false;
  }
});


const effectiveSearchCards = computed(() => {
  if (previewSource.value === 'deck') {
    return items.value.map(i => i.card);
  }
  return gridSearchCards.value;
});

const isMobile = useIsMobile();
const mobileLeftOpen = ref(false);
const mobileRightOpen = ref(false);

const leftPanelLabel = computed(() => 'Filters');
const rightPanelLabel = computed(() => currentView.value === 'browse' ? 'Deck' : 'Filters');

// Lock body scroll when a mobile panel is open
watch([mobileLeftOpen, mobileRightOpen], ([left, right]) => {
  document.body.style.overflow = (left || right) ? 'hidden' : '';
});

// Views that take the full center pane (no sidebars)
const fullWidthView = computed(() =>
  currentView.value === 'queue' || currentView.value === 'public' ||
  currentView.value === 'editor' || currentView.value === 'gallery' ||
  currentView.value === 'variants'
);

// Is the Deck tab showing the gallery? (full width, no sidebars)
const isDeckGallery = computed(() => currentView.value === 'build' && deckSubView.value === 'gallery');

// Left sidebar: only 'cards' view has one (CardsFilterSidebar)
const savedLeftCollapsed = ref(saved.leftCollapsed);
const savedRightCollapsed = ref(saved.rightCollapsed);
const leftCollapsed = computed(() =>
  isMobile.value || savedLeftCollapsed.value || currentView.value !== 'cards'
);
// Right sidebar: only 'browse' view has one (DeckContextPanel)
const rightCollapsed = computed(() =>
  isMobile.value || savedRightCollapsed.value || currentView.value !== 'browse'
);
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
  document.removeEventListener('keydown', handleUndoRedo);
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
  previewDeckName.value = undefined;
  previewSavedDeckId.value = undefined;
  previewSavedDeckCards.value = undefined;
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

function handleUndoRedo(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    undo();
  } else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
    e.preventDefault();
    redo();
  }
}

// Check auth + deep-link hydration on mount
onMounted(async () => {
  document.addEventListener('keydown', handleUndoRedo);
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

async function handleWorkingSaveUpdate() {
  if (!currentDeckId.value || !isDirty.value) return;
  try {
    await updateDeck({
      id: currentDeckId.value,
      data: {
        name: currentDeckName.value,
        cards: toDeckCards(),
      },
    });
    markSaved(currentDeckId.value, currentDeckName.value);
  } catch (e) {
    console.error("Save failed:", e);
  }
}

function handleDeckUpdated() {
  // Placeholder for future lightbox card-replace refresh
}

function handleBrowseRegenerate(card: Card) {
  generateCleanImage(card.id, true);
}

// --- Deck gallery navigation ---
function handleGalleryOpenDeck(_id: string) {
  deckSubView.value = 'build';
}

function handleGalleryNewDeck() {
  deckSubView.value = 'build';
}

function handleGoToGallery() {
  deckSubView.value = 'gallery';
  currentView.value = 'build';
}

function handleDeckTabClick() {
  currentView.value = 'build';
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
      <div class="app-nav-tabs">
        <button
          :class="['app-nav-tab', { active: currentView === 'build' }]"
          @click="handleDeckTabClick"
        >Deck</button>
        <button
          :class="['app-nav-tab', { active: currentView === 'browse' }]"
          @click="currentView = 'browse'"
        >Browse</button>
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
        <button
          :class="['app-nav-tab', { active: currentView === 'editor' }]"
          @click="currentView = 'editor'"
        >Editor</button>
        <button
          :class="['app-nav-tab', { active: currentView === 'gallery' }]"
          @click="currentView = 'gallery'"
        >Gallery</button>
        <button
          :class="['app-nav-tab', { active: currentView === 'variants' }]"
          @click="currentView = 'variants'"
        >Variants</button>
      </div>
      <div class="app-nav-spacer" />
      <button
        v-if="isMobile && currentView === 'cards'"
        :class="['mobile-action-btn', { active: mobileLeftOpen }]"
        @click="toggleMobileLeft"
      >
        <span class="mobile-action-icon">&#9881;</span>
        <span>{{ leftPanelLabel }}</span>
      </button>
      <button
        v-if="isMobile && currentView === 'browse'"
        :class="['mobile-action-btn', { active: mobileRightOpen }]"
        @click="toggleMobileRight"
      >
        <span class="mobile-action-icon">&#9776;</span>
        <span>{{ rightPanelLabel }}</span>
      </button>
      <UserMenu @open-admin="showAdmin = true" />
    </div>

    <!-- Deck context bar (visible when not on gallery sub-view) -->
    <div v-if="!isDeckGallery" class="dcb-wrapper">
      <DeckContextBar
        @save="showSaveDeck = true"
        @save-update="handleWorkingSaveUpdate"
        @import="showImport = true"
        @go-to-gallery="handleGoToGallery"
      />
    </div>

    <!-- Main content area -->
    <div class="app-content">
      <button
        v-if="leftCollapsed && !isMobile && currentView === 'cards'"
        class="expand-btn expand-btn-left"
        @click="expandLeft"
      >&raquo;</button>
      <button
        v-if="rightCollapsed && !isMobile && currentView === 'browse'"
        class="expand-btn expand-btn-right"
        @click="expandRight"
      >&laquo;</button>

      <div class="layout" :class="{ 'is-dragging': dragging }">
        <!-- Left pane: filters on cards view only -->
        <div v-if="!leftCollapsed" class="layout-pane layout-side" :style="{ width: leftPct + '%' }">
          <CardsFilterSidebar
            v-if="currentView === 'cards'"
            @collapse="collapseLeft"
          />
        </div>

        <!-- Left divider -->
        <div
          v-if="!leftCollapsed"
          class="layout-divider"
          @mousedown="startDrag('left', $event)"
        />

        <!-- Center pane -->
        <div class="layout-pane layout-center">
          <!-- Browse: inline filter bar + card grid -->
          <div v-if="currentView === 'browse'" class="browse-center">
            <InlineFilterBar />
            <CardGrid context="browse" @preview-card="handlePreview" @regenerate-card="handleBrowseRegenerate" />
          </div>

          <CardsView
            v-else-if="currentView === 'cards'"
            @preview-card="handleCardsPreview"
          />
          <PublicDecksView v-else-if="currentView === 'public'" />
          <QueueView v-else-if="currentView === 'queue'" />
          <EditorView v-else-if="currentView === 'editor'" />
          <GalleryView v-else-if="currentView === 'gallery'" />
          <VariantsView v-else-if="currentView === 'variants'" @preview-card="handlePreview" />

          <!-- Deck tab: gallery or build -->
          <DeckGalleryView
            v-else-if="isDeckGallery"
            @open-deck="handleGalleryOpenDeck"
            @new-deck="handleGalleryNewDeck"
            @import="showImport = true"
          />
          <WorkingDeckView
            v-else
            @preview-card="handlePreview"
            @export="showExport = true"
            @import="showImport = true"
            @save="showSaveDeck = true"
            @save-update="handleWorkingSaveUpdate"
          />
        </div>

        <!-- Right divider -->
        <div
          v-if="!rightCollapsed"
          class="layout-divider"
          @mousedown="startDrag('right', $event)"
        />

        <!-- Right pane: DeckContextPanel in browse mode -->
        <div v-if="!rightCollapsed" class="layout-pane layout-side" :style="{ width: rightPct + '%' }">
          <DeckContextPanel
            v-if="currentView === 'browse'"
            @collapse="collapseRight"
            @preview-card="handleDeckPreview"
            @go-to-gallery="handleGoToGallery"
          />
        </div>
      </div>
    </div>

    <!-- Mobile bottom tab bar -->
    <nav v-if="isMobile" class="mobile-tab-bar">
      <button :class="['mobile-tab', { active: currentView === 'build' }]"
        @click="handleDeckTabClick">Deck</button>
      <button :class="['mobile-tab', { active: currentView === 'browse' }]"
        @click="currentView = 'browse'">Browse</button>
      <button :class="['mobile-tab', { active: currentView === 'cards' }]"
        @click="currentView = 'cards'">Cards</button>
      <button :class="['mobile-tab', { active: currentView === 'public' }]"
        @click="currentView = 'public'">Public</button>
      <button :class="['mobile-tab', { active: currentView === 'queue' }]"
        @click="currentView = 'queue'">Queue<span v-if="activeJobCount > 0" class="nav-badge mobile-nav-badge">{{ activeJobCount }}</span></button>
      <button :class="['mobile-tab', { active: currentView === 'editor' }]"
        @click="currentView = 'editor'">Editor</button>
      <button :class="['mobile-tab', { active: currentView === 'gallery' }]"
        @click="currentView = 'gallery'">Gallery</button>
      <button :class="['mobile-tab', { active: currentView === 'variants' }]"
        @click="currentView = 'variants'">Variants</button>
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
          <CardsFilterSidebar v-if="currentView === 'cards'" @collapse="mobileLeftOpen = false" />
        </div>
      </Transition>
      <Transition name="slide-up">
        <div v-if="isMobile && mobileRightOpen" class="mobile-panel mobile-panel-bottom">
          <DeckContextPanel
            v-if="currentView === 'browse'"
            @collapse="mobileRightOpen = false"
            @preview-card="handleDeckPreview"
            @go-to-gallery="handleGoToGallery"
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
