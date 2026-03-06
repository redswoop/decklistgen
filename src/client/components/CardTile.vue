<script setup lang="ts">
import type { Card } from "../../shared/types/card.js";

defineProps<{ card: Card }>();
const emit = defineEmits<{
  add: [card: Card];
  preview: [card: Card];
}>();
</script>

<template>
  <div
    class="card-tile"
    :title="`${card.name} (${card.rarity})`"
    @click="emit('preview', card)"
  >
    <img
      v-if="card.imageUrl"
      :src="card.imageUrl"
      :alt="card.name"
      loading="lazy"
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
