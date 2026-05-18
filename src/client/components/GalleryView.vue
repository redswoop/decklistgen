<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { api } from "../lib/client.js";
import GallerySvgThumb from "./GallerySvgThumb.vue";
import type { TemplateName } from "../../shared/utils/suggest-template.js";
import { generateCleanImage, getGenerationVersion, isGenerating } from "../composables/usePokeproxy.js";
import { useToast } from "../composables/useToast.js";
import { getSvg, peekSvg } from "../composables/useGallerySvgCache.js";

interface GalleryCard {
  label: string;
  cardId: string;
  name: string;
  category: string;
  stage: string | null;
  hp: number | null;
  rarity: string | null;
  energyTypes: string[];
  /** Raw card effect text — required by suggestTemplate to distinguish
   *  basic vs special energies. */
  effect: string | null;
  isFullArt: boolean;
  hasClean: boolean;
  hasComposite: boolean;
  hasSvg: boolean;
  hasSource: boolean;
  cleanMeta: Record<string, unknown> | null;
  promptRule: string | null;
  promptText: string | null;
  promptSkip: boolean;
}

const toast = useToast();

const { data: cards, isLoading, refetch } = useQuery<GalleryCard[]>({
  queryKey: ["gallery-cards"],
  queryFn: () => api.galleryCards(),
  staleTime: 60_000,
});

// Two cache-bust counters so SVG regenerations don't also force re-fetches
// of the unchanged cleaned-art PNG (and vice versa).
//   svgCacheBust  — bumped when the SVG output changes (font-size / family / regen)
//   imageCacheBust — bumped when the cleaned/composite PNG on disk changes (after ComfyUI clean)
const svgCacheBust = ref(Date.now());
const imageCacheBust = ref(Date.now());

// Warm the SVG cache for every gallery card so the Print button is usable as
// soon as the user opens the gallery. The thumbnails themselves are rendered
// by GallerySvgThumb, which has its own watch on (cardId, cacheBust).
watch(cards, (list) => {
  if (!list) return;
  for (const card of list) {
    void getSvg(card.cardId, svgCacheBust.value);
  }
}, { immediate: true });

// Lightbox state
const activeCard = ref<GalleryCard | null>(null);
const lightboxBusy = ref(false);
const lightboxStatus = ref("");
const lightboxSvg = ref("");
const promptText = ref("");
const promptSaveStatus = ref("");

function sourceUrl(cardId: string) {
  return `/api/pokeproxy/image/${cardId}/source`;
}

function cleanUrl(cardId: string) {
  return `/api/pokeproxy/image/${cardId}/composite?t=${imageCacheBust.value}`;
}

async function loadLightboxSvg(cardId: string) {
  lightboxSvg.value = "";
  lightboxSvg.value = await getSvg(cardId, svgCacheBust.value);
}

function openLightbox(card: GalleryCard) {
  activeCard.value = card;
  lightboxStatus.value = "";
  promptText.value = card.promptText ?? "";
  promptSaveStatus.value = "";
  loadLightboxSvg(card.cardId);
}

function closeLightbox() {
  activeCard.value = null;
  lightboxStatus.value = "";
  lightboxSvg.value = "";
}

function metaLine(card: GalleryCard): string {
  return [card.category, card.stage, card.hp ? `HP ${card.hp}` : null,
    card.energyTypes?.join(", ") || null, card.rarity].filter(Boolean).join(" | ");
}

type ThumbBadge = { text: string; variant: "standard" | "fullart" | "clean" | "expanded" };
function badgesFor(card: GalleryCard): ThumbBadge[] {
  const out: ThumbBadge[] = [];
  if (card.hasClean) {
    out.push(card.isFullArt
      ? { text: "CLEANED", variant: "clean" }
      : { text: "EXPANDED", variant: "expanded" });
  }
  out.push(card.isFullArt
    ? { text: "FULLART", variant: "fullart" }
    : { text: "STANDARD", variant: "standard" });
  return out;
}

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
    // Clean changes both the cleaned PNG and the SVG (which embeds it).
    imageCacheBust.value = Date.now();
    svgCacheBust.value = Date.now();
    card.hasClean = true;
    card.hasComposite = true;
    // Reload SVGs
    loadLightboxSvg(card.cardId);
    await refetch();
    lightboxStatus.value = "Done";
  } catch (e) {
    lightboxStatus.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    lightboxBusy.value = false;
  }
}

async function doRegen() {
  if (!activeCard.value || lightboxBusy.value) return;
  const cardId = activeCard.value.cardId;
  lightboxBusy.value = true;
  lightboxStatus.value = "Regenerating SVG...";
  try {
    await api.pokeproxyRegenerateSvg(cardId);
    // Regen only changes the SVG; the cleaned PNG on disk is untouched.
    svgCacheBust.value = Date.now();
    loadLightboxSvg(cardId);
    lightboxStatus.value = "SVG updated";
  } catch (e) {
    lightboxStatus.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    lightboxBusy.value = false;
  }
}

async function savePrompt() {
  if (!activeCard.value) return;
  const text = promptText.value.trim();
  if (!text) return;
  promptSaveStatus.value = "Saving...";
  try {
    await api.pokeproxySavePrompt(activeCard.value.cardId, text);
    promptSaveStatus.value = "Saved";
    activeCard.value.promptText = text;
    activeCard.value.promptRule = `card:${activeCard.value.cardId}`;
  } catch (e) {
    promptSaveStatus.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

const cardCount = computed(() => cards.value?.length ?? 0);

// --- Font sizes + Font family tabs ---
type GalleryTab = "cards" | "font-sizes" | "font-family";
const activeTab = ref<GalleryTab>("cards");

const fontSizeDefaults = ref<Record<string, number>>({});
const fontSizeOverrides = ref<Record<string, number>>({});
const fontSizeEdited = ref<Record<string, string>>({});
const fontSizeLoading = ref(false);
const fontSizeStatus = ref("");

// Tokens not currently used by any template — render UI-side filter
// (kept here rather than in the constants file so the resolver fallback
// `default` still works while not showing up as an editable row).
const FONT_SIZE_HIDDEN_KEYS = new Set(["default"]);

async function loadFontSizes() {
  fontSizeLoading.value = true;
  try {
    const data = await api.getFontSizes();
    fontSizeDefaults.value = data.defaults;
    fontSizeOverrides.value = data.current;
    // Build edited map: overrides first, then defaults
    const edited: Record<string, string> = {};
    for (const key of Object.keys(data.defaults)) {
      edited[key] = String(data.current[key] ?? data.defaults[key]);
    }
    fontSizeEdited.value = edited;
    fontSizeStatus.value = "";
  } catch (e) {
    fontSizeStatus.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    fontSizeLoading.value = false;
  }
}

// Template picker / preview-grid state for the Font Sizes tab.
// "all" means "show one representative card per template";
// a TemplateName means "show every TEST_CARDS card that resolves to this template".
type TemplateFilter = "all" | TemplateName;
const templateFilter = ref<TemplateFilter>("all");

const TEMPLATE_NAMES: TemplateName[] = [
  "basic-energy",
  "pokemon-vstar",
  "pokemon-fullart",
  "trainer",
  "pokemon-standard",
];

/** Mirror of suggestTemplate() that uses the gallery card's pre-computed
 *  `isFullArt` instead of re-running the detection from raw fields. The
 *  /gallery/cards payload doesn't ship `rarity` + `name` in a shape
 *  isFullArt() can read, so calling suggestTemplate() directly would route
 *  every fullart card into pokemon-standard. */
function templateForGalleryCard(c: GalleryCard): TemplateName {
  if (c.category === "Energy" && !c.effect) return "basic-energy";
  if (c.category === "Energy" && c.effect) return "trainer";
  if (c.category === "Trainer") return "trainer";
  if (c.stage === "VSTAR") return "pokemon-vstar";
  if (c.isFullArt) return "pokemon-fullart";
  return "pokemon-standard";
}

const cardsByTemplate = computed<Record<TemplateName, GalleryCard[]>>(() => {
  const out: Record<TemplateName, GalleryCard[]> = {
    "basic-energy": [],
    "pokemon-vstar": [],
    "pokemon-fullart": [],
    "trainer": [],
    "pokemon-standard": [],
  };
  for (const c of cards.value ?? []) {
    out[templateForGalleryCard(c)].push(c);
  }
  return out;
});

const previewGridCards = computed<GalleryCard[]>(() => {
  if (templateFilter.value === "all") {
    return TEMPLATE_NAMES
      .map((t) => cardsByTemplate.value[t][0])
      .filter((c): c is GalleryCard => !!c);
  }
  return cardsByTemplate.value[templateFilter.value] ?? [];
});

function templateCount(t: TemplateName): number {
  return cardsByTemplate.value[t]?.length ?? 0;
}

const visibleFontSizeKeys = computed(() =>
  Object.keys(fontSizeDefaults.value).filter(k => !FONT_SIZE_HIDDEN_KEYS.has(k))
);

/** Bump the SVG cache-bust so all `<GallerySvgThumb>` instances re-fetch.
 *  Does NOT touch imageCacheBust — the cleaned-art PNGs on disk are unchanged,
 *  so we don't force the browser to re-download them. */
function refreshAllRenderedSvgs() {
  svgCacheBust.value = Date.now();
  // Warm the cache so the Print button stays ready after a font-size save.
  if (cards.value) {
    for (const card of cards.value) void getSvg(card.cardId, svgCacheBust.value);
  }
  if (activeCard.value) loadLightboxSvg(activeCard.value.cardId);
}

watch(activeTab, (tab) => {
  if (tab === "font-sizes" && Object.keys(fontSizeDefaults.value).length === 0) {
    loadFontSizes();
  }
  if (tab === "font-family" && fontFamilyAvailable.value.length === 0) {
    loadFontFamily();
  }
});

// --- Font family ---
interface FontFamilyOption { id: string; displayName: string; license: string; titleOnly: boolean; weights: number[] }
const FONT_ROLE_DEFS: { id: string; label: string; titleOnly: boolean }[] = [
  { id: "title",         label: "Title (card / attack / ability name)",         titleOnly: true },
  { id: "body",          label: "Body (effect text, rules)",                    titleOnly: false },
  { id: "hp",            label: "HP & damage values",                           titleOnly: true },
  { id: "infobar",       label: "Info bar (weakness, retreat, card number)",    titleOnly: false },
  { id: "pokedex",       label: "Pokédex entries",                              titleOnly: false },
  { id: "trainerHeader", label: "Trainer header word",                          titleOnly: true },
];
interface FontFamilyPreset { id: string; displayName: string; description: string; selection: Record<string, string> }
const fontFamilyAvailable = ref<FontFamilyOption[]>([]);
const fontFamilyPresets = ref<FontFamilyPreset[]>([]);
const fontFamilyCurrent = ref<Record<string, string>>({});
const fontFamilyLoading = ref(false);
const fontFamilyStatus = ref("");
const fontFamilyPreviewSvg = ref<string>("");
const fontFamilyPreviewCardId = "sv01-006"; // Spidops: title, ability, attack, energy tokens

async function loadFontFamily() {
  fontFamilyLoading.value = true;
  try {
    const data = await api.getFontFamily();
    fontFamilyAvailable.value = data.available;
    fontFamilyPresets.value = data.presets ?? [];
    fontFamilyCurrent.value = { ...data.current };
    fontFamilyStatus.value = "";
    await refreshFontFamilyPreview();
  } catch (e) {
    fontFamilyStatus.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    fontFamilyLoading.value = false;
  }
}

function applyFontPreset(preset: FontFamilyPreset) {
  fontFamilyCurrent.value = { ...preset.selection };
  fontFamilyStatus.value = `Loaded "${preset.displayName}" — click Save to apply.`;
}

async function refreshFontFamilyPreview() {
  try {
    const resp = await fetch(`/api/pokeproxy/svg/${fontFamilyPreviewCardId}?t=${Date.now()}`, { credentials: "include" });
    if (!resp.ok) throw new Error(`preview ${resp.status}`);
    fontFamilyPreviewSvg.value = await resp.text();
  } catch (e) {
    fontFamilyPreviewSvg.value = `<span style="color:#666;font-size:12px">Preview failed: ${e instanceof Error ? e.message : String(e)}</span>`;
  }
}

async function saveFontFamily() {
  fontFamilyStatus.value = "Saving...";
  try {
    const data = await api.saveFontFamily(fontFamilyCurrent.value);
    fontFamilyCurrent.value = data.current;
    fontFamilyStatus.value = "Saved";
    refreshAllRenderedSvgs();
    await refreshFontFamilyPreview();
  } catch (e) {
    fontFamilyStatus.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function resetFontFamily() {
  fontFamilyStatus.value = "Resetting...";
  try {
    const data = await api.resetFontFamily();
    fontFamilyCurrent.value = data.current;
    fontFamilyStatus.value = "Reset to defaults";
    refreshAllRenderedSvgs();
    await refreshFontFamilyPreview();
  } catch (e) {
    fontFamilyStatus.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function fontOptionsForRole(roleTitleOnly: boolean): FontFamilyOption[] {
  // If the role itself is title-only (heavy display), allow every font;
  // otherwise hide titleOnly fonts (display-only ones like Bauhaus).
  return roleTitleOnly
    ? fontFamilyAvailable.value
    : fontFamilyAvailable.value.filter(f => !f.titleOnly);
}

function fontFamilyLicense(id: string): string {
  return fontFamilyAvailable.value.find(f => f.id === id)?.license ?? "";
}

function fontSizeIsOverridden(key: string): boolean {
  if (!(key in fontSizeOverrides.value)) return false;
  return fontSizeOverrides.value[key] !== fontSizeDefaults.value[key];
}

function fontSizeIsEdited(key: string): boolean {
  const editedVal = Number(fontSizeEdited.value[key]);
  const effectiveVal = fontSizeOverrides.value[key] ?? fontSizeDefaults.value[key];
  return editedVal !== effectiveVal;
}

const hasUnsavedFontSizes = computed(() =>
  Object.keys(fontSizeDefaults.value).some(k => fontSizeIsEdited(k))
);

async function saveFontSizeOverrides() {
  const overrides: Record<string, number> = {};
  for (const [key, val] of Object.entries(fontSizeEdited.value)) {
    const num = Number(val);
    if (!isNaN(num) && num !== fontSizeDefaults.value[key]) {
      overrides[key] = num;
    }
  }
  fontSizeStatus.value = "Saving...";
  try {
    await api.saveFontSizes(overrides);
    fontSizeOverrides.value = overrides;
    fontSizeStatus.value = "Saved";
    refreshAllRenderedSvgs();
  } catch (e) {
    fontSizeStatus.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function resetFontSizeOverrides() {
  fontSizeStatus.value = "Resetting...";
  try {
    await api.resetFontSizes();
    fontSizeOverrides.value = {};
    const edited: Record<string, string> = {};
    for (const key of Object.keys(fontSizeDefaults.value)) {
      edited[key] = String(fontSizeDefaults.value[key]);
    }
    fontSizeEdited.value = edited;
    fontSizeStatus.value = "Reset to defaults";
    refreshAllRenderedSvgs();
  } catch (e) {
    fontSizeStatus.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function editInEditor(cardId: string) {
  window.location.hash = `#/editor/${cardId}`;
}

// --- Bulk-generate ---
const bulkBusy = ref(false);
const showForceConfirm = ref(false);

function missingCount(): number {
  return (cards.value ?? []).filter((c) => !c.hasClean && !c.hasComposite).length;
}

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
    svgCacheBust.value = Date.now();
    imageCacheBust.value = Date.now();
    refetch();
  }
});

async function openPrint() {
  if (!cards.value || cards.value.length === 0) return;
  const settled = await Promise.all(
    cards.value.map(async (c) => {
      // Resolve from cache when present (no extra fetch) — fall through to
      // getSvg for any straggler cards whose initial warm hasn't returned.
      const p = peekSvg(c.cardId, svgCacheBust.value) ?? getSvg(c.cardId, svgCacheBust.value);
      return await p;
    }),
  );
  const svgs = settled.filter((s) => s.startsWith("<svg"));
  if (svgs.length === 0) return;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Gallery Print</title>
<style>
@page { size: letter; margin: 0.25in; }
body { margin: 0; padding: 0.25in; }
.card-grid { display: flex; flex-wrap: wrap; align-content: flex-start; }
.card { width: 2.5in; height: 3.5in; page-break-inside: avoid; overflow: hidden; }
.card svg { width: 100%; height: 100%; }
@media print { body { padding: 0; } }
</style></head><body>
<div class="card-grid">${svgs.map(s => `<div class="card">${s}</div>`).join("\n")}</div>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
</script>

<template>
  <div class="gallery-view">
    <div class="gallery-header">
      <h2>Gallery</h2>
      <div class="gallery-tabs">
        <button :class="['tab', activeTab === 'cards' && 'tab-active']" @click="activeTab = 'cards'">Cards</button>
        <button :class="['tab', activeTab === 'font-sizes' && 'tab-active']" @click="activeTab = 'font-sizes'">Font Sizes</button>
        <button :class="['tab', activeTab === 'font-family' && 'tab-active']" @click="activeTab = 'font-family'">Font Family</button>
      </div>
      <span class="gallery-count">{{ cardCount }} test cards</span>
      <div class="gallery-bulk">
        <button
          class="btn btn-gen-missing"
          :disabled="activeTab !== 'cards' || bulkBusy || missingCount() === 0"
          :title="activeTab !== 'cards' ? 'Switch to the Cards tab to bulk-generate' : missingCount() === 0 ? 'Every test card already has cleaned artwork' : `Queue ComfyUI clean for ${missingCount()} card(s) lacking artwork`"
          @click="generateMissing"
        >Generate Missing ({{ missingCount() }})</button>
        <button
          class="btn btn-force-all"
          :disabled="activeTab !== 'cards' || bulkBusy || cardCount === 0"
          :title="activeTab !== 'cards' ? 'Switch to the Cards tab to bulk-generate' : 'Force-clean every gallery card — slow & GPU-heavy'"
          @click="showForceConfirm = true"
        >Force Regenerate All</button>
        <button
          class="btn btn-print"
          :disabled="activeTab !== 'cards' || cardCount === 0"
          :title="activeTab !== 'cards' ? 'Switch to the Cards tab to print' : 'Open print sheet in new tab'"
          @click="openPrint"
        >Print</button>
      </div>
    </div>

    <!-- Font Sizes Tab -->
    <div v-if="activeTab === 'font-sizes'" class="fs-panel">
      <div v-if="fontSizeLoading" class="gallery-loading">Loading font sizes...</div>
      <template v-else>
        <div class="fs-layout">
          <div class="fs-controls">
            <div class="fs-actions">
              <button class="btn btn-save-fs" :disabled="!hasUnsavedFontSizes" @click="saveFontSizeOverrides" title="Save overrides to server">Save</button>
              <button class="btn btn-reset-fs" @click="resetFontSizeOverrides" title="Reset all to defaults">Reset</button>
              <span v-if="fontSizeStatus" class="fs-status">{{ fontSizeStatus }}</span>
            </div>
            <table class="fs-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Default</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="key in visibleFontSizeKeys" :key="key" :class="{ 'fs-overridden': fontSizeIsOverridden(key), 'fs-edited': fontSizeIsEdited(key) }">
                  <td class="fs-token">{{ key }}</td>
                  <td class="fs-default">{{ fontSizeDefaults[key] }}</td>
                  <td class="fs-value">
                    <input
                      type="number"
                      :value="fontSizeEdited[key]"
                      min="1"
                      max="200"
                      @input="(e: Event) => fontSizeEdited[key] = (e.target as HTMLInputElement).value"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="fs-preview">
            <div class="fs-preview-head">
              <div class="ff-preview-label">Preview</div>
              <div class="fs-preview-hint">{{ templateFilter === "all"
                ? "One card per template — pick a chip below to focus on a single template."
                : `Every TEST_CARDS entry in ${templateFilter} (${previewGridCards.length})` }}</div>
            </div>
            <div class="fs-templates">
              <button
                :class="['fs-chip', templateFilter === 'all' && 'fs-chip-active']"
                @click="templateFilter = 'all'"
              >All Templates</button>
              <button
                v-for="t in TEMPLATE_NAMES"
                :key="t"
                :class="['fs-chip', templateFilter === t && 'fs-chip-active']"
                :disabled="templateCount(t) === 0"
                :title="templateCount(t) === 0 ? `No TEST_CARDS resolve to ${t}` : `${templateCount(t)} card(s) in ${t}`"
                @click="templateFilter = t"
              >{{ t }} <span class="fs-chip-count">{{ templateCount(t) }}</span></button>
            </div>
            <div class="fs-preview-grid">
              <GallerySvgThumb
                v-for="c in previewGridCards"
                :key="c.cardId"
                :card-id="c.cardId"
                :cache-bust="svgCacheBust"
                :width="180"
                :label="c.label"
                :name="c.name"
              />
              <div v-if="previewGridCards.length === 0" class="fs-preview-empty">
                No TEST_CARDS cards resolve to this template yet.
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Font Family Tab -->
    <div v-if="activeTab === 'font-family'" class="ff-panel">
      <div v-if="fontFamilyLoading" class="gallery-loading">Loading fonts...</div>
      <template v-else>
        <p class="ff-help">Pick which font fills each text role on the card. The chosen font is embedded in every rendered SVG so layout matches in any browser.</p>
        <div v-if="fontFamilyPresets.length" class="ff-presets">
          <span class="ff-presets-label">Presets:</span>
          <button
            v-for="preset in fontFamilyPresets"
            :key="preset.id"
            class="btn ff-preset"
            :title="preset.description"
            @click="applyFontPreset(preset)"
          >{{ preset.displayName }}</button>
        </div>
        <div v-for="role in FONT_ROLE_DEFS" :key="role.id" class="ff-row">
          <label :for="`ff-${role.id}`">{{ role.label }}</label>
          <select :id="`ff-${role.id}`" v-model="fontFamilyCurrent[role.id]">
            <option v-for="f in fontOptionsForRole(role.titleOnly)" :key="f.id" :value="f.id">{{ f.displayName }}</option>
          </select>
          <span class="ff-license">{{ fontFamilyLicense(fontFamilyCurrent[role.id]) }}</span>
        </div>
        <div class="ff-actions">
          <button class="btn btn-save-fs" @click="saveFontFamily">Save</button>
          <button class="btn btn-reset-fs" @click="resetFontFamily">Reset</button>
          <span v-if="fontFamilyStatus" class="fs-status">{{ fontFamilyStatus }}</span>
        </div>
        <div class="ff-preview">
          <div class="ff-preview-label">Preview ({{ fontFamilyPreviewCardId }})</div>
          <div class="ff-preview-card" v-html="fontFamilyPreviewSvg"></div>
        </div>
      </template>
    </div>

    <!-- Cards Tab -->
    <div v-if="activeTab === 'cards' && isLoading" class="gallery-loading">Loading cards...</div>

    <div v-else-if="activeTab === 'cards'" class="gallery-grid">
      <GallerySvgThumb
        v-for="card in cards"
        :key="card.cardId"
        :card-id="card.cardId"
        :cache-bust="svgCacheBust"
        :width="230"
        :label="card.label"
        :name="card.name"
        :meta-line="metaLine(card)"
        :badges="badgesFor(card)"
        :loading="isGenerating(card.cardId)"
        @click="openLightbox(card)"
      />
    </div>

    <!-- Lightbox -->
    <Teleport to="body">
      <div v-if="activeCard" class="lb-overlay" @click.self="closeLightbox">
        <div class="lb-content" @click.stop>
          <div class="lb-top">
            <div class="lb-title">{{ activeCard.label }} — {{ activeCard.name }}</div>
            <button class="lb-close" @click="closeLightbox">&times;</button>
          </div>
          <div class="lb-panels">
            <div class="lb-panel">
              <div class="lb-panel-label">Source</div>
              <img :src="sourceUrl(activeCard.cardId)" :alt="activeCard.name" />
            </div>
            <div v-if="activeCard.hasComposite || activeCard.hasClean" class="lb-panel">
              <div class="lb-panel-label">{{ activeCard.isFullArt ? 'Cleaned' : 'Expanded' }}</div>
              <img :src="cleanUrl(activeCard.cardId)" :alt="activeCard.name" />
            </div>
            <div class="lb-panel">
              <div class="lb-panel-label">SVG</div>
              <div class="lb-svg" v-html="lightboxSvg || '<span class=placeholder>Loading...</span>'" />
            </div>
          </div>

          <div class="lb-bottom">
            <div v-if="lightboxStatus" class="lb-status">{{ lightboxStatus }}</div>
            <div class="lb-actions">
              <button
                class="btn btn-edit"
                @click="editInEditor(activeCard.cardId)"
                title="Open in template editor"
              >Edit</button>
              <button
                class="btn btn-clean"
                :disabled="lightboxBusy"
                :title="lightboxBusy ? 'Operation in progress' : ''"
                @click="doClean(false)"
              >{{ activeCard.isFullArt ? 'Clean (ComfyUI)' : 'Expand (ComfyUI)' }}</button>
              <button
                class="btn btn-force"
                :disabled="lightboxBusy"
                :title="lightboxBusy ? 'Operation in progress' : ''"
                @click="doClean(true)"
              >{{ activeCard.isFullArt ? 'Force Re-clean' : 'Re-expand' }}</button>
              <button
                class="btn btn-regen"
                :disabled="lightboxBusy"
                :title="lightboxBusy ? 'Operation in progress' : ''"
                @click="doRegen"
              >Regen SVG</button>
            </div>

            <div class="prompt-box">
              <div class="prompt-label">
                Prompt <span class="prompt-rule">(rule: {{ activeCard.promptRule ?? 'none' }})</span>
              </div>
              <textarea v-model="promptText" rows="3" />
              <div class="prompt-actions">
                <button class="btn btn-save-prompt" @click="savePrompt">Save for this card</button>
                <span v-if="promptSaveStatus" class="prompt-status">{{ promptSaveStatus }}</span>
              </div>
              <div v-if="activeCard.cleanMeta" class="prompt-meta">
                Last clean: rule={{ activeCard.cleanMeta.rule }},
                seed={{ activeCard.cleanMeta.seed }},
                {{ activeCard.cleanMeta.timestamp }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

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

.gallery-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}

.gallery-header h2 {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.gallery-count {
  font-size: 13px;
  color: #888;
}

.gallery-loading {
  color: #888;
  font-size: 14px;
  padding: 40px 0;
  text-align: center;
}

.gallery-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  justify-content: flex-start;
}

.gallery-bulk {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.btn-gen-missing { background: #276749; color: #9ae6b4; }
.btn-force-all   { background: #9b2c2c; color: #fed7d7; }

/* Lightbox */
.lb-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.88);
  z-index: 9000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow-y: auto;
  padding: 40px 20px;
}

.lb-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  max-width: 1300px;
  width: 100%;
}

.lb-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.lb-title {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
}

.lb-close {
  font-size: 28px;
  color: #888;
  background: none;
  border: none;
  cursor: pointer;
  line-height: 1;
  padding: 4px 8px;
}

.lb-close:hover { color: #fff; }

.lb-panels {
  display: flex;
  justify-content: center;
  gap: 20px;
  flex-wrap: wrap;
}

.lb-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.lb-panel-label {
  font-size: 12px;
  font-weight: 700;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.lb-panel img {
  height: 55vh;
  width: auto;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.lb-svg {
  height: 55vh;
  width: auto;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.lb-svg :deep(svg) {
  height: 55vh;
  width: auto;
  display: block;
}

.lb-svg :deep(.placeholder) {
  color: #555;
  font-size: 13px;
}

.lb-bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 800px;
}

.lb-status {
  font-size: 13px;
  color: #aaa;
  text-align: center;
}

.lb-actions {
  display: flex;
  gap: 10px;
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

.btn-edit { background: #2b6cb0; color: #bee3f8; }
.btn-clean { background: #276749; color: #9ae6b4; }
.btn-force { background: #9b2c2c; color: #fed7d7; }
.btn-regen { background: #553c9a; color: #d6bcfa; }
.btn-print { background: #2d3748; color: #a0aec0; }
.btn-save-prompt { background: #f39c12; color: #000; }

.prompt-box {
  width: 100%;
  background: rgba(22, 33, 62, 0.95);
  border-radius: 8px;
  padding: 12px 14px;
}

.prompt-label {
  font-size: 12px;
  font-weight: 700;
  color: #f39c12;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.prompt-rule {
  color: #666;
  font-weight: 400;
}

.prompt-box textarea {
  width: 100%;
  min-height: 48px;
  max-height: 100px;
  background: #0d1117;
  color: #ccc;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 8px;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.4;
  resize: vertical;
}

.prompt-box textarea:focus {
  outline: none;
  border-color: #f39c12;
}

.prompt-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
}

.prompt-status {
  font-size: 11px;
  color: #9ae6b4;
}

.prompt-meta {
  font-size: 11px;
  color: #666;
  margin-top: 6px;
}

/* Tabs */
.gallery-tabs {
  display: flex;
  gap: 2px;
}

.tab {
  padding: 4px 14px;
  border: none;
  border-radius: 5px 5px 0 0;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  background: #1a1a2e;
  color: #888;
  transition: background 0.15s, color 0.15s;
}

.tab:hover { color: #ccc; }
.tab-active { background: #16213e; color: #fff; }

/* Font Sizes Panel */
.fs-panel {
  max-width: 1600px;
}

.fs-layout {
  display: grid;
  /* Token table is fixed-narrow; preview takes the rest of the row. */
  grid-template-columns: 420px minmax(0, 1fr);
  gap: 32px;
  align-items: flex-start;
}

.fs-controls {
  min-width: 0;
  position: sticky;
  top: 16px;
}

.fs-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.fs-preview-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.fs-preview-hint {
  font-size: 11px;
  color: #888;
  text-align: right;
  line-height: 1.5;
}

.fs-templates {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 0 12px 0;
  border-bottom: 1px solid #2a2a40;
}

.fs-chip {
  background: #1a1a2e;
  color: #aaa;
  border: 1px solid #333;
  border-radius: 14px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.fs-chip:hover:not(:disabled) {
  color: #fff;
  border-color: #555;
}

.fs-chip:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.fs-chip-active {
  background: #2d2a14;
  color: #f39c12;
  border-color: #f39c12;
}

.fs-chip-count {
  font-size: 10px;
  color: #666;
  font-family: monospace;
}

.fs-chip-active .fs-chip-count {
  color: #f39c12;
}

.fs-preview-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-content: flex-start;
}

.fs-preview-empty {
  color: #555;
  font-size: 13px;
  padding: 30px 0;
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

.btn-cancel { background: #2d3748; color: #a0aec0; }
.btn-force-confirm { background: #9b2c2c; color: #fed7d7; }

.fs-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.fs-status {
  font-size: 12px;
  color: #9ae6b4;
}

.btn-save-fs { background: #276749; color: #9ae6b4; }
.btn-reset-fs { background: #9b2c2c; color: #fed7d7; }

/* Font Family Panel */
.ff-panel { max-width: 720px; }
.ff-help { color: #aaa; font-size: 13px; margin: 0 0 18px 0; line-height: 1.5; }
.ff-presets {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  padding: 12px 0 16px 0; margin-bottom: 12px;
  border-bottom: 1px solid #333;
}
.ff-presets-label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-right: 4px; }
.btn.ff-preset {
  background: #0f3460; color: #e0e0e0; border: 1px solid #444;
  border-radius: 4px; padding: 6px 12px; font-size: 13px; cursor: pointer;
}
.btn.ff-preset:hover { background: #1a4a8a; border-color: #f39c12; }
.ff-row {
  display: grid;
  grid-template-columns: 260px 240px 1fr;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.ff-row label { font-size: 13px; font-weight: 600; color: #ccc; }
.ff-row select {
  background: #0f3460; color: #e0e0e0; border: 1px solid #444;
  border-radius: 4px; padding: 7px 9px; font-size: 13px; outline: none;
}
.ff-row select:focus { border-color: #f39c12; }
.ff-license { font-size: 11px; color: #888; }
.ff-actions { display: flex; gap: 8px; align-items: center; margin: 16px 0 20px 0; }
.ff-preview { border-top: 1px solid #333; padding-top: 16px; }
.ff-preview-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
.ff-preview-card {
  width: 250px; min-height: 350px; background: #0a0a0a;
  border-radius: 6px; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.ff-preview-card :deep(svg) { width: 100%; height: 100%; display: block; }

.fs-table {
  width: 100%;
  border-collapse: collapse;
}

.fs-table th {
  text-align: left;
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 8px;
  border-bottom: 1px solid #333;
}

.fs-table td {
  padding: 3px 8px;
  font-size: 13px;
  color: #ccc;
}

.fs-token {
  font-family: monospace;
  color: #f39c12;
}

.fs-default {
  color: #666;
}

.fs-value input {
  width: 60px;
  background: #0d1117;
  color: #ccc;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 13px;
  text-align: right;
}

.fs-value input:focus {
  outline: none;
  border-color: #f39c12;
}

.fs-overridden .fs-token { color: #4fdedb; }
.fs-edited .fs-value input { border-color: #f39c12; background: #1a1a2e; }
</style>
