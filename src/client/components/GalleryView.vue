<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { api } from "../lib/client.js";

interface GalleryCard {
  label: string;
  cardId: string;
  name: string;
  category: string;
  stage: string | null;
  hp: number | null;
  rarity: string | null;
  energyTypes: string[];
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

const { data: cards, isLoading, refetch } = useQuery<GalleryCard[]>({
  queryKey: ["gallery-cards"],
  queryFn: () => api.galleryCards(),
  staleTime: 60_000,
});

const cacheBust = ref(Date.now());

// SVG inline content cache: cardId → html string
const svgCache = ref<Record<string, string>>({});

async function loadSvg(cardId: string) {
  try {
    const resp = await fetch(`/api/pokeproxy/svg/${cardId}?t=${cacheBust.value}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    svgCache.value[cardId] = await resp.text();
  } catch (e: any) {
    svgCache.value[cardId] = `<span style="color:#666;font-size:12px">Failed: ${e.message}</span>`;
  }
}

// Load SVGs when card list arrives (immediate: handles cached data on remount)
watch(cards, (list) => {
  if (!list) return;
  for (const card of list) {
    if (!svgCache.value[card.cardId]) loadSvg(card.cardId);
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
  return `/api/pokeproxy/image/${cardId}/composite?t=${cacheBust.value}`;
}

async function loadLightboxSvg(cardId: string) {
  lightboxSvg.value = "";
  try {
    const resp = await fetch(`/api/pokeproxy/svg/${cardId}?t=${cacheBust.value}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    lightboxSvg.value = await resp.text();
  } catch (e: any) {
    lightboxSvg.value = `<span style="color:#888">Failed: ${e.message}</span>`;
  }
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

async function pollJob(jobId: string): Promise<void> {
  while (true) {
    await new Promise(r => setTimeout(r, 2000));
    const job = await api.queueGet(jobId);
    if (job.status === "completed") return;
    if (job.status === "failed") throw new Error((job as any).error || "Generation failed");
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
    cacheBust.value = Date.now();
    card.hasClean = true;
    card.hasComposite = true;
    // Reload SVGs
    loadLightboxSvg(card.cardId);
    loadSvg(card.cardId);
    await refetch();
    lightboxStatus.value = "Done";
  } catch (e: any) {
    lightboxStatus.value = `Error: ${e.message}`;
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
    cacheBust.value = Date.now();
    loadLightboxSvg(cardId);
    loadSvg(cardId);
    lightboxStatus.value = "SVG updated";
  } catch (e: any) {
    lightboxStatus.value = `Error: ${e.message}`;
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
  } catch (e: any) {
    promptSaveStatus.value = `Error: ${e.message}`;
  }
}

const cardCount = computed(() => cards.value?.length ?? 0);

// --- Font sizes tab ---
type GalleryTab = "cards" | "font-sizes";
const activeTab = ref<GalleryTab>("cards");

const fontSizeDefaults = ref<Record<string, number>>({});
const fontSizeOverrides = ref<Record<string, number>>({});
const fontSizeEdited = ref<Record<string, string>>({});
const fontSizeLoading = ref(false);
const fontSizeStatus = ref("");

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
  } catch (e: any) {
    fontSizeStatus.value = `Error: ${e.message}`;
  } finally {
    fontSizeLoading.value = false;
  }
}

watch(activeTab, (tab) => {
  if (tab === "font-sizes" && Object.keys(fontSizeDefaults.value).length === 0) {
    loadFontSizes();
  }
});

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
  } catch (e: any) {
    fontSizeStatus.value = `Error: ${e.message}`;
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
  } catch (e: any) {
    fontSizeStatus.value = `Error: ${e.message}`;
  }
}

function editInEditor(cardId: string) {
  window.location.hash = `#/editor/${cardId}`;
}

function openPrint() {
  const svgs = Object.values(svgCache.value).filter(s => s.startsWith("<svg"));
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
      </div>
      <span v-if="activeTab === 'cards'" class="gallery-count">{{ cardCount }} test cards</span>
      <button v-if="activeTab === 'cards'" class="btn btn-print" @click="openPrint" :disabled="Object.keys(svgCache).length === 0" title="Open print sheet in new tab">Print</button>
    </div>

    <!-- Font Sizes Tab -->
    <div v-if="activeTab === 'font-sizes'" class="fs-panel">
      <div v-if="fontSizeLoading" class="gallery-loading">Loading font sizes...</div>
      <template v-else>
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
            <tr v-for="key in Object.keys(fontSizeDefaults)" :key="key" :class="{ 'fs-overridden': fontSizeIsOverridden(key), 'fs-edited': fontSizeIsEdited(key) }">
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
      </template>
    </div>

    <!-- Cards Tab -->
    <div v-if="activeTab === 'cards' && isLoading" class="gallery-loading">Loading cards...</div>

    <div v-else-if="activeTab === 'cards'" class="gallery-grid">
      <div
        v-for="card in cards"
        :key="card.cardId"
        class="gallery-card"
        @click="openLightbox(card)"
      >
        <div class="card-label">{{ card.label }}</div>
        <div class="card-name">{{ card.name }}</div>
        <div class="card-id">{{ card.cardId }}</div>
        <div class="card-badges">
          <span v-if="card.hasClean" :class="['badge', card.isFullArt ? 'badge-clean' : 'badge-expanded']">
            {{ card.isFullArt ? 'CLEANED' : 'EXPANDED' }}
          </span>
          <span :class="['badge', card.isFullArt ? 'badge-fullart' : 'badge-standard']">
            {{ card.isFullArt ? 'FULLART' : 'STANDARD' }}
          </span>
        </div>
        <div class="card-meta">{{ metaLine(card) }}</div>
        <div class="card-thumb" v-html="svgCache[card.cardId] || '<span class=placeholder>Loading SVG...</span>'" />
      </div>
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

.gallery-card {
  background: #16213e;
  border-radius: 10px;
  padding: 12px;
  width: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}

.gallery-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.card-label {
  font-weight: 700;
  font-size: 13px;
  color: #f39c12;
  margin-bottom: 2px;
}

.card-name {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
}

.card-id {
  font-size: 11px;
  color: #666;
  margin-bottom: 4px;
}

.card-badges {
  display: flex;
  gap: 5px;
  margin-bottom: 4px;
}

.badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.badge-standard { background: #2d3748; color: #a0aec0; }
.badge-fullart { background: #553c9a; color: #d6bcfa; }
.badge-clean { background: #276749; color: #9ae6b4; }
.badge-expanded { background: #2b6cb0; color: #bee3f8; }

.card-meta {
  font-size: 11px;
  color: #888;
  text-align: center;
  margin-bottom: 6px;
  line-height: 1.4;
}

.card-thumb {
  width: 230px;
  height: 322px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  overflow: hidden;
}

.card-thumb :deep(svg) {
  width: 100%;
  height: 100%;
}

.card-thumb :deep(.placeholder) {
  color: #555;
  font-size: 13px;
}

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
  max-width: 600px;
}

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
