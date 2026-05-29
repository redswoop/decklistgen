<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { api } from "../lib/client.js";
import DisplayCalibrationDialog from "./gallery/DisplayCalibrationDialog.vue";
import GalleryToolbar from "./gallery/GalleryToolbar.vue";
import GalleryGrid from "./gallery/GalleryGrid.vue";
import GalleryInspector from "./gallery/GalleryInspector.vue";
import GalleryControlRail from "./gallery/GalleryControlRail.vue";
import {
  useGalleryCardSource,
  templateForGalleryCard,
  type GalleryCardWithSource,
  type TemplateName,
} from "../composables/useGalleryCardSource.js";
import { useDisplayCalibration } from "../composables/useDisplayCalibration.js";
import { generateCleanImage, getGenerationVersion } from "../composables/usePokeproxy.js";
import { useToast } from "../composables/useToast.js";
import { useGallerySlotOverrides } from "../composables/useGallerySlotOverrides.js";
import SlotOverridePicker from "./gallery/SlotOverridePicker.vue";

type PreviewMode = "editing" | "physical";
type TemplateFilter = "all" | TemplateName;

const TEMPLATE_NAMES: readonly TemplateName[] = [
  "basic-energy",
  "pokemon-vstar",
  "pokemon-fullart",
  "trainer",
  "pokemon-standard",
];

const toast = useToast();

const cardSource = useGalleryCardSource();
const cards = cardSource.previewCards;
const isLoading = cardSource.isLoading;
async function refetch() {
  await cardSource.refetch();
}

// imageCacheBust — bumped when the cleaned/composite PNG on disk changes
//                  (after ComfyUI clean) so thumb art URLs refetch.
const imageCacheBust = ref(Date.now());

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

// Selection (right-rail inspector). Persisted across reload.
const SELECTED_LS_KEY = "decklistgen-gallery-selected";
const selectedCardId = ref<string | null>(localStorage.getItem(SELECTED_LS_KEY));
const lightboxBusy = ref(false);
const lightboxStatus = ref("");
const promptSaveStatus = ref("");

const activeCard = computed<GalleryCardWithSource | null>(() => {
  if (!selectedCardId.value || !cards.value) return null;
  return cards.value.find((c) => c.cardId === selectedCardId.value) ?? null;
});

function selectCard(card: GalleryCardWithSource) {
  selectedCardId.value = card.cardId;
  localStorage.setItem(SELECTED_LS_KEY, card.cardId);
  lightboxStatus.value = "";
  promptSaveStatus.value = "";
}

function selectCardById(cardId: string) {
  const card = cards.value?.find((c) => c.cardId === cardId);
  if (card) selectCard(card);
}

function deselectCard() {
  selectedCardId.value = null;
  localStorage.removeItem(SELECTED_LS_KEY);
  lightboxStatus.value = "";
  promptSaveStatus.value = "";
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

async function pollJob(jobId: string): Promise<void> {
  while (true) {
    await new Promise(r => setTimeout(r, 2000));
    const job = await api.queueGet(jobId);
    if (job.status === "completed") return;
    if (job.status === "failed") throw new Error(job.error || "Generation failed");
    if (job.status === "running") lightboxStatus.value = "ComfyUI generating...";
  }
}

async function doClean(force: boolean) {
  if (!activeCard.value || lightboxBusy.value) return;
  const card = activeCard.value;
  const isStandard = !card.isFullArt;
  lightboxBusy.value = true;
  lightboxStatus.value = force
    ? (isStandard ? "Re-expanding (random seed)..." : "Force re-cleaning...")
    : (isStandard ? "Expanding via ComfyUI..." : "Cleaning via ComfyUI...");

  try {
    const data = await api.pokeproxyGenerate(card.cardId, force);
    if (data.status === "queued") {
      lightboxStatus.value = "Queued — waiting for ComfyUI...";
      await pollJob(data.jobId);
    }
    lightboxStatus.value = "Done — refreshing...";
    // Clean updates only this card's PNG; the grid as a whole stays cached.
    imageCacheBust.value = Date.now();
    await refetch();
    lightboxStatus.value = "Done";
  } catch (e) {
    lightboxStatus.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    lightboxBusy.value = false;
  }
}

async function savePrompt(text: string) {
  const card = activeCard.value;
  if (!card) return;
  const trimmed = text.trim();
  if (!trimmed) return;
  promptSaveStatus.value = "Saving...";
  try {
    await api.pokeproxySavePrompt(card.cardId, trimmed);
    promptSaveStatus.value = "Saved";
    card.promptText = trimmed;
    card.promptRule = `card:${card.cardId}`;
  } catch (e) {
    promptSaveStatus.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

const cardCount = computed(() => cards.value?.length ?? 0);

// The DisplayCalibration dialog is mounted here so it can teleport to body
// from a stable root. The rail emits @openCalibration to toggle visibility.
const { physicalCardPx } = useDisplayCalibration();
const showCalibrationDialog = ref(false);

const PREVIEW_MODE_KEY = "decklistgen-gallery-preview-mode";
const previewMode = ref<PreviewMode>(
  (localStorage.getItem(PREVIEW_MODE_KEY) as PreviewMode) || "editing",
);
watch(previewMode, (m) => localStorage.setItem(PREVIEW_MODE_KEY, m));

const EDITING_ZOOM_KEY = "decklistgen-gallery-zoom";
const editingThumbWidth = ref<number>(
  Number(localStorage.getItem(EDITING_ZOOM_KEY)) || 180,
);
watch(editingThumbWidth, (w) => localStorage.setItem(EDITING_ZOOM_KEY, String(w)));

const previewThumbWidth = computed(() =>
  previewMode.value === "physical"
    ? Math.round(physicalCardPx.value.w)
    : editingThumbWidth.value,
);

const FILTER_KEY = "decklistgen-gallery-filter";
const templateFilter = ref<TemplateFilter>(
  (localStorage.getItem(FILTER_KEY) as TemplateFilter) || "all",
);
watch(templateFilter, (t) => localStorage.setItem(FILTER_KEY, t));

const templateCounts = computed<Record<TemplateName, number>>(() => {
  const out: Record<TemplateName, number> = {
    "basic-energy": 0,
    "pokemon-vstar": 0,
    "pokemon-fullart": 0,
    "trainer": 0,
    "pokemon-standard": 0,
  };
  for (const c of cards.value ?? []) out[templateForGalleryCard(c)]++;
  return out;
});

const search = ref("");

const filteredCards = computed(() => {
  let list = cards.value ?? [];
  if (templateFilter.value !== "all") {
    list = list.filter((c) => templateForGalleryCard(c) === templateFilter.value);
  }
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase();
    list = list.filter((c) =>
      c.name.toLowerCase().includes(q) || c.cardId.toLowerCase().includes(q),
    );
  }
  return list;
});

// --- Bulk-generate ---
const bulkBusy = ref(false);
const showForceConfirm = ref(false);

const missingCount = computed(
  () => (cards.value ?? []).filter((c) => !c.hasClean && !c.hasComposite).length,
);

async function generateMissing() {
  if (bulkBusy.value || !cards.value) return;
  bulkBusy.value = true;
  try {
    const targets = cards.value.filter((c) => !c.hasClean && !c.hasComposite);
    if (targets.length === 0) {
      toast.info("Nothing to do — every card already has artwork");
      return;
    }
    let queued = 0;
    for (const c of targets) {
      try {
        await generateCleanImage(c.cardId, false);
        queued++;
      } catch { /* per-card errors surfaced via toast inside generateCleanImage */ }
    }
    toast.info(`${queued} card${queued !== 1 ? "s" : ""} queued for generation`);
  } finally {
    bulkBusy.value = false;
  }
}

async function forceRegenerateAll() {
  if (bulkBusy.value || !cards.value) return;
  showForceConfirm.value = false;
  bulkBusy.value = true;
  try {
    let queued = 0;
    for (const c of cards.value) {
      try {
        await generateCleanImage(c.cardId, true);
        queued++;
      } catch { /* ignored — toast already shown */ }
    }
    toast.info(`${queued} card${queued !== 1 ? "s" : ""} queued for force-regeneration`);
  } finally {
    bulkBusy.value = false;
  }
}

// Watch the global generation-version map for any gallery card. When a
// ComfyUI job completes, useQueue → onGenerationCompleted bumps the per-card
// counter; we sum across our cards and refresh tiles when the sum increases.
const galleryGenerationTick = computed(() => {
  if (!cards.value) return 0;
  let sum = 0;
  for (const c of cards.value) sum += getGenerationVersion(c.cardId);
  return sum;
});

watch(galleryGenerationTick, (next, prev) => {
  if (next > prev) {
    // ComfyUI generation finishing affects whichever card just generated; we
    // can't pinpoint it from the tick sum, so refresh broadly.
    imageCacheBust.value = Date.now();
    refetch();
  }
});

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
    <Teleport to="body">
      <div v-if="showForceConfirm" class="confirm-overlay" @click.self="showForceConfirm = false">
        <div class="confirm-box">
          <div class="confirm-title">Force regenerate every gallery card?</div>
          <div class="confirm-body">
            This re-runs ComfyUI on all {{ cardCount }} test cards — slow and GPU-heavy.
            The existing cleaned artwork will be replaced with a fresh seed.
          </div>
          <div class="confirm-actions">
            <button class="btn btn-cancel" @click="showForceConfirm = false">Cancel</button>
            <button class="btn btn-force-confirm" @click="forceRegenerateAll">Regenerate all</button>
          </div>
        </div>
      </div>
    </Teleport>
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

/* Force-confirm modal */
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 9500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.confirm-box {
  background: #16213e;
  border-radius: 10px;
  padding: 20px 24px;
  max-width: 460px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
}

.confirm-title {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 10px;
}

.confirm-body {
  font-size: 13px;
  color: #bbb;
  line-height: 1.5;
  margin-bottom: 16px;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  padding: 8px 18px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn:hover { opacity: 0.85; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-cancel { background: #2d3748; color: #a0aec0; }
.btn-force-confirm { background: #9b2c2c; color: #fed7d7; }
</style>
