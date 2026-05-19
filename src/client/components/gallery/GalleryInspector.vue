<script setup lang="ts">
import CardInspectorPanel from "./CardInspectorPanel.vue";
import FleetOverviewPanel from "./FleetOverviewPanel.vue";
import type { GalleryCard } from "../../composables/useGalleryCardSource.js";

const props = defineProps<{
  activeCard: GalleryCard | null;
  cards: GalleryCard[] | null;
  thumbWidth: number;
  /** Per-card cache-bust resolver — see GalleryGrid for the rationale. */
  svgRevFor: (cardId: string) => number;
  imageCacheBust: number;
  busy: boolean;
  status: string;
  promptSaveStatus: string;
}>();

const emit = defineEmits<{
  close: [];
  edit: [cardId: string];
  clean: [force: boolean];
  regen: [];
  "save-prompt": [text: string];
  select: [cardId: string];
  /** Fires with the affected cardId so the parent can bump just that card. */
  "text-mode-changed": [cardId: string];
}>();
</script>

<template>
  <div class="gallery-inspector">
    <CardInspectorPanel
      v-if="activeCard"
      :card="activeCard"
      :thumb-width="thumbWidth"
      :svg-cache-bust="svgRevFor(activeCard.cardId)"
      :image-cache-bust="imageCacheBust"
      :busy="busy"
      :status="status"
      :prompt-save-status="promptSaveStatus"
      @close="emit('close')"
      @edit="(id: string) => emit('edit', id)"
      @clean="(force: boolean) => emit('clean', force)"
      @regen="emit('regen')"
      @save-prompt="(text: string) => emit('save-prompt', text)"
      @text-mode-changed="emit('text-mode-changed', activeCard.cardId)"
    />
    <FleetOverviewPanel
      v-else-if="cards"
      :cards="cards"
      @select="(id: string) => emit('select', id)"
    />
  </div>
</template>

<style scoped>
.gallery-inspector {
  position: sticky;
  top: 16px;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
}
</style>
