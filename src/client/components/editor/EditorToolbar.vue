<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useEditorApi } from "../../composables/useEditorApi.js";
import type { TemplateSetSummary, CardEntry } from "../../composables/useEditorApi.js";
import { useEditorRenderer } from "../../composables/useEditorRenderer.js";
import { useEditorViewport } from "../../composables/useEditorViewport.js";
import { useEditorState } from "../../composables/useEditorState.js";

const props = defineProps<{ sidebarOpen: boolean }>();

const api = useEditorApi();
const { loadCard } = useEditorRenderer();
const { zoomPercent, setZoom } = useEditorViewport();
const {
  elements,
  currentTemplateId,
  currentTemplateName,
  currentSetId,
  templateDirty,
  applyBindings,
  cardData,
  currentCardId,
  setStatus,
} = useEditorState();
const { rerender } = useEditorRenderer();

const allCards = ref<CardEntry[]>([]);
const selectedCard = ref("");
const sets = ref<TemplateSetSummary[]>([]);
const selectedTemplate = ref("");
const sortBy = ref<"id" | "name">("name");

const showForkPanel = ref(false);
const forkId = ref("");
const forkName = ref("");

const currentSet = computed(() => sets.value.find(s => s.id === currentSetId.value));
const slotIds = computed(() => currentSet.value?.slotIds ?? []);

/** Cards filtered by the selected template, then sorted */
const filteredCards = computed(() => {
  let cards = selectedTemplate.value
    ? allCards.value.filter(c => c.suggestedTemplate === selectedTemplate.value)
    : allCards.value;
  if (sortBy.value === "name") {
    cards = [...cards].sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
  }
  return cards;
});

const emit = defineEmits<{
  fit: [];
  "toggle-sidebar": [];
}>();

onMounted(async () => {
  const [cardList, setList] = await Promise.all([
    api.fetchCards(),
    api.listSets(),
  ]);
  allCards.value = cardList;
  sets.value = setList;

  // Restore card from URL hash (e.g., #/editor/sv4-123)
  const match = location.hash.match(/^#\/editor\/(.+)$/);
  if (match) {
    const card = allCards.value.find(c => c.id === match[1]);
    if (card) {
      selectedCard.value = card.id;
      // Auto-select template slot if one isn't loaded yet
      if (card.suggestedTemplate && !currentTemplateId.value) {
        selectedTemplate.value = card.suggestedTemplate;
        await onTemplatePicked();
      }
      await onCardPicked(false);
    }
  }
});

async function onCardPicked(updateHash = true) {
  if (!selectedCard.value) return;
  if (updateHash) {
    history.replaceState(null, "", `#/editor/${selectedCard.value}`);
  }
  await loadCard(selectedCard.value);
}

function prevCard() {
  const cards = filteredCards.value;
  const idx = cards.findIndex(c => c.id === selectedCard.value);
  if (idx > 0) {
    selectedCard.value = cards[idx - 1].id;
    onCardPicked();
  }
}

function nextCard() {
  const cards = filteredCards.value;
  const idx = cards.findIndex(c => c.id === selectedCard.value);
  if (idx >= 0 && idx < cards.length - 1) {
    selectedCard.value = cards[idx + 1].id;
    onCardPicked();
  }
}

const hasPrev = computed(() => {
  const idx = filteredCards.value.findIndex(c => c.id === selectedCard.value);
  return idx > 0;
});

const hasNext = computed(() => {
  const cards = filteredCards.value;
  const idx = cards.findIndex(c => c.id === selectedCard.value);
  return idx >= 0 && idx < cards.length - 1;
});

async function onSetPicked() {
  // Clear the loaded template — its slot may not exist in the new set.
  selectedTemplate.value = "";
  currentTemplateId.value = null;
  currentTemplateName.value = "";
  templateDirty.value = false;
}

function onForkOpen() {
  forkId.value = "";
  forkName.value = currentSet.value ? `${currentSet.value.name} (copy)` : "";
  showForkPanel.value = true;
}

function onForkNameInput() {
  // Auto-slug id when the user hasn't typed one yet
  if (!forkId.value || forkId.value === slugify(forkName.value)) {
    forkId.value = slugify(forkName.value);
  }
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function onForkSubmit() {
  const id = slugify(forkId.value);
  const name = forkName.value.trim();
  if (!id || !name) { setStatus("ID and name required"); return; }
  const result = await api.forkSet(currentSetId.value, { id, name });
  if (!result.ok) {
    setStatus(`Fork failed: ${result.error ?? `HTTP ${result.status}`}`);
    return;
  }
  sets.value = await api.listSets();
  currentSetId.value = id;
  selectedTemplate.value = "";
  currentTemplateId.value = null;
  currentTemplateName.value = "";
  templateDirty.value = false;
  showForkPanel.value = false;
  setStatus(`Forked to: ${name}`);
}

function onForkCancel() {
  showForkPanel.value = false;
}

function onExportSet() {
  if (!currentSet.value) return;
  window.location.href = api.exportSetUrl(currentSetId.value);
}

const importFileInput = ref<HTMLInputElement | null>(null);

function onImportClick() {
  importFileInput.value?.click();
}

async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  let bundle: unknown;
  try {
    bundle = JSON.parse(await file.text());
  } catch {
    setStatus("Import failed: not valid JSON");
    return;
  }
  let result = await api.importSet(bundle);
  // If the bundle's id collides with an existing set, prompt for an override
  if (!result.ok && result.status === 409) {
    const override = window.prompt(
      `A set with this id already exists. Enter a new id for the imported set (leave blank to cancel):`,
    );
    if (!override) {
      input.value = "";
      return;
    }
    result = await api.importSet(bundle, override);
  }
  input.value = ""; // allow re-importing same file
  if (!result.ok) {
    setStatus(`Import failed: ${result.error ?? `HTTP ${result.status}`}`);
    return;
  }
  sets.value = await api.listSets();
  if (result.id) currentSetId.value = result.id;
  selectedTemplate.value = "";
  currentTemplateId.value = null;
  currentTemplateName.value = "";
  templateDirty.value = false;
  setStatus(`Imported: ${result.id}`);
}

async function onDeleteSet() {
  if (!currentSet.value || currentSet.value.origin !== "user") return;
  const ok = window.confirm(
    `Delete user set "${currentSet.value.name}"? This is permanent and cannot be undone.`,
  );
  if (!ok) return;
  const result = await api.deleteSet(currentSetId.value);
  if (!result.ok) {
    setStatus(`Delete failed: ${result.error ?? `HTTP ${result.status}`}`);
    return;
  }
  sets.value = await api.listSets();
  currentSetId.value = "default";
  selectedTemplate.value = "";
  currentTemplateId.value = null;
  currentTemplateName.value = "";
  templateDirty.value = false;
  setStatus("Deleted");
}

function onForkKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") onForkSubmit();
  else if (e.key === "Escape") onForkCancel();
}

async function onTemplatePicked() {
  if (!selectedTemplate.value) return;
  const tmpl = await api.loadSlotTemplate(currentSetId.value, selectedTemplate.value);
  if (!tmpl) {
    setStatus("Failed to load template");
    return;
  }
  elements.value = tmpl.elements;
  currentTemplateId.value = tmpl.id;
  currentTemplateName.value = tmpl.name;
  templateDirty.value = false;

  if (cardData.value) {
    applyBindings();
  }
  rerender();
  setStatus(`Loaded: ${tmpl.name}`);
}

function onZoomInput(e: Event) {
  setZoom(parseInt((e.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-row toolbar-pickers">
      <label>Card:</label>
      <button class="nav-btn" :disabled="!hasPrev" @click="prevCard" title="Previous card">&lsaquo;</button>
      <select v-model="selectedCard" @change="onCardPicked()">
        <option value="">-- pick a card ({{ filteredCards.length }}) --</option>
        <option v-for="card in filteredCards" :key="card.id" :value="card.id">{{ card.name ? `${card.name} (${card.id})` : card.id }}</option>
      </select>
      <button class="nav-btn" :disabled="!hasNext" @click="nextCard" title="Next card">&rsaquo;</button>
      <select v-model="sortBy" class="sort-select" title="Sort cards by">
        <option value="name">A-Z</option>
        <option value="id">ID</option>
      </select>

      <div class="sep" />

      <label>Set:</label>
      <select v-model="currentSetId" @change="onSetPicked" :title="currentSet?.origin === 'builtin' ? 'Built-in set (ships with the app)' : 'User set (in data volume)'">
        <option v-for="s in sets" :key="s.id" :value="s.id">{{ s.name }}{{ s.origin === 'user' ? ' (user)' : '' }}{{ s.hasShadow ? ' ⚠' : '' }}</option>
      </select>
      <button class="set-action-btn" @click="onForkOpen" :disabled="!currentSet" title="Fork this set into a new user set">Fork</button>
      <button
        class="set-action-btn"
        @click="onExportSet"
        :disabled="!currentSet"
        title="Download this set as a JSON bundle"
      >Export</button>
      <button class="set-action-btn" @click="onImportClick" title="Import a set bundle">Import</button>
      <input
        ref="importFileInput"
        type="file"
        accept="application/json,.json"
        style="display: none"
        @change="onImportFile"
      />
      <button
        class="set-action-btn danger"
        @click="onDeleteSet"
        :disabled="!currentSet || currentSet.origin !== 'user'"
        :title="currentSet?.origin === 'user' ? 'Delete this user set' : 'Built-in sets cannot be deleted'"
      >Delete</button>

      <label>Slot:</label>
      <select v-model="selectedTemplate" @change="onTemplatePicked">
        <option value="">-- pick a slot --</option>
        <option v-for="slot in slotIds" :key="slot" :value="slot">{{ slot }}</option>
      </select>
      <span v-if="currentTemplateName" class="template-name">
        {{ currentTemplateName }}
        <span v-if="templateDirty" class="dirty-dot" title="Unsaved changes">*</span>
      </span>

      <div v-if="showForkPanel" class="fork-panel">
        <label>Name:</label>
        <input type="text" v-model="forkName" @input="onForkNameInput" @keydown="onForkKeydown" placeholder="My Fork" autofocus />
        <label>ID:</label>
        <input type="text" v-model="forkId" @keydown="onForkKeydown" placeholder="my-fork" />
        <button class="fork-save-btn" @click="onForkSubmit">Fork</button>
        <button class="fork-cancel-btn" @click="onForkCancel">Cancel</button>
      </div>
    </div>

    <div class="spacer" />

    <div class="toolbar-row toolbar-actions">
      <div class="zoom-control">
        <input type="range" min="20" max="200" step="5" :value="zoomPercent" @input="onZoomInput" />
        <span>{{ zoomPercent }}%</span>
        <button @click="$emit('fit')">Fit</button>
      </div>
      <button class="sidebar-toggle" @click="$emit('toggle-sidebar')" :title="sidebarOpen ? 'Hide panel' : 'Show panel'">
        {{ sidebarOpen ? '&#x2715;' : '&#x2630;' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.toolbar { padding: 6px 12px; background: #16213e; border-bottom: 1px solid #333; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toolbar-row { display: flex; align-items: center; gap: 8px; }
.toolbar-pickers { flex-wrap: wrap; min-width: 0; }
.spacer { flex: 1; }
.sep { width: 1px; height: 20px; background: #444; flex-shrink: 0; }
.zoom-control { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.zoom-control input[type="range"] { width: 100px; accent-color: #4a9eff; }
.zoom-control span { font-size: 11px; color: #888; min-width: 32px; text-align: right; }
.zoom-control button { background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 3px 8px; font-size: 11px; cursor: pointer; }
.zoom-control button:hover { background: #1a5276; }
.toolbar label { font-size: 12px; color: #aaa; flex-shrink: 0; }
.toolbar select { background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 4px; padding: 4px 6px; font-size: 13px; min-width: 0; max-width: 180px; }
.sort-select { max-width: 60px !important; font-size: 11px !important; padding: 3px 4px !important; }
.nav-btn { background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 2px 8px; font-size: 18px; line-height: 1; cursor: pointer; flex-shrink: 0; }
.nav-btn:hover:not(:disabled) { background: #1a5276; }
.nav-btn:disabled { opacity: 0.3; cursor: default; }
.template-name { font-size: 12px; color: #4a9eff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
.dirty-dot { color: #e88; font-weight: bold; }
.sidebar-toggle { display: none; background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 4px 10px; font-size: 16px; cursor: pointer; line-height: 1; flex-shrink: 0; }
.sidebar-toggle:hover { background: #1a5276; }
.set-action-btn { background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 3px 10px; font-size: 11px; cursor: pointer; flex-shrink: 0; }
.set-action-btn:hover:not(:disabled) { background: #1a5276; }
.set-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.set-action-btn.danger { color: #e88; border-color: #744; }
.set-action-btn.danger:hover:not(:disabled) { background: #3a1a1a; }
.fork-panel { display: flex; align-items: center; gap: 6px; background: #0a1e3d; padding: 6px 10px; border-radius: 4px; border: 1px solid #4a9eff; flex-wrap: wrap; }
.fork-panel label { font-size: 11px; color: #888; }
.fork-panel input { width: 120px; background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 3px 6px; font-size: 12px; min-width: 0; }
.fork-save-btn { background: #1a5276; color: #e0e0e0; border: 1px solid #4a9eff; border-radius: 3px; padding: 3px 10px; font-size: 11px; cursor: pointer; }
.fork-cancel-btn { background: #3a1a1a; color: #e88; border: 1px solid #744; border-radius: 3px; padding: 3px 10px; font-size: 11px; cursor: pointer; }

@media (max-width: 768px) {
  .toolbar { padding: 6px 8px; gap: 6px; }
  .toolbar select { max-width: 140px; font-size: 12px; padding: 5px 4px; }
  .sep { display: none; }
  .zoom-control input[type="range"] { width: 70px; }
  .sidebar-toggle { display: block; }
  .template-name { max-width: 90px; }
}

@media (max-width: 480px) {
  .toolbar select { max-width: 110px; }
  .toolbar label { display: none; }
  .template-name { display: none; }
  .zoom-control span { display: none; }
  .zoom-control input[type="range"] { width: 60px; }
}
</style>
