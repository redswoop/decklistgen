<script setup lang="ts">
import { computed } from "vue";
import type { Card } from "../../shared/types/card.js";
import {
  getCardImageUrl,
  hasCleanedImage,
  isGenerating,
  type ImageMode,
} from "../composables/usePokeproxy.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import { useDecklist } from "../composables/useDecklist.js";

const props = withDefaults(defineProps<{
  card: Card;
  imageMode?: ImageMode;
  /** Override count badge. When undefined, uses working deck count. */
  count?: number;
  /** Show the + add button */
  showAdd?: boolean;
  /** Show the - remove button (enables inline - [count] + controls) */
  showRemove?: boolean;
  /** Show regenerate button */
  showRegen?: boolean;
  /** Highlight as selected/active */
  active?: boolean;
  /** "Art only" badge for different-mechanics variants */
  artOnly?: boolean;
  /** Show selection checkbox instead of count badge */
  selectable?: boolean;
  /** Whether this card is selected (checkbox state) */
  selected?: boolean;
  /** Whether this card is stale (amber badge) */
  stale?: boolean;
  /** Show card name at bottom */
  showName?: boolean;
}>(), {
  imageMode: "original",
  count: undefined,
  showAdd: false,
  showRemove: false,
  showRegen: false,
  active: false,
  artOnly: false,
  selectable: false,
  selected: false,
  stale: false,
  showName: false,
});

const emit = defineEmits<{
  click: [];
  add: [];
  remove: [];
  regenerate: [];
  "toggle-select": [cardId: string];
}>();

const { getDeckCount } = useDecklist();

const imgSrc = computed(() =>
  getCardImageUrl(props.card, props.imageMode, "low")
  ?? cardImageUrl(props.card.imageBase, "low")
);

const label = computed(() => `${props.card.setCode} #${props.card.localId}`);

const displayCount = computed(() =>
  props.count !== undefined
    ? props.count
    : getDeckCount(props.card.setCode, props.card.localId)
);

const generating = computed(() => isGenerating(props.card.id));
const hasClean = computed(() => hasCleanedImage(props.card.id));
const isZeroCount = computed(() => props.count === 0);
</script>

<template>
  <div
    :class="['card-thumb', { 'card-thumb-active': active, 'card-thumb-zero': isZeroCount }]"
    :title="`${card.name} (${card.rarity})`"
    @click="emit('click')"
  >
    <!-- Card image -->
    <img v-if="imgSrc" :src="imgSrc" :alt="card.name" class="card-thumb-img" loading="lazy" />
    <div v-else class="card-thumb-placeholder">{{ card.name }}</div>

    <!-- TL zone: checkbox, or inline - [count] + controls, or read-only badge -->
    <label v-if="selectable" class="card-thumb-tl card-thumb-checkbox" @click.stop>
      <input type="checkbox" :checked="selected" @change="emit('toggle-select', card.id)" />
    </label>
    <div v-else-if="showRemove" class="card-thumb-tl card-thumb-inline-controls">
      <button class="card-thumb-ctrl card-thumb-minus" :disabled="!displayCount" @click.stop="emit('remove')">&minus;</button>
      <span class="card-thumb-badge" :class="{ 'card-thumb-badge-zero': !displayCount }">{{ displayCount }}</span>
      <button class="card-thumb-ctrl card-thumb-plus" @click.stop="emit('add')">+</button>
    </div>
    <span v-else-if="displayCount" class="card-thumb-tl card-thumb-badge">{{ displayCount }}</span>

    <!-- TR zone: status indicators + regen/add actions -->
    <div class="card-thumb-tr">
      <span v-if="generating" class="card-thumb-status card-thumb-status-generating" title="Generating..." />
      <span v-else-if="stale" class="card-thumb-status card-thumb-status-stale" title="Stale — prompt changed">!</span>
      <span v-else-if="hasClean && imageMode === 'proxy'" class="card-thumb-status card-thumb-status-clean" title="Cleaned">&#x2713;</span>

      <div class="card-thumb-actions">
        <button
          v-if="showRegen"
          class="card-thumb-action card-thumb-action-regen"
          :disabled="generating"
          :title="generating ? 'Generation in progress' : 'Regenerate artwork'"
          @click.stop="emit('regenerate')"
        >&#x21bb;</button>
        <button
          v-if="showAdd && !showRemove"
          class="card-thumb-action card-thumb-action-add"
          title="Add to decklist"
          @click.stop="emit('add')"
        >+</button>
      </div>
    </div>

    <!-- Generating overlay -->
    <div v-if="generating" class="card-thumb-generating">
      <div class="card-thumb-spinner" />
    </div>

    <!-- Set label — bottom-left overlay -->
    <span class="card-thumb-label">{{ label }}</span>

    <!-- Art only badge — bottom-right -->
    <span v-if="artOnly" class="card-thumb-art-only" title="Different abilities/attacks — only artwork will be used">Art only</span>

    <!-- Card name -->
    <div v-if="showName" class="card-thumb-name">{{ card.name }}</div>
  </div>
</template>
