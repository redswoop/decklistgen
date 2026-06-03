<script setup lang="ts">
// Lightbox controller. Composes:
//   useCardNavigation     — search-set prev/next + the stable activeCard
//   useCardVariants       — same-name variant set + selected currentCard
//   useVariantDeckControl — add/remove/swap into the working or saved deck
//   useCardImageResolution— background/main/zoom images + generation state
//   useVariantBulkGeneration — "generate all variants"
//   useCardVersion        — Original/Cleaned/Proxy selection (pilot)
// and lays out the header, image + version picker, variants grid, stats panel,
// and the zoom / jumbo dialogs. Emit contract to App: close / cardChange /
// deckUpdated (unchanged).
import { ref, computed, watch, onMounted, onUnmounted, toRef } from "vue";
import type { Card } from "../../shared/types/card.js";
import { usePokeproxy, useGenerationQueryClient } from "../composables/usePokeproxy.js";
import { useDecklist } from "../composables/useDecklist.js";
import { useAuth } from "../composables/useAuth.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import CardZoom from "./lightbox/CardZoom.vue";
import VersionThumb from "./lightbox/VersionThumb.vue";
import LightboxDevTools from "./lightbox/LightboxDevTools.vue";
import CardStatsPanel from "./lightbox/CardStatsPanel.vue";
import { useCardVersion } from "../composables/useCardVersion.js";
import CardThumb from "./CardThumb.vue";
import CssCardRenderer from "./CssCardRenderer.vue";
import JumboPrintDialog from "./JumboPrintDialog.vue";
import type { DeckMembership } from "../../shared/types/customized-card.js";
import type { DeckCard } from "../../shared/types/deck.js";
import { useCardNavigation } from "../composables/useCardNavigation.js";
import { useCardVariants } from "../composables/useCardVariants.js";
import { useVariantDeckControl } from "../composables/useVariantDeckControl.js";
import { useCardImageResolution } from "../composables/useCardImageResolution.js";
import { useVariantBulkGeneration } from "../composables/useVariantBulkGeneration.js";

useGenerationQueryClient();
const { imageMode } = usePokeproxy();

// Version selection (sticky via localStorage) — see useCardVersion.
const { selectedVersion, selectVersion } = useCardVersion();

const props = defineProps<{
  card: Card;
  searchCards: Card[];
  source: 'grid' | 'deck';
  deckMembership?: DeckMembership[];
  deckName?: string;
  /** When set, replace operates on this saved deck instead of working deck */
  savedDeckId?: string;
  savedDeckCards?: DeckCard[];
}>();
const emit = defineEmits<{
  close: [];
  cardChange: [cardId: string];
  deckUpdated: [];
}>();

const { isAuthorized, isLoggedIn } = useAuth();
const { sweepZeroCount } = useDecklist();

// Search-set navigation (activeCard is the stable source of truth).
const { activeCard, searchIndex, prevCard, nextCard } =
  useCardNavigation(toRef(props, "card"), toRef(props, "searchCards"));

const isDeckContext = computed(() => props.source === "deck");

// Same-name variant set + the selected printing.
const { variants, variantIndex, currentCard, sameArtPrintings, hasMultipleVariants } =
  useCardVariants(activeCard);

// Variant-picker deck operations (working deck or saved deck).
const {
  activeDeckEntry, getVariantDeckCount, totalNameCount,
  handleVariantAdd, handleVariantRemove, handleVariantSwap,
} = useVariantDeckControl({
  isDeckContext,
  savedDeckId: toRef(props, "savedDeckId"),
  savedDeckCards: toRef(props, "savedDeckCards"),
  activeCard,
  variants,
  onDeckUpdated: () => emit("deckUpdated"),
});

// Emit card changes for URL sync (App.vue already knows the initial value).
const currentCardId = computed(() => currentCard.value.id);
watch(currentCardId, (id) => emit("cardChange", id));

// Images (background / main / zoom) + generation state for the current version.
const {
  cardDetail, hasCleanedImage, cleanedImageUrl, bgImageUrl, mainImageUrl, zoomImageUrl,
  generating, needsGeneration, canRegenerate, handleGenerate, handleRegenerate,
} = useCardImageResolution(currentCard, selectedVersion, isAuthorized);

function handleMainImageClick() {
  if (needsGeneration.value) {
    hasCleanedImage.value ? handleRegenerate() : handleGenerate();
  } else {
    showZoom.value = true;
  }
}

// Zoom
const showZoom = ref(false);
const zoomMode = computed<"proxy" | "image">(() =>
  selectedVersion.value === "proxy" ? "proxy" : "image",
);

// Keyboard: Escape/arrows
function onKeydown(e: KeyboardEvent) {
  if (showZoom.value) return; // zoom handles its own keys
  if (e.key === "Escape") emit("close");
  if (e.key === "ArrowLeft") prevCard();
  if (e.key === "ArrowRight") nextCard();
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  // Sweep zero-count working-deck entries created by variant-picker decrements,
  // so closing the lightbox leaves a clean deck (no faded ghost tiles).
  sweepZeroCount();
});

// Variant grid zoom — persisted to localStorage
const VARIANT_ZOOM_KEY = "decklistgen-variant-zoom";
const variantZoom = ref(parseInt(localStorage.getItem(VARIANT_ZOOM_KEY) ?? "1", 10));
const ZOOM_STEPS = [60, 90, 130, 180]; // px widths for variant thumbnails

function setVariantZoom(step: number) {
  variantZoom.value = step;
  localStorage.setItem(VARIANT_ZOOM_KEY, String(step));
}

// "Generate all same-name variants" in one click.
const { generatingAllVariants, generateAllVariantsDisabledReason, handleGenerateAllVariants } =
  useVariantBulkGeneration(variants, isLoggedIn, isAuthorized);

// Tags
const tags = computed(() =>
  [
    currentCard.value.isEx && "ex",
    currentCard.value.isV && "V",
    currentCard.value.isVmax && "VMAX",
    currentCard.value.isVstar && "VSTAR",
    currentCard.value.isAncient && "Ancient",
    currentCard.value.isFuture && "Future",
    currentCard.value.isTera && "Tera",
    currentCard.value.isFullArt && "Full Art",
    currentCard.value.hasFoil && "Foil",
  ].filter(Boolean) as string[]
);

function navigateToDeck(deckId: string) {
  window.location.hash = `#/decks/${deckId}`;
  emit("close");
}

// Jumbo print (132mm × 185mm). Opens the pair-picker dialog so the user can
// print this card alone (portrait) or alongside a second card (2-up landscape).
// The dialog prints in the version selected here (Original / Cleaned / Proxy).
const showJumboDialog = ref(false);
function handlePrintJumbo() {
  showJumboDialog.value = true;
}
</script>

<template>
  <div class="dialog-overlay lb-overlay" @click="emit('close')">
    <!-- Background art -->
    <div
      v-if="bgImageUrl"
      class="lb-bg"
      :style="{ backgroundImage: `url(${bgImageUrl})` }"
    ></div>

    <div class="lb-modal" @click.stop>
      <!-- Header -->
      <div class="lb-header">
        <button class="nav-btn" :disabled="searchIndex <= 0" @click="prevCard">&lsaquo;</button>
        <div class="lb-header-info">
          <div v-if="source === 'deck'" class="lb-source-label">{{ deckName ?? 'Browsing Deck' }}</div>
          <h2 class="lb-title">
            {{ currentCard.name }}
            <span v-if="currentCard.hp" class="lb-hp">{{ currentCard.hp }} HP</span>
          </h2>
          <div class="lb-meta">
            <span>{{ currentCard.setName }} ({{ currentCard.setCode }}) #{{ currentCard.localId }}</span>
            <span class="meta-sep"> · </span>
            <span>{{ currentCard.rarity }}</span>
            <template v-if="tags.length">
              <span v-for="t in tags" :key="t" class="lb-tag">{{ t }}</span>
            </template>
          </div>
          <div v-if="sameArtPrintings.length" class="lb-meta lb-same-art">
            Also printed in: {{ sameArtPrintings.map(v => `${v.setName} #${v.localId}`).join(', ') }}
          </div>
        </div>
        <button class="nav-btn" :disabled="searchIndex < 0 || searchIndex >= searchCards.length - 1" @click="nextCard">&rsaquo;</button>
        <button class="lightbox-close" @click="emit('close')">&times;</button>
      </div>

      <!-- Body: top area (image + variants grid), bottom area (version picker + info) -->
      <div class="lb-body">
        <!-- Left: card image + version picker -->
        <div class="lb-left">
          <div class="lb-card-image" @click="handleMainImageClick">
            <img
              v-if="mainImageUrl"
              :src="mainImageUrl"
              :alt="currentCard.name"
              class="lb-img"
            />
            <div v-else class="lb-img-placeholder">{{ selectedVersion !== 'proxy' ? currentCard.name : '' }}</div>
            <!--
              CSS card renderer for the Proxy view. Overlays the cleaned image
              (mainImageUrl) with the Vue/CSS card composition. Mounts only when
              a clean image exists; otherwise the existing "Click to generate"
              CTA takes over via needsGeneration.
            -->
            <div
              v-if="cleanedImageUrl"
              :class="['lb-card-css', { active: selectedVersion === 'proxy' }]"
            >
              <CssCardRenderer
                :card="currentCard"
                :detail="cardDetail"
                :art-url="cleanedImageUrl"
              />
            </div>
            <div v-if="generating" class="lb-generating-overlay">
              <div class="generate-spinner"></div>
              <div class="lb-gen-text">Generating...</div>
            </div>
            <div v-else-if="needsGeneration" class="lb-generate-cta" @click.stop="handleMainImageClick">
              <span class="lb-generate-cta-text">{{ !isLoggedIn ? 'Sign in to generate' : isAuthorized ? 'Click to generate' : 'Authorization required' }}</span>
            </div>
            <div v-if="!needsGeneration && !generating" class="lb-zoom-hint">Click to zoom</div>
            <button
              v-if="canRegenerate"
              class="lb-regen-btn"
              @click.stop="handleRegenerate"
              title="Regenerate cleaned image"
            >&#x21bb;</button>
          </div>

          <div class="lb-versions">
            <VersionThumb
              label="Original"
              :active="selectedVersion === 'original'"
              @select="selectVersion('original')"
            >
              <img v-if="currentCard.imageBase" :src="cardImageUrl(currentCard.imageBase, 'low')" class="lb-version-img" />
              <div v-else class="lb-version-placeholder">?</div>
            </VersionThumb>
            <VersionThumb
              label="Cleaned"
              :active="selectedVersion === 'cleaned'"
              @select="selectVersion('cleaned')"
            >
              <div v-if="generating" class="lb-version-placeholder"><div class="generate-spinner small"></div></div>
              <img v-else-if="cleanedImageUrl" :src="cleanedImageUrl" class="lb-version-img" />
              <div v-else class="lb-version-placeholder">--</div>
            </VersionThumb>
            <VersionThumb
              label="Proxy"
              :active="selectedVersion === 'proxy'"
              @select="selectVersion('proxy')"
            >
              <CssCardRenderer
                v-if="cleanedImageUrl"
                :card="currentCard"
                :detail="cardDetail"
                :art-url="cleanedImageUrl"
                class="lb-version-css"
              />
              <div v-else class="lb-version-placeholder">--</div>
            </VersionThumb>
          </div>
        </div>

        <!-- Right: scrolling stack — variants, card stats, actions -->
        <div class="lb-right">
          <div class="lb-info-scroll">
            <!-- Quick actions — always available regardless of grid/deck context -->
            <div class="lb-tools-row">
              <button
                class="lb-print-jumbo-btn"
                @click="handlePrintJumbo"
                title="Print at jumbo promo size (132 × 185 mm) — one card, or two side-by-side"
              >
                🖨 Print Jumbo
                <span class="lb-print-jumbo-sub">132 × 185 mm</span>
              </button>
            </div>

            <!-- Variant grid with controls -->
            <div v-if="hasMultipleVariants" class="lb-variants-section">
              <div class="lb-variants-header">
                <span v-if="isDeckContext && totalNameCount > 0" class="lb-variants-status">{{ totalNameCount }} in deck</span>
                <span v-else class="lb-variants-status">{{ variants?.length ?? 0 }} variants</span>
                <button
                  class="lb-generate-variants-btn"
                  :disabled="generateAllVariantsDisabledReason !== null"
                  :title="generateAllVariantsDisabledReason ?? 'Queue all variants for generation'"
                  data-testid="lb-generate-variants-btn"
                  @click="handleGenerateAllVariants"
                >
                  {{ generatingAllVariants ? 'Queuing...' : `Generate ${variants?.length ?? 0}` }}
                </button>
                <input
                  type="range"
                  class="lb-variant-zoom"
                  :min="0"
                  :max="ZOOM_STEPS.length - 1"
                  :value="variantZoom"
                  @input="setVariantZoom(+($event.target as HTMLInputElement).value)"
                />
              </div>
              <div class="lb-variants-grid" :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${ZOOM_STEPS[variantZoom]}px, 1fr))` }">
                <CardThumb
                  v-for="(v, i) in variants"
                  :key="v.id"
                  :card="v"
                  :image-mode="imageMode"
                  :count="getVariantDeckCount(v) || undefined"
                  :show-remove="isDeckContext"
                  :show-add="true"
                  :show-swap="isDeckContext && v.id !== activeCard.id && (activeDeckEntry?.count ?? 0) > 0"
                  :swap-title="`Replace ${(activeDeckEntry?.count ?? 0)}× ${activeCard.setCode} #${activeCard.localId} with ${v.setCode} #${v.localId}`"
                  :active="i === variantIndex"
                  @click="variantIndex = i"
                  @add="handleVariantAdd(v)"
                  @remove="handleVariantRemove(v)"
                  @swap="handleVariantSwap(v)"
                />
              </div>
            </div>

            <!-- Card stats: metadata, abilities, attacks, weakness/resist/retreat -->
            <CardStatsPanel :card="currentCard" :detail="cardDetail" />

            <!-- Single-variant controls (when no variant grid shown) -->
            <div v-if="!hasMultipleVariants" class="lb-deck-controls">
              <div v-if="isDeckContext" class="lb-single-variant-row">
                <button class="card-thumb-ctrl card-thumb-minus" :disabled="!getVariantDeckCount(currentCard)" @click="handleVariantRemove(currentCard)">&minus;</button>
                <span class="lb-single-variant-count">{{ getVariantDeckCount(currentCard) }} in deck</span>
                <button class="card-thumb-ctrl card-thumb-plus" @click="handleVariantAdd(currentCard)">+</button>
              </div>
              <button v-else class="lb-add-btn" @click="handleVariantAdd(currentCard)">Add to Deck</button>
            </div>

            <!-- Deck Membership (from Cards view) -->
            <div v-if="deckMembership?.length" class="lb-deck-membership">
              <div class="lb-dm-header">Appears in Decks</div>
              <div
                v-for="dm in deckMembership"
                :key="dm.deckId"
                class="lb-dm-entry"
                @click="navigateToDeck(dm.deckId)"
              >
                <span class="lb-dm-name">{{ dm.deckName }}</span>
                <span class="lb-dm-count">x{{ dm.count }}</span>
              </div>
            </div>

            <!-- Dev Tools (collapsible) -->
            <LightboxDevTools
              :current-card="currentCard"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Zoom overlay -->
    <div v-if="showZoom" @click.stop>
      <CardZoom
        :mode="zoomMode"
        :image-url="zoomImageUrl"
        :card="currentCard"
        :detail="cardDetail"
        :art-url="cleanedImageUrl"
        :alt="currentCard.name"
        @close="showZoom = false"
      />
    </div>

    <!-- Jumbo print pair-picker -->
    <div v-if="showJumboDialog" @click.stop>
      <JumboPrintDialog
        :current-card="currentCard"
        :version="selectedVersion"
        :recent-cards="searchCards"
        @close="showJumboDialog = false"
      />
    </div>
  </div>
</template>

<style scoped>
.lb-tools-row {
  display: flex;
  margin-bottom: 14px;
}

.lb-print-jumbo-btn {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.07);
  color: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s ease;
}

.lb-print-jumbo-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.lb-print-jumbo-sub {
  font-size: 11px;
  font-weight: 400;
  opacity: 0.6;
}
</style>
