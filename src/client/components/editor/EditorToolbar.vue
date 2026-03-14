<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useEditorApi } from "../../composables/useEditorApi.js";
import { useEditorRenderer } from "../../composables/useEditorRenderer.js";
import { useEditorViewport } from "../../composables/useEditorViewport.js";

const api = useEditorApi();
const { loadCard } = useEditorRenderer();
const { zoomPercent, setZoom } = useEditorViewport();

const cards = ref<string[]>([]);
const selectedCard = ref("");

const emit = defineEmits<{
  fit: [];
}>();

onMounted(async () => {
  cards.value = await api.fetchCards();
  // Restore card from URL hash (e.g., #/editor/sv4-123)
  const match = location.hash.match(/^#\/editor\/(.+)$/);
  if (match && cards.value.includes(match[1])) {
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

function onZoomInput(e: Event) {
  setZoom(parseInt((e.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="toolbar">
    <label>Card:</label>
    <select v-model="selectedCard" @change="onCardPicked">
      <option value="">-- pick a card --</option>
      <option v-for="card in cards" :key="card" :value="card">{{ card }}</option>
    </select>
    <div class="spacer" />
    <div class="zoom-control">
      <label>Zoom</label>
      <input type="range" min="20" max="200" step="5" :value="zoomPercent" @input="onZoomInput" />
      <span>{{ zoomPercent }}%</span>
      <button @click="$emit('fit')">Fit</button>
    </div>
  </div>
</template>

<style scoped>
.toolbar { padding: 8px 16px; background: #16213e; border-bottom: 1px solid #333; display: flex; align-items: center; gap: 12px; }
.spacer { flex: 1; }
.zoom-control { display: flex; align-items: center; gap: 6px; }
.zoom-control input[type="range"] { width: 120px; accent-color: #4a9eff; }
.zoom-control span { font-size: 11px; color: #888; min-width: 32px; text-align: right; }
.zoom-control button { background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 3px 8px; font-size: 11px; cursor: pointer; }
.zoom-control button:hover { background: #1a5276; }
.toolbar label { font-size: 13px; color: #aaa; }
.toolbar select { background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 4px; padding: 4px 8px; font-size: 13px; }
</style>
