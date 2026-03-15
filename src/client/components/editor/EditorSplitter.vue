<script setup lang="ts">
import { ref, onUnmounted } from "vue";

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

function onTouchStart(e: TouchEvent) {
  if (e.touches.length !== 1) return;
  e.preventDefault();
  active.value = true;
  startY = e.touches[0].clientY;
  document.body.style.userSelect = "none";
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd);
}

function onTouchMove(e: TouchEvent) {
  e.preventDefault();
  if (e.touches.length !== 1) return;
  emit("resize", e.touches[0].clientY - startY);
  startY = e.touches[0].clientY;
}

function onTouchEnd() {
  active.value = false;
  document.body.style.userSelect = "";
  window.removeEventListener("touchmove", onTouchMove);
  window.removeEventListener("touchend", onTouchEnd);
}

onUnmounted(() => {
  if (active.value) {
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
  }
});
</script>

<template>
  <div class="splitter" :class="{ active }" @mousedown="onMouseDown" @touchstart="onTouchStart" />
</template>

<style scoped>
.splitter { height: 6px; background: #1a1a2e; cursor: row-resize; flex-shrink: 0; border-top: 1px solid #333; border-bottom: 1px solid #333; }
.splitter:hover, .splitter.active { background: #4a9eff; }

@media (max-width: 768px) {
  .splitter { height: 12px; }
}
</style>
