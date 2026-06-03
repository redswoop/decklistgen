<script setup lang="ts">
// Thin controller for the gallery workbench. Composes the gallery composables
// (filter / selection / preview / single + bulk generation) and lays out the
// toolbar + rail + grid + inspector. Logic lives in the composables; the only
// inline glue is the slot-override picker, keyboard nav, and the print/cache
// bookkeeping.
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import DisplayCalibrationDialog from "./gallery/DisplayCalibrationDialog.vue";
import GalleryToolbar from "./gallery/GalleryToolbar.vue";
import GalleryGrid from "./gallery/GalleryGrid.vue";
import GalleryInspector from "./gallery/GalleryInspector.vue";
import GalleryControlRail from "./gallery/GalleryControlRail.vue";
import SlotOverridePicker from "./gallery/SlotOverridePicker.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import {
  useGalleryCardSource,
  type GalleryCardWithSource,
} from "../composables/useGalleryCardSource.js";
import { useDisplayCalibration } from "../composables/useDisplayCalibration.js";
import { useGallerySlotOverrides } from "../composables/useGallerySlotOverrides.js";
import { useGalleryFilter } from "../composables/useGalleryFilter.js";
import { useGallerySelection } from "../composables/useGallerySelection.js";
import { useGalleryPreview } from "../composables/useGalleryPreview.js";
import { useGalleryGeneration } from "../composables/useGalleryGeneration.js";
import { useGalleryBulkGeneration } from "../composables/useGalleryBulkGeneration.js";
import { TEMPLATE_NAMES } from "../lib/gallery-filter.js";

const cardSource = useGalleryCardSource();
const cards = cardSource.previewCards;
const isLoading = cardSource.isLoading;
async function refetch() {
  await cardSource.refetch();
}

// imageCacheBust — bumped when the cleaned/composite PNG on disk changes
//                  (after ComfyUI clean) so thumb art URLs refetch.
const imageCacheBust = ref(Date.now());

const cardCount = computed(() => cards.value?.length ?? 0);

// Slot-override picker state. `pickerSlot` is the reference card whose slot
// the user is editing; null means the modal is closed.
const slotOverrides = useGallerySlotOverrides();
const pickerSlot = ref<GalleryCardWithSource | null>(null);

function openSwapPicker(card: GalleryCardWithSource) {
  if (card.source !== "reference" || !card.slotKey) return;
  pickerSlot.value = card;
}

function applySwap(replacementCardId: string) {
  const slot = pickerSlot.value;
  if (!slot?.slotKey) return;
  slotOverrides.setOverride(slot.slotKey, replacementCardId);
  pickerSlot.value = null;
}

function clearSwap() {
  const slot = pickerSlot.value;
  if (!slot?.slotKey) return;
  slotOverrides.clearOverride(slot.slotKey);
  pickerSlot.value = null;
}

// Preview sizing, template/search filtering, selection, generation.
const { physicalCardPx } = useDisplayCalibration();
const { previewMode, editingThumbWidth, previewThumbWidth } = useGalleryPreview(physicalCardPx);
const { templateFilter, search, templateCounts, filteredCards } = useGalleryFilter(cards);
const { selectedCardId, activeCard, selectCard, selectCardById, deselectCard } =
  useGallerySelection(cards);
const {
  busy: lightboxBusy,
  status: lightboxStatus,
  promptSaveStatus,
  resetStatus,
  doClean,
  savePrompt,
} = useGalleryGeneration(activeCard, refetch, imageCacheBust);
const { bulkBusy, missingCount, generateMissing, forceRegenerateAll } =
  useGalleryBulkGeneration(cards, refetch, imageCacheBust);

// Selecting a different card clears the previous card's clean/prompt status.
watch(selectedCardId, resetStatus);

const showCalibrationDialog = ref(false);
const showForceConfirm = ref(false);

function confirmForceRegenerate() {
  showForceConfirm.value = false;
  forceRegenerateAll();
}

/** Keyboard navigation: Esc deselects; ←/→ step through `filteredCards`. */
function onGalleryKeydown(e: KeyboardEvent) {
  // Don't hijack typing in inputs / textareas.
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

  if (e.key === "Escape" && selectedCardId.value) {
    deselectCard();
    e.preventDefault();
    return;
  }
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    const list = filteredCards.value;
    if (!list.length) return;
    const idx = selectedCardId.value
      ? list.findIndex((c) => c.cardId === selectedCardId.value)
      : -1;
    const next =
      e.key === "ArrowRight"
        ? (idx < 0 ? 0 : Math.min(list.length - 1, idx + 1))
        : (idx <= 0 ? 0 : idx - 1);
    selectCard(list[next]);
    e.preventDefault();
  }
}

onMounted(() => window.addEventListener("keydown", onGalleryKeydown));
onUnmounted(() => window.removeEventListener("keydown", onGalleryKeydown));

function openPrint() {
  if (!cards.value || cards.value.length === 0) return;
  const ids = cards.value.map((c) => c.cardId);
  sessionStorage.setItem("gallery-print-ids", JSON.stringify(ids));
  window.open("/print.html?gallery=1&auto=1", "_blank");
}
</script>

<template>
  <div class="gallery-view">
    <GalleryToolbar
      v-model:preview-mode="previewMode"
      v-model:editing-thumb-width="editingThumbWidth"
      v-model:search="search"
      v-model:template-filter="templateFilter"
      :filtered-count="filteredCards.length"
      :card-count="cardCount"
      :template-names="TEMPLATE_NAMES"
      :template-counts="templateCounts"
      :bulk-busy="bulkBusy"
      :missing-count="missingCount"
      @generate-missing="generateMissing"
      @force-regenerate="showForceConfirm = true"
      @print="openPrint"
    />

    <div v-if="isLoading" class="gallery-loading">Loading cards...</div>

    <div v-else class="gallery-workbench">
      <GalleryControlRail
        class="gallery-rail"
        @open-calibration="showCalibrationDialog = true"
      />
      <GalleryGrid
        :cards="filteredCards"
        :selected-card-id="selectedCardId"
        :preview-mode="previewMode"
        :thumb-width="previewThumbWidth"
        :image-cache-bust="imageCacheBust"
        @select="selectCard"
        @swap="openSwapPicker"
      />
      <GalleryInspector
        :active-card="activeCard"
        :cards="cards"
        :thumb-width="previewThumbWidth"
        :image-cache-bust="imageCacheBust"
        :busy="lightboxBusy"
        :status="lightboxStatus"
        :prompt-save-status="promptSaveStatus"
        @close="deselectCard"
        @clean="doClean"
        @save-prompt="savePrompt"
        @select="selectCardById"
      />
    </div>

    <DisplayCalibrationDialog
      :open="showCalibrationDialog"
      @close="showCalibrationDialog = false"
    />

    <SlotOverridePicker
      v-if="pickerSlot"
      :slot-label="pickerSlot.label"
      :slot-key="pickerSlot.slotKey!"
      :current-card-id="pickerSlot.cardId"
      :has-override="pickerSlot.slotKey !== pickerSlot.cardId"
      @close="pickerSlot = null"
      @pick="applySwap"
      @clear="clearSwap"
    />

    <!-- Force-regenerate-all confirmation -->
    <ConfirmDialog
      v-if="showForceConfirm"
      title="Force regenerate every gallery card?"
      :message="`This re-runs ComfyUI on all ${cardCount} test cards — slow and GPU-heavy. The existing cleaned artwork will be replaced with a fresh seed.`"
      confirm-label="Regenerate all"
      @confirm="confirmForceRegenerate"
      @close="showForceConfirm = false"
    />
  </div>
</template>

<style scoped>
.gallery-view {
  padding: 20px 24px;
  height: 100%;
  overflow-y: auto;
}

.gallery-loading {
  color: #888;
  font-size: 14px;
  padding: 40px 0;
  text-align: center;
}

/* Workbench: 3-column layout — controls rail, grid, inspector. */
.gallery-workbench {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 420px;
  gap: 20px;
  align-items: flex-start;
}

.gallery-rail {
  position: sticky;
  top: 16px;
  max-height: calc(100vh - 32px);
  border-radius: 8px;
}

@media (max-width: 1200px) {
  .gallery-workbench {
    grid-template-columns: minmax(0, 1fr) 420px;
  }
  .gallery-rail { display: none; }
}
</style>
