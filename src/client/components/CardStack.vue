<script setup lang="ts">
import { computed } from "vue";
import type { ImageMode } from "../composables/usePokeproxy.js";
import type { CardStackGroup } from "../../shared/utils/fold-cards.js";
import CardThumb from "./CardThumb.vue";

const props = withDefaults(defineProps<{
  /** The folded group; its `representative` is rendered as the stack face. */
  group: CardStackGroup;
  imageMode?: ImageMode;
  count?: number;
  showAdd?: boolean;
  showRemove?: boolean;
  showRegen?: boolean;
  active?: boolean;
  showSwap?: boolean;
  swapTitle?: string;
  artOnly?: boolean;
  selectable?: boolean;
  selected?: boolean;
  stale?: boolean;
  showName?: boolean;
}>(), {
  imageMode: "original",
  count: undefined,
  showAdd: false,
  showRemove: false,
  showRegen: false,
  active: false,
  showSwap: false,
  swapTitle: "Replace this printing in the deck",
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
  swap: [];
  regenerate: [];
  "toggle-select": [cardId: string];
}>();

const printingCount = computed(() => props.group.members.length);
const isStacked = computed(() => printingCount.value > 1);
</script>

<template>
  <div class="card-stack" :class="{ 'card-stack-multi': isStacked }">
    <!-- Ghost layers peeking out behind, only when more than one printing -->
    <template v-if="isStacked">
      <div class="card-stack-ghost card-stack-ghost-2" aria-hidden="true" />
      <div class="card-stack-ghost card-stack-ghost-1" aria-hidden="true" />
    </template>

    <CardThumb
      class="card-stack-top"
      :card="group.representative"
      :image-mode="imageMode"
      :count="count"
      :show-add="showAdd"
      :show-remove="showRemove"
      :show-regen="showRegen"
      :active="active"
      :show-swap="showSwap"
      :swap-title="swapTitle"
      :art-only="artOnly"
      :selectable="selectable"
      :selected="selected"
      :stale="stale"
      :show-name="showName"
      @click="emit('click')"
      @add="emit('add')"
      @remove="emit('remove')"
      @swap="emit('swap')"
      @regenerate="emit('regenerate')"
      @toggle-select="emit('toggle-select', $event)"
    />

    <span
      v-if="isStacked"
      class="card-stack-badge"
      :title="`${printingCount} printings of this art`"
    >&#x29C9; {{ printingCount }}</span>
  </div>
</template>

<style scoped>
.card-stack {
  position: relative;
}

/* Leave a little room at the bottom-right for the peeking ghost edges so they
 * don't get clipped by the row's gap. */
.card-stack-multi {
  padding-right: 5px;
  padding-bottom: 5px;
}

.card-stack-top {
  position: relative;
  z-index: 1;
}

.card-stack-ghost {
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: 6px;
  background: #20203a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

.card-stack-ghost-1 {
  transform: translate(3px, 3px);
}

.card-stack-ghost-2 {
  transform: translate(6px, 6px);
  opacity: 0.7;
}

.card-stack-badge {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  background: rgba(16, 16, 32, 0.85);
  color: #e7e9f3;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  pointer-events: none;
}
</style>
