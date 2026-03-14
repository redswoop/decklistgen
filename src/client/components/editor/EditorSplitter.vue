<script setup lang="ts">
import { ref } from "vue";

const emit = defineEmits<{
  resize: [deltaY: number];
}>();

const active = ref(false);
let startY = 0;

function onMouseDown(e: MouseEvent) {
  e.preventDefault();
  active.value = true;
  startY = e.clientY;
  document.body.style.cursor = "row-resize";
  document.body.style.userSelect = "none";
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
}

function onMouseMove(e: MouseEvent) {
  emit("resize", e.clientY - startY);
  startY = e.clientY;
}

function onMouseUp() {
  active.value = false;
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseUp);
}
</script>

<template>
  <div class="splitter" :class="{ active }" @mousedown="onMouseDown" />
</template>

<style scoped>
.splitter { height: 6px; background: #1a1a2e; cursor: row-resize; flex-shrink: 0; border-top: 1px solid #333; border-bottom: 1px solid #333; }
.splitter:hover, .splitter.active { background: #4a9eff; }
</style>
