<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import EditorToolbar from "./EditorToolbar.vue";
import EditorCanvas from "./EditorCanvas.vue";
import EditorSidebar from "./EditorSidebar.vue";
import EditorBottomBar from "./EditorBottomBar.vue";
import { useEditorState } from "../../composables/useEditorState.js";
import { useEditorRenderer } from "../../composables/useEditorRenderer.js";
import { useEditorViewport } from "../../composables/useEditorViewport.js";
import { useEditorKeyboard } from "../../composables/useEditorKeyboard.js";
import { useEditorApi } from "../../composables/useEditorApi.js";

const { elements, currentTemplateId, currentTemplateName, templateDirty } = useEditorState();
const { onFit } = useEditorRenderer();
const { zoomToFit, onSpaceDown, onSpaceUp } = useEditorViewport();
const { onKeyDown } = useEditorKeyboard();
const api = useEditorApi();

const canvas = ref<InstanceType<typeof EditorCanvas> | null>(null);
const sidebarOpen = ref(false);

onMounted(async () => {
  if (elements.value.length === 0) {
    const tmpl = await api.loadTemplate("pokemon-fullart");
    if (tmpl) {
      elements.value = tmpl.elements;
      currentTemplateId.value = tmpl.id;
      currentTemplateName.value = tmpl.name;
      templateDirty.value = false;
    }
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keydown", onSpaceDown);
  window.addEventListener("keyup", onSpaceUp);

  onFit(() => {
    zoomToFit(canvas.value?.cardsInner ?? null, canvas.value?.cardsArea ?? null);
  });
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keydown", onSpaceDown);
  window.removeEventListener("keyup", onSpaceUp);
});

function handleFit() {
  zoomToFit(canvas.value?.cardsInner ?? null, canvas.value?.cardsArea ?? null);
}
</script>

<template>
  <div class="editor-view">
    <EditorToolbar @fit="handleFit" @toggle-sidebar="sidebarOpen = !sidebarOpen" :sidebar-open="sidebarOpen" />
    <div class="main">
      <EditorCanvas ref="canvas" />
      <div class="sidebar-overlay" v-if="sidebarOpen" @click="sidebarOpen = false" />
      <EditorSidebar :class="{ open: sidebarOpen }" />
    </div>
    <EditorBottomBar />
  </div>
</template>

<style scoped>
.editor-view { display: flex; flex-direction: column; height: 100%; background: #1a1a2e; color: #e0e0e0; }
.main { flex: 1; display: flex; overflow: hidden; position: relative; }
.sidebar-overlay { display: none; }

@media (max-width: 768px) {
  .sidebar-overlay { display: block; position: absolute; inset: 0; background: rgba(0,0,0,0.5); z-index: 9; }
}
</style>
