<script setup lang="ts">
import { computed } from "vue";
import type { Card } from "../../shared/types/card.js";
import { getCardImageUrl, type ImageMode } from "../composables/usePokeproxy.js";

const props = defineProps<{ card: Card; imageMode: ImageMode }>();
const emit = defineEmits<{
  add: [card: Card];
  preview: [card: Card];
}>();

const imgSrc = computed(() => getCardImageUrl(props.card, props.imageMode));

function onImgError(e: Event) {
  // Fall back to original image if pokeproxy image not available
  const img = e.target as HTMLImageElement;
  if (props.imageMode !== "original" && img.src !== props.card.imageUrl) {
    img.src = props.card.imageUrl;
  }
}
</script>

<template>
  <div
    class="card-tile"
    :title="`${card.name} (${card.rarity})`"
    @click="emit('preview', card)"
  >
    <img
      v-if="imgSrc"
      :src="imgSrc"
      :alt="card.name"
      loading="lazy"
      @error="onImgError"
    />
    <div
      v-else
      :style="{
        aspectRatio: '5/7',
        background: '#0f3460',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
        padding: '8px',
        textAlign: 'center',
      }"
    >
      {{ card.name }}
    </div>
    <div class="card-name">{{ card.name }}</div>
    <button
      class="card-add-btn"
      title="Add to decklist"
      @click.stop="emit('add', card)"
    >+</button>
  </div>
</template>
