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

const props = withDefaults(defineProps<{
  card: Card;
  imageMode: ImageMode;
  /** Override count badge (e.g., from deck view). When undefined, uses deck count. */
  count?: number;
  /** Hide the add-to-deck button */
  hideAdd?: boolean;
  /** Show selection checkbox */
  selectable?: boolean;
  /** Whether this card is selected */
  selected?: boolean;
  /** Whether this card is stale (amber badge) */
  stale?: boolean;
}>(), {
  count: undefined,
  hideAdd: false,
  selectable: false,
  selected: false,
  stale: false,
});

const emit = defineEmits<{
  add: [card: Card];
  preview: [card: Card];
  "toggle-select": [cardId: string];
}>();

const imageUrl = computed(() => getCardImageUrl(props.card, props.imageMode, "low"));
const statusLoaded = computed(() => hasStatusLoaded(props.card.id));
const showCleanBadge = computed(() => props.imageMode === "proxy" && hasCleanedImage(props.card.id));

const { getDeckCount, findSwappable } = useDecklist();
const tileDeckCount = computed(() =>
  props.count !== undefined ? props.count : getDeckCount(props.card.setCode, props.card.localId)
);
const showSwapBadge = computed(() =>
  findSwappable(props.card) !== null && tileDeckCount.value === 0
);
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

    <!-- Selection checkbox -->
    <label
      v-if="selectable"
      class="tile-select-checkbox"
      @click.stop
    >
      <input
        type="checkbox"
        :checked="selected"
        @change="emit('toggle-select', card.id)"
      />
    </label>
    <span v-if="showCleanBadge" class="tile-clean-badge">&#x2713;</span>
    <span v-if="stale" class="tile-stale-badge" title="Stale — prompt or rule has changed">!</span>
    <span v-if="tileDeckCount" class="tile-deck-badge">{{ tileDeckCount }}</span>
    <span v-if="showSwapBadge" class="tile-swap-badge">&#x21C4;</span>
    <div class="card-name">{{ card.name }}</div>
    <button
      v-if="!hideAdd"
      class="card-add-btn"
      title="Add to decklist"
      @click.stop="emit('add', card)"
    >+</button>
  </div>
</template>
