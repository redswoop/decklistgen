<script setup lang="ts">
import { ref } from "vue";
import ElementTree from "./ElementTree.vue";
import EditorSplitter from "./EditorSplitter.vue";
import PropertiesPanel from "./PropertiesPanel.vue";

const treeHeight = ref<number | null>(null);

function onSplitterResize(deltaY: number) {
  const current = treeHeight.value ?? 200;
  treeHeight.value = Math.max(80, current + deltaY);
}
</script>

<template>
  <div class="sidebar">
    <div class="tree-panel" :style="treeHeight ? { height: treeHeight + 'px', flex: 'none' } : {}">
      <h3>Elements</h3>
      <ElementTree />
    </div>
    <EditorSplitter @resize="onSplitterResize" />
    <div class="props-panel-wrap">
      <h3>Properties</h3>
      <PropertiesPanel />
    </div>
  </div>
</template>

<style scoped>
.sidebar { width: 280px; background: #16213e; border-left: 1px solid #333; display: flex; flex-direction: column; overflow: hidden; }
.sidebar h3 { font-size: 13px; text-transform: uppercase; color: #888; padding: 12px 12px 6px; letter-spacing: 1px; flex-shrink: 0; }
.tree-panel { display: flex; flex-direction: column; height: 50%; min-height: 80px; overflow: hidden; }
.props-panel-wrap { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 80px; }
</style>
