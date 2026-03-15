<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { Card } from "../../shared/types/card.js";
import type { DeckCard } from "../../shared/types/deck.js";
import { useVariants, usePokeproxy, usePokeproxyBatch, getCardImageUrl } from "../composables/usePokeproxy.js";
import { useDecks } from "../composables/useDecks.js";
import { useIsMobile } from "../composables/useIsMobile.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import { randomizeAllocation, useForAll, isValidAllocation } from "../../shared/utils/variant-allocation.js";
import { consolidateDeckCards } from "../../shared/utils/consolidate-deck.js";

const props = defineProps<{
  card: Card;
  savedDeckId: string;
  savedDeckCards: DeckCard[];
}>();

const emit = defineEmits<{
  close: [];
  openLightbox: [card: Card];
  deckUpdated: [];
}>();

const isMobile = useIsMobile();
const { imageMode } = usePokeproxy();
const { updateDeck } = useDecks();

// Fetch variants — toggle between mechanics-matched and all same-name art
const cardId = computed(() => props.card.id);
const showAllArt = ref(false);
const { data: variants, isLoading: variantsLoading } = useVariants(cardId, showAllArt);

// Total count of copies in deck matching this card's name
const totalCount = computed(() => {
  let sum = 0;
  for (const dc of props.savedDeckCards) {
    if (dc.card.name === props.card.name) sum += dc.count;
  }
  return sum;
});

// All variant IDs (use variants from API, or just the current card)
const variantCards = computed<Card[]>(() => variants.value ?? [props.card]);
const variantIds = computed(() => variantCards.value.map((c) => c.id));

// Batch-fetch proxy status for variant cards so proxy images resolve
const batchIds = computed(() => imageMode.value === "proxy" ? variantIds.value : []);
usePokeproxyBatch(batchIds);

// Mutable allocation map
const allocation = ref(new Map<string, number>());

// Initialize allocation from current deck state whenever variants load
watch([variantCards, () => props.savedDeckCards], () => {
  const alloc = new Map<string, number>();
  for (const v of variantCards.value) {
    const dc = props.savedDeckCards.find(
      (d) => d.card.setCode === v.setCode && d.card.localId === v.localId,
    );
    alloc.set(v.id, dc?.count ?? 0);
  }
  allocation.value = alloc;
}, { immediate: true });

const allocatedSum = computed(() => {
  let sum = 0;
  for (const v of allocation.value.values()) sum += v;
  return sum;
});

const isValid = computed(() => isValidAllocation(allocation.value, totalCount.value));

function increment(id: string) {
  if (allocatedSum.value >= totalCount.value) return;
  const alloc = new Map(allocation.value);
  alloc.set(id, (alloc.get(id) ?? 0) + 1);
  allocation.value = alloc;
}

function decrement(id: string) {
  const current = allocation.value.get(id) ?? 0;
  if (current <= 0) return;
  const alloc = new Map(allocation.value);
  alloc.set(id, current - 1);
  allocation.value = alloc;
}

function handleUseForAll(id: string) {
  allocation.value = useForAll(variantIds.value, id, totalCount.value);
}

function handleRandomize() {
  allocation.value = randomizeAllocation(variantIds.value, totalCount.value);
}

const saving = ref(false);

async function handleApply() {
  if (!isValid.value || saving.value) return;
  saving.value = true;
  try {
    // Build new deck cards: keep non-matching cards, replace matching ones
    const newCards: DeckCard[] = [];
    for (const dc of props.savedDeckCards) {
      if (dc.card.name !== props.card.name) {
        newCards.push(dc);
      }
    }
    // Add allocated variants
    for (const v of variantCards.value) {
      const count = allocation.value.get(v.id) ?? 0;
      if (count > 0) {
        newCards.push({ count, card: v });
      }
    }
    await updateDeck({ id: props.savedDeckId, data: { cards: consolidateDeckCards(newCards) } });
    emit("deckUpdated");
    emit("close");
  } finally {
    saving.value = false;
  }
}

function handleViewDetails() {
  emit("openLightbox", props.card);
  emit("close");
}

function variantLabel(card: Card): string {
  return `${card.setCode}#${card.localId}`;
}

function handleOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains("dialog-overlay")) {
    emit("close");
  }
}
</script>

<template>
  <div class="dialog-overlay" @click="handleOverlayClick">
    <div :class="['dialog', 'variant-picker', { 'variant-picker-mobile': isMobile }]">
      <!-- Header -->
      <div class="variant-picker-header">
        <span class="variant-picker-name">{{ card.name }}</span>
        <span class="variant-picker-total">{{ totalCount }} total</span>
      </div>

      <!-- Show all art toggle -->
      <label class="variant-picker-toggle">
        <input type="checkbox" v-model="showAllArt" />
        Show all art
      </label>

      <!-- Loading -->
      <div v-if="variantsLoading" class="variant-picker-loading">
        Loading variants...
      </div>

      <!-- Variant grid -->
      <div v-else class="variant-picker-grid">
        <div
          v-for="v in variantCards"
          :key="v.id"
          :class="['variant-picker-item', { 'variant-picker-item-active': (allocation.get(v.id) ?? 0) > 0 }]"
        >
          <img
            :src="getCardImageUrl(v, imageMode, 'low') ?? cardImageUrl(v.imageBase, 'low')"
            :alt="v.name"
            class="variant-picker-thumb"
            loading="lazy"
          />
          <div class="variant-picker-label">{{ variantLabel(v) }}</div>
          <div class="variant-picker-controls">
            <button
              class="variant-picker-btn"
              :disabled="(allocation.get(v.id) ?? 0) <= 0"
              @click="decrement(v.id)"
            >&minus;</button>
            <span class="variant-picker-count">{{ allocation.get(v.id) ?? 0 }}</span>
            <button
              class="variant-picker-btn"
              :disabled="allocatedSum >= totalCount"
              @click="increment(v.id)"
            >+</button>
          </div>
          <button
            class="variant-picker-use-all"
            @click="handleUseForAll(v.id)"
          >Use for all</button>
        </div>
      </div>

      <!-- Footer -->
      <div class="variant-picker-footer">
        <div class="variant-picker-status">
          Allocated: {{ allocatedSum }}/{{ totalCount }}
          <span v-if="!isValid" class="variant-picker-warn">
            ({{ allocatedSum < totalCount ? `${totalCount - allocatedSum} unassigned` : 'over-allocated' }})
          </span>
        </div>
        <div class="variant-picker-actions">
          <button class="variant-picker-action" @click="handleRandomize">Randomize</button>
          <button
            class="variant-picker-action variant-picker-apply"
            :disabled="!isValid || saving"
            @click="handleApply"
          >{{ saving ? 'Saving...' : 'Apply' }}</button>
          <button class="variant-picker-action" @click="emit('close')">Cancel</button>
        </div>
        <button class="variant-picker-details-link" @click="handleViewDetails">
          View full details &rarr;
        </button>
      </div>
    </div>
  </div>
</template>
