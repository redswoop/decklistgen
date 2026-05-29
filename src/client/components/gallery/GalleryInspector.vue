<script setup lang="ts">
import CardInspectorPanel from "./CardInspectorPanel.vue";
import FleetOverviewPanel from "./FleetOverviewPanel.vue";
import type { GalleryCard } from "../../composables/useGalleryCardSource.js";

defineProps<{
  activeCard: GalleryCard | null;
  cards: GalleryCard[] | null;
  thumbWidth: number;
  imageCacheBust: number;
  busy: boolean;
  status: string;
  promptSaveStatus: string;
}>();

const emit = defineEmits<{
  close: [];
  clean: [force: boolean];
  "save-prompt": [text: string];
  select: [cardId: string];
}>();
</script>

<template>
  <div class="gallery-inspector">
    <CardInspectorPanel
      v-if="activeCard"
      :card="activeCard"
      :thumb-width="thumbWidth"
      :image-cache-bust="imageCacheBust"
      :busy="busy"
      :status="status"
      :prompt-save-status="promptSaveStatus"
      @close="emit('close')"
      @clean="(force: boolean) => emit('clean', force)"
      @save-prompt="(text: string) => emit('save-prompt', text)"
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
