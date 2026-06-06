<script setup lang="ts">
// Root controller. Owns routing (view tabs + deck sub-view), the global dialogs
// and auth gate, and composes the app-shell behaviours:
//   useLayoutControl — sidebar widths/collapse + mobile slide-overs
//   useCardPreview   — lightbox preview state machine + deep-link sync
//   useBrowseGenerate— browse multi-select + bulk generate
//   useUndoRedo      — global Cmd/Ctrl-Z shortcuts
import { ref, computed, watch, onMounted } from "vue";
import InlineFilterBar from "./components/InlineFilterBar.vue";
import CardGrid from "./components/CardGrid.vue";
import DeckContextPanel from "./components/DeckContextPanel.vue";
import DeckContextBar from "./components/DeckContextBar.vue";
import DeckGalleryView from "./components/DeckGalleryView.vue";
import WorkingDeckView from "./components/WorkingDeckView.vue";
import TestHandPanel from "./components/TestHandPanel.vue";
import SetupSimPanel from "./components/SetupSimPanel.vue";
import CardsView from "./components/CardsView.vue";
import CardsFilterSidebar from "./components/CardsFilterSidebar.vue";
import PublicDecksView from "./components/PublicDecksView.vue";
import QueueView from "./components/QueueView.vue";
import GalleryView from "./components/GalleryView.vue";
import VariantsView from "./components/VariantsView.vue";
import ExportDialog from "./components/ExportDialog.vue";
import ImportDialog from "./components/ImportDialog.vue";
import SaveDeckDialog from "./components/SaveDeckDialog.vue";
import CardLightbox from "./components/CardLightbox.vue";
import BrowseGenerateButton from "./components/BrowseGenerateButton.vue";
import BrowseGenerateDialog from "./components/BrowseGenerateDialog.vue";
import AuthPage from "./components/AuthPage.vue";
import UserMenu from "./components/UserMenu.vue";
import ActingAsBanner from "./components/ActingAsBanner.vue";
import AdminPanel from "./components/AdminPanel.vue";
import ToastContainer from "./components/ToastContainer.vue";
import { useDecklist } from "./composables/useDecklist.js";
import { useDecks } from "./composables/useDecks.js";
import { useAuth } from "./composables/useAuth.js";
import { useActingAs } from "./composables/useActingAs.js";
import { useAuthDialog } from "./composables/useAuthDialog.js";
import { useRoute } from "./composables/useRoute.js";
import { useIsMobile } from "./composables/useIsMobile.js";
import { useEraLoader } from "./composables/useEraLoader.js";
import { useQueue, useQueueBadge } from "./composables/useQueue.js";
import { generateCleanImage } from "./composables/usePokeproxy.js";
import { useLayoutControl } from "./composables/useLayoutControl.js";
import { useBrowseGenerate } from "./composables/useBrowseGenerate.js";
import { useCardPreview } from "./composables/useCardPreview.js";
import { useUndoRedo } from "./composables/useUndoRedo.js";
import type { Card } from "../shared/types/card.js";

const { isLoggedIn, loading: authLoading, checkAuth, isAdmin, needsSetup } = useAuth();
const { isActingAs } = useActingAs();
const { activeJobCount } = useQueueBadge();
const { loadAllEras } = useEraLoader();
const { showAuthDialog } = useAuthDialog();

// View synced to URL hash, card param for lightbox deep-links
const { currentView, previewCardId } = useRoute();

// Instantiate queue polling at app level so completion detection works
// even when the queue tab isn't visible (fixes single-card generation bug)
const queueIsActive = computed(() => currentView.value === 'queue');
useQueue(queueIsActive);
const showAdmin = ref(false);

const { items, totalCards, toText, currentDeckName, currentDeckId, isDirty, toDeckCards, markSaved, importSource, importedAt, undo, redo } = useDecklist();
const { createDeck, updateDeck } = useDecks();

const isMobile = useIsMobile();

// Deck sub-view: gallery (home) vs build (working deck) vs test (hand simulator) vs setup (setup simulator)
const deckSubView = ref<'gallery' | 'build' | 'test' | 'setup'>(currentDeckId.value ? 'build' : 'gallery');

const showExport = ref(false);
const showImport = ref(false);
const showSaveDeck = ref(false);

// Browse multi-select + bulk generate.
const browseGridRef = ref<InstanceType<typeof CardGrid> | null>(null);
function getBrowseVisibleCards(): Card[] {
  const exposed = browseGridRef.value as unknown as { visibleCards?: Card[] } | null;
  return exposed?.visibleCards ?? [];
}
const {
  browseSelectedIds, showBrowseGenerate, browseGenerating,
  toggleBrowseSelect, browseVisibleCount, browseActualCount, browseEffectiveCount,
  openBrowseGenerate, handleBrowseGenerate,
} = useBrowseGenerate(isAdmin, getBrowseVisibleCards);

// App-shell layout (sidebar widths/collapse + mobile slide-overs).
const {
  mobileLeftOpen, mobileRightOpen, leftPanelLabel, rightPanelLabel,
  leftCollapsed, rightCollapsed, leftPct, rightPct, dragging,
  startDrag, collapseLeft, collapseRight, expandLeft, expandRight,
  toggleMobileLeft, toggleMobileRight,
} = useLayoutControl(currentView, isMobile);

// Lightbox preview state machine + deep-link sync.
const {
  previewCard, previewSource, previewDeckMembership, previewDeckName,
  previewSavedDeckId, previewSavedDeckCards, effectiveSearchCards,
  handlePreview, handleDeckPreview, handleCardsPreview, closeLightbox, handleCardChange,
  hydrate: hydratePreview,
} = useCardPreview({ previewCardId, deckItems: items, currentDeckName });

// Global undo/redo shortcuts.
useUndoRedo(undo, redo);

// Is the Deck tab showing the gallery? (full width, no sidebars)
const isDeckGallery = computed(() => currentView.value === 'build' && deckSubView.value === 'gallery');

// Redirect anonymous users away from auth-required views
watch([currentView, isLoggedIn], ([view, loggedIn]) => {
  if (!loggedIn && authRequiredTabs.has(view)) {
    currentView.value = 'browse';
  }
});

// Check auth + deep-link hydration on mount
onMounted(async () => {
  await checkAuth();
  // Eager-load every era so the in-memory card index is complete by the time
  // variant lookups (and any cross-era reprints) are queried. Fast no-op on a
  // warm server because loadSet is idempotent.
  loadAllEras();
  await hydratePreview();
});

async function handleSaveDeck(name: string) {
  if (!isLoggedIn.value) { showAuthDialog.value = true; return; }
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
  if (!isLoggedIn.value || !currentDeckId.value || !isDirty.value) return;
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

// Tabs that require authentication
const authRequiredTabs = new Set(['queue', 'editor']);

function handleTabClick(tab: string) {
  if (authRequiredTabs.has(tab) && !isLoggedIn.value) {
    showAuthDialog.value = true;
    return;
  }
  currentView.value = tab as typeof currentView.value;
}
</script>

<template>
  <!-- Loading state -->
  <div v-if="authLoading" class="app auth-loading">
    <div class="auth-loading-text">Loading...</div>
  </div>

  <!-- First-time setup: full-page gate -->
  <AuthPage v-else-if="needsSetup" />

  <!-- Main app (accessible to everyone) -->
  <div v-else class="app">
    <!-- Navigation bar -->
    <div class="app-nav">
      <span class="app-nav-title">DecklistGen</span>
      <div class="app-nav-tabs">
        <button
          :class="['app-nav-tab', { active: currentView === 'build' }]"
          @click="handleTabClick('build')"
        >Deck</button>
        <button
          :class="['app-nav-tab', { active: currentView === 'browse' }]"
          @click="handleTabClick('browse')"
        >Browse</button>
        <button
          :class="['app-nav-tab', { active: currentView === 'cards' }]"
          @click="handleTabClick('cards')"
        >Cards</button>
        <button
          :class="['app-nav-tab', { active: currentView === 'public' }]"
          @click="handleTabClick('public')"
        >Public</button>
        <button
          :class="['app-nav-tab', { active: currentView === 'queue', 'requires-auth': !isLoggedIn }]"
          :title="!isLoggedIn ? 'Sign in to view generation queue' : undefined"
          @click="handleTabClick('queue')"
        >Queue<span v-if="activeJobCount > 0" class="nav-badge">{{ activeJobCount }}</span></button>
        <button
          :class="['app-nav-tab', { active: currentView === 'gallery' }]"
          @click="handleTabClick('gallery')"
        >Gallery</button>
        <button
          :class="['app-nav-tab', { active: currentView === 'variants' }]"
          @click="handleTabClick('variants')"
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
      <button v-if="!isLoggedIn" class="sign-in-btn" @click="showAuthDialog = true">Sign In</button>
      <UserMenu v-else @open-admin="showAdmin = true" />
    </div>

    <!-- Admin "acting as another user" banner (whole deck tab) -->
    <ActingAsBanner v-if="currentView === 'build' && isActingAs" />

    <!-- Deck context bar (visible when not on gallery sub-view) -->
    <div v-if="!isDeckGallery" class="dcb-wrapper">
      <DeckContextBar
        @save="showSaveDeck = true"
        @save-update="handleWorkingSaveUpdate"
        @import="showImport = true"
        @go-to-gallery="handleGoToGallery"
      />
      <div v-if="currentView === 'build'" class="deck-subview-toggle" role="group" aria-label="Deck sub-view">
        <button
          :class="['dst-btn', { active: deckSubView === 'build' }]"
          @click="deckSubView = 'build'"
        >Build</button>
        <button
          :class="['dst-btn', { active: deckSubView === 'test' }]"
          :disabled="items.length === 0"
          :title="items.length === 0 ? 'Add cards to test a hand' : 'Simulate opening hands and consistency'"
          @click="deckSubView = 'test'"
        >Test Hand</button>
        <button
          :class="['dst-btn', { active: deckSubView === 'setup' }]"
          :disabled="items.length === 0"
          :title="items.length === 0 ? 'Add cards to run the setup simulator' : 'Estimate which turn your key line sets up'"
          @click="deckSubView = 'setup'"
        >Setup Sim</button>
      </div>
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
            <CardGrid
              ref="browseGridRef"
              context="browse"
              :selectable="true"
              :selected-ids="browseSelectedIds"
              @preview-card="handlePreview"
              @regenerate-card="handleBrowseRegenerate"
              @toggle-select="toggleBrowseSelect"
            >
              <template #toolbar>
                <BrowseGenerateButton
                  :selected-count="browseSelectedIds.size"
                  :visible-count="browseVisibleCount"
                  @click="openBrowseGenerate"
                />
              </template>
            </CardGrid>
          </div>

          <CardsView
            v-else-if="currentView === 'cards'"
            @preview-card="handleCardsPreview"
          />
          <PublicDecksView v-else-if="currentView === 'public'" />
          <QueueView v-else-if="currentView === 'queue'" />
          <GalleryView v-else-if="currentView === 'gallery'" />
          <VariantsView v-else-if="currentView === 'variants'" @preview-card="handlePreview" />

          <!-- Deck tab: gallery or build -->
          <DeckGalleryView
            v-else-if="isDeckGallery"
            @open-deck="handleGalleryOpenDeck"
            @new-deck="handleGalleryNewDeck"
            @import="showImport = true"
          />
          <TestHandPanel v-else-if="currentView === 'build' && deckSubView === 'test'" />
          <SetupSimPanel v-else-if="currentView === 'build' && deckSubView === 'setup'" />
          <WorkingDeckView
            v-else
            @preview-card="handleDeckPreview"
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
        @click="handleTabClick('build')">Deck</button>
      <button :class="['mobile-tab', { active: currentView === 'browse' }]"
        @click="handleTabClick('browse')">Browse</button>
      <button :class="['mobile-tab', { active: currentView === 'cards' }]"
        @click="handleTabClick('cards')">Cards</button>
      <button :class="['mobile-tab', { active: currentView === 'public' }]"
        @click="handleTabClick('public')">Public</button>
      <button :class="['mobile-tab', { active: currentView === 'queue', 'requires-auth': !isLoggedIn }]"
        @click="handleTabClick('queue')">Queue<span v-if="activeJobCount > 0" class="nav-badge mobile-nav-badge">{{ activeJobCount }}</span></button>
      <button :class="['mobile-tab', { active: currentView === 'gallery' }]"
        @click="handleTabClick('gallery')">Gallery</button>
      <button :class="['mobile-tab', { active: currentView === 'variants' }]"
        @click="handleTabClick('variants')">Variants</button>
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
    <BrowseGenerateDialog
      :open="showBrowseGenerate"
      :effective-count="browseEffectiveCount"
      :actual-count="browseActualCount"
      :is-admin="isAdmin"
      @confirm="handleBrowseGenerate"
      @cancel="showBrowseGenerate = false"
    />
    <Teleport to="body">
      <div v-if="showAuthDialog" class="auth-dialog-backdrop" @click="showAuthDialog = false">
        <div class="auth-dialog" @click.stop>
          <button class="auth-dialog-close" @click="showAuthDialog = false">&times;</button>
          <AuthPage @authenticated="showAuthDialog = false" />
        </div>
      </div>
    </Teleport>
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
