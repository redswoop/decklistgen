<script setup lang="ts">
import { computed } from "vue";
import type { Card } from "../../shared/types/card.js";
import {
  getCardImageUrl,
  hasCleanedImage,
  hasStatusLoaded,
  isGenerating,
  type ImageMode,
} from "../composables/usePokeproxy.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import { useDecklist } from "../composables/useDecklist.js";

export type TileContext = "browse" | "deck" | "working-deck" | "cards";

const props = withDefaults(defineProps<{
  card: Card;
  imageMode: ImageMode;
  context?: TileContext;
  /** Override count badge (e.g., from deck view). When undefined, uses deck count. */
  count?: number;
  /** Show selection checkbox */
  selectable?: boolean;
  /** Whether this card is selected */
  selected?: boolean;
  /** Whether this card is stale (amber badge) */
  stale?: boolean;
}>(), {
  context: "browse",
  count: undefined,
  selectable: false,
  selected: false,
  stale: false,
});

const emit = defineEmits<{
  add: [card: Card];
  remove: [card: Card];
  regenerate: [card: Card];
  preview: [card: Card];
  "toggle-select": [cardId: string];
}>();

// Derive button visibility from context
const showAdd = computed(() => props.context !== "cards");
const showRemove = computed(() => props.context === "working-deck" || props.context === "deck");
const isZeroCount = computed(() => props.count === 0);

const imageUrl = computed(() => getCardImageUrl(props.card, props.imageMode, "low"));
const statusLoaded = computed(() => hasStatusLoaded(props.card.id));
const tileHasClean = computed(() => hasCleanedImage(props.card.id));
const tileGenerating = computed(() => isGenerating(props.card.id));

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
    :class="{ 'tile-zero-count': isZeroCount }"
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

    <!-- TL zone: checkbox or deck count -->
    <label
      v-if="selectable"
      class="tile-tl tile-select-checkbox"
      @click.stop
    >
      <input
        type="checkbox"
        :checked="selected"
        @change="emit('toggle-select', card.id)"
      />
    </label>
    <span v-else-if="tileDeckCount" class="tile-tl tile-deck-badge">{{ tileDeckCount }}</span>

    <!-- TR zone: status indicator + action buttons column -->
    <div class="tile-tr">
      <span v-if="tileGenerating" class="tile-status tile-status-generating" title="Generating..." />
      <span v-else-if="stale" class="tile-status tile-status-stale" title="Stale — prompt changed">!</span>
      <span v-else-if="tileHasClean && imageMode === 'proxy'" class="tile-status tile-status-clean" title="Cleaned">&#x2713;</span>

      <div class="tile-actions">
        <button
          class="tile-action tile-action-regen"
          :disabled="tileGenerating"
          :title="tileGenerating ? 'Generation in progress' : 'Regenerate artwork'"
          @click.stop="emit('regenerate', card)"
        >&#x21bb;</button>
        <button
          v-if="showRemove"
          class="tile-action tile-action-remove"
          :disabled="tileDeckCount === 0"
          :title="tileDeckCount === 0 ? 'Card has 0 copies — click + to add' : 'Remove from deck'"
          @click.stop="emit('remove', card)"
        >&minus;</button>
        <button
          v-if="showAdd"
          class="tile-action tile-action-add"
          title="Add to decklist"
          @click.stop="emit('add', card)"
        >+</button>
      </div>
    </div>

    <!-- BL zone: swap badge -->
    <span v-if="showSwapBadge" class="tile-bl tile-swap-badge">&#x21C4;</span>

    <!-- Center: generating overlay -->
    <div v-if="tileGenerating" class="tile-generating-overlay">
      <div class="tile-generating-spinner" />
    </div>

    <!-- Bottom: card name -->
    <div class="card-name">{{ card.name }}</div>
  </div>
</template>
