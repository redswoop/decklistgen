<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useEditorApi } from "../../composables/useEditorApi.js";
import type { TemplateSummary, CardEntry } from "../../composables/useEditorApi.js";
import { useEditorRenderer } from "../../composables/useEditorRenderer.js";
import { useEditorViewport } from "../../composables/useEditorViewport.js";
import { useEditorState } from "../../composables/useEditorState.js";

const props = defineProps<{ sidebarOpen: boolean }>();

const api = useEditorApi();
const { loadCard } = useEditorRenderer();
const { zoomPercent, setZoom } = useEditorViewport();
const { elements, currentTemplateId, currentTemplateName, templateDirty, applyBindings, cardData, currentCardId, setStatus } = useEditorState();
const { rerender } = useEditorRenderer();

const allCards = ref<CardEntry[]>([]);
const selectedCard = ref("");
const templates = ref<TemplateSummary[]>([]);
const selectedTemplate = ref("");

/** Cards filtered by the selected template */
const filteredCards = computed(() => {
  if (!selectedTemplate.value) return allCards.value;
  return allCards.value.filter(c => c.suggestedTemplate === selectedTemplate.value);
});

const emit = defineEmits<{
  fit: [];
  "toggle-sidebar": [];
}>();

onMounted(async () => {
  const [cardList, templateList] = await Promise.all([
    api.fetchCards(),
    api.listTemplates(),
  ]);
  allCards.value = cardList;
  templates.value = templateList;

  // Restore card from URL hash (e.g., #/editor/sv4-123)
  const match = location.hash.match(/^#\/editor\/(.+)$/);
  if (match && allCards.value.some(c => c.id === match[1])) {
    selectedCard.value = match[1];
    onCardPicked(false);
  }
});

async function onCardPicked(updateHash = true) {
  if (!selectedCard.value) return;
  if (updateHash) {
    history.replaceState(null, "", `#/editor/${selectedCard.value}`);
  }
  await loadCard(selectedCard.value);
}

async function onTemplatePicked() {
  if (!selectedTemplate.value) return;
  const tmpl = await api.loadTemplate(selectedTemplate.value);
  if (!tmpl) {
    setStatus("Failed to load template");
    return;
  }
  elements.value = tmpl.elements;
  currentTemplateId.value = tmpl.id;
  currentTemplateName.value = tmpl.name;
  templateDirty.value = false;

  // Re-apply bindings if we have card data loaded
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
      <select v-model="selectedCard" @change="onCardPicked()">
        <option value="">-- pick a card ({{ filteredCards.length }}) --</option>
        <option v-for="card in filteredCards" :key="card.id" :value="card.id">{{ card.name ? `${card.name} (${card.id})` : card.id }}</option>
      </select>

      <div class="sep" />

      <label>Tmpl:</label>
      <select v-model="selectedTemplate" @change="onTemplatePicked">
        <option value="">-- pick a template --</option>
        <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>
      <span v-if="currentTemplateName" class="template-name">
        {{ currentTemplateName }}
        <span v-if="templateDirty" class="dirty-dot" title="Unsaved changes">*</span>
      </span>
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
.template-name { font-size: 12px; color: #4a9eff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
.dirty-dot { color: #e88; font-weight: bold; }
.sidebar-toggle { display: none; background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 4px 10px; font-size: 16px; cursor: pointer; line-height: 1; flex-shrink: 0; }
.sidebar-toggle:hover { background: #1a5276; }

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
