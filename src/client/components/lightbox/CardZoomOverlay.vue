<script setup lang="ts">
// Reusable full-screen card zoom overlay with prev/next/close affordances.
// Presentational only — the parent owns which card is shown (via useCardZoom)
// and keyboard handling. Teleported to <body> so it escapes any clipping
// ancestor. Shared by the test-hand panel and (later) the lightbox.
import type { Card } from "../../../shared/types/card.js";
import { zoomImgFor } from "../../lib/hand-display.js";

defineProps<{
  card: Card;
  position: number; // 1-based
  total: number;
}>();

const emit = defineEmits<{ close: []; prev: []; next: [] }>();
</script>

<template>
  <Teleport to="body">
    <div class="card-zoom-backdrop" @click="emit('close')">
      <button class="card-zoom-nav prev" title="Previous card (←)" @click.stop="emit('prev')">‹</button>
      <div class="card-zoom-stage" @click.stop>
        <img
          v-if="card.imageBase"
          :src="zoomImgFor(card)"
          :alt="card.name"
          class="card-zoom-img"
        />
        <div v-else class="card-zoom-fallback">{{ card.name }}</div>
        <div class="card-zoom-caption">
          {{ card.name }}
          <span class="card-zoom-pos">{{ position }} / {{ total }}</span>
        </div>
      </div>
      <button class="card-zoom-nav next" title="Next card (→)" @click.stop="emit('next')">›</button>
      <button class="card-zoom-close" title="Close (Esc)" @click.stop="emit('close')">×</button>
    </div>
  </Teleport>
</template>

<style scoped>
.card-zoom-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}
.card-zoom-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  max-height: 92vh;
}
.card-zoom-img {
  max-height: 82vh;
  max-width: 80vw;
  border-radius: 14px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
}
.card-zoom-fallback {
  width: 320px;
  aspect-ratio: 2.5 / 3.5;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #16213e;
  border: 1px solid #0f3460;
  border-radius: 14px;
  color: #b0b0c0;
  padding: 1rem;
  text-align: center;
}
.card-zoom-caption {
  color: #fff;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.card-zoom-pos {
  color: #b0b0c0;
  font-size: 0.82rem;
}
.card-zoom-nav,
.card-zoom-close {
  background: rgba(22, 33, 62, 0.9);
  color: #fff;
  border: 1px solid #0f3460;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.card-zoom-nav {
  width: 48px;
  height: 48px;
  font-size: 2rem;
}
.card-zoom-nav:hover,
.card-zoom-close:hover {
  background: #e94560;
}
.card-zoom-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 40px;
  height: 40px;
  font-size: 1.5rem;
}
</style>
