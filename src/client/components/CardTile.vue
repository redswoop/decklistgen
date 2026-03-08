<script setup lang="ts">
import { computed } from "vue";
import type { Card } from "../../shared/types/card.js";
import {
  getCardImageUrl,
  hasCleanedImage,
  hasStatusLoaded,
  type ImageMode,
} from "../composables/usePokeproxy.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import { useDecklist } from "../composables/useDecklist.js";

const props = defineProps<{ card: Card; imageMode: ImageMode }>();
const emit = defineEmits<{
  add: [card: Card];
  preview: [card: Card];
}>();

const imageUrl = computed(() => getCardImageUrl(props.card, props.imageMode, "low"));
const statusLoaded = computed(() => hasStatusLoaded(props.card.id));
const showCleanBadge = computed(() => props.imageMode === "proxy" && hasCleanedImage(props.card.id));

const { getDeckCount } = useDecklist();
const tileDeckCount = computed(() => getDeckCount(props.card.setCode, props.card.localId));
</script>

<template>
  <div
    class="card-tile"
    :title="`${card.name} (${card.rarity})`"
    @click="emit('preview', card)"
  >
    <!-- Card image (resolved by mode) -->
    <img
      v-if="imageUrl"
      :src="imageUrl"
      :alt="card.name"
      loading="lazy"
    />
    <!-- Fallback while status loading in proxy mode -->
    <img
      v-else-if="card.imageBase"
      :src="cardImageUrl(card.imageBase, 'low')"
      :alt="card.name"
      loading="lazy"
    />
    <!-- No image placeholder -->
    <div v-else class="tile-placeholder">
      {{ card.name }}
    </div>

    <span v-if="showCleanBadge" class="tile-clean-badge">&#x2713;</span>
    <span v-if="tileDeckCount" class="tile-deck-badge">{{ tileDeckCount }}</span>
    <div class="card-name">{{ card.name }}</div>
    <button
      class="card-add-btn"
      title="Add to decklist"
      @click.stop="emit('add', card)"
    >+</button>
  </div>
</template>
