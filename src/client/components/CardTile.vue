<script setup lang="ts">
import { computed } from "vue";
import type { Card } from "../../shared/types/card.js";
import {
  getCardImageUrl,
  hasCleanedImage,
  hasStatusLoaded,
  isGenerating,
  generateCleanImage,
  type ImageMode,
} from "../composables/usePokeproxy.js";

const props = defineProps<{ card: Card; imageMode: ImageMode }>();
const emit = defineEmits<{
  add: [card: Card];
  preview: [card: Card];
}>();

const isOriginalMode = computed(() => props.imageMode === "original");
const cleanUrl = computed(() => getCardImageUrl(props.card, props.imageMode));
const statusLoaded = computed(() => hasStatusLoaded(props.card.id));
const hasCleaned = computed(() => hasCleanedImage(props.card.id));
const generating = computed(() => isGenerating(props.card.id));

const showCleanedImage = computed(() => !isOriginalMode.value && cleanUrl.value);
const showMissingPlaceholder = computed(() => !isOriginalMode.value && statusLoaded.value && !hasCleaned.value);

function handleGenerateClick(e: Event) {
  e.stopPropagation();
  generateCleanImage(props.card.id);
}
</script>

<template>
  <div
    class="card-tile"
    :title="`${card.name} (${card.rarity})`"
    @click="emit('preview', card)"
  >
    <!-- Cleaned image available -->
    <img
      v-if="showCleanedImage"
      :src="cleanUrl!"
      :alt="card.name"
      loading="lazy"
    />
    <!-- Original image (default or fallback) -->
    <img
      v-else-if="card.imageUrl && (isOriginalMode || !statusLoaded)"
      :src="card.imageUrl"
      :alt="card.name"
      loading="lazy"
    />
    <!-- No image placeholder -->
    <div v-else class="tile-placeholder">
      {{ card.name }}
    </div>

    <!-- "Not cleaned" overlay when in cleaned mode but no cleaned version -->
    <div v-if="showMissingPlaceholder" class="tile-missing-overlay" @click.stop="handleGenerateClick">
      <div v-if="generating" class="tile-spinner"></div>
      <template v-else>
        <div class="tile-missing-icon">+</div>
        <div class="tile-missing-text">Generate</div>
      </template>
    </div>

    <div class="card-name">{{ card.name }}</div>
    <button
      class="card-add-btn"
      title="Add to decklist"
      @click.stop="emit('add', card)"
    >+</button>
  </div>
</template>
