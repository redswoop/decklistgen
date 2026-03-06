<script setup lang="ts">
import { computed } from "vue";
import type { Card } from "../../shared/types/card.js";

const props = defineProps<{ card: Card }>();
const emit = defineEmits<{
  close: [];
  add: [card: Card];
}>();

const tags = computed(() =>
  [
    props.card.isEx && "ex",
    props.card.isV && "V",
    props.card.isVmax && "VMAX",
    props.card.isVstar && "VSTAR",
    props.card.isAncient && "Ancient",
    props.card.isFuture && "Future",
    props.card.isTera && "Tera",
    props.card.isFullArt && "Full Art",
    props.card.hasFoil && "Foil",
  ].filter(Boolean) as string[]
);
</script>

<template>
  <div class="dialog-overlay" @click="emit('close')">
    <div class="lightbox" @click.stop>
      <div class="lightbox-image">
        <img v-if="card.imageUrl" :src="card.imageUrl" :alt="card.name" />
        <div v-else class="lightbox-placeholder">{{ card.name }}</div>
      </div>
      <div class="lightbox-details">
        <h2>{{ card.name }}</h2>
        <div class="lightbox-meta">
          <div><span class="label">Set:</span> {{ card.setName }} ({{ card.setCode }})</div>
          <div><span class="label">Number:</span> {{ card.localId }}</div>
          <div><span class="label">Rarity:</span> {{ card.rarity }}</div>
          <div>
            <span class="label">Category:</span> {{ card.category }}{{ card.trainerType ? ` - ${card.trainerType}` : "" }}
          </div>
          <div v-if="card.energyTypes.length > 0">
            <span class="label">Type:</span> {{ card.energyTypes.join(", ") }}
          </div>
          <div v-if="card.hp !== undefined">
            <span class="label">HP:</span> {{ card.hp }}
          </div>
          <div v-if="card.stage">
            <span class="label">Stage:</span> {{ card.stage }}
          </div>
          <div v-if="card.retreat !== undefined">
            <span class="label">Retreat:</span> {{ card.retreat }}
          </div>
        </div>
        <div v-if="tags.length > 0" class="lightbox-tags">
          <span v-for="t in tags" :key="t" class="lightbox-tag">{{ t }}</span>
        </div>
        <button class="lightbox-add" @click="emit('add', card)">
          Add to Decklist
        </button>
      </div>
    </div>
  </div>
</template>
