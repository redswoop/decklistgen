<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

defineProps<{
  imageUrl: string;
  alt: string;
}>();
const emit = defineEmits<{ close: [] }>();

const scale = ref(1);
const translateX = ref(0);
const translateY = ref(0);
const dragging = ref(false);
let lastX = 0;
let lastY = 0;

function onWheel(e: WheelEvent) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.2 : 0.2;
  scale.value = Math.min(4, Math.max(1, scale.value + delta));
  if (scale.value <= 1) {
    translateX.value = 0;
    translateY.value = 0;
  }
}

function onPointerDown(e: PointerEvent) {
  if (scale.value <= 1) return;
  dragging.value = true;
  lastX = e.clientX;
  lastY = e.clientY;
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return;
  translateX.value += e.clientX - lastX;
  translateY.value += e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
}

function onPointerUp() {
  dragging.value = false;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.stopImmediatePropagation();
    emit("close");
  }
}

function onBgClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains("zoom-overlay")) {
    emit("close");
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="zoom-overlay" @click="onBgClick" @wheel.prevent="onWheel">
    <img
      :src="imageUrl"
      :alt="alt"
      class="zoom-img"
      :class="{ dragging }"
      :style="{
        transform: `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`,
        cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in',
      }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      draggable="false"
    />
    <button class="zoom-close" @click="emit('close')">&times;</button>
    <div class="zoom-hint">Scroll to zoom · Drag to pan · Esc to close</div>
  </div>
</template>

<style scoped>
.zoom-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.zoom-img {
  max-width: 90vw;
  max-height: 90vh;
  border-radius: 12px;
  user-select: none;
  transition: transform 0.1s ease-out;
}

.zoom-img.dragging {
  transition: none;
}

.zoom-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.zoom-close:hover {
  background: rgba(233, 69, 96, 0.8);
}

.zoom-hint {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  pointer-events: none;
}
</style>
