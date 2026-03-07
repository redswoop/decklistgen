<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { Card } from "../../shared/types/card.js";
import {
  useVariants,
  usePokeproxyStatus,
  isGenerating,
  generateCleanImage,
} from "../composables/usePokeproxy.js";
import { api } from "../lib/client.js";

const props = defineProps<{ card: Card }>();
const emit = defineEmits<{
  close: [];
  add: [card: Card];
}>();

// Variant navigation
const cardIdRef = computed(() => props.card.id);
const { data: variants } = useVariants(cardIdRef);
const variantIndex = ref(0);

watch(() => props.card.id, () => { variantIndex.value = 0; });

watch(variants, (v) => {
  if (!v) return;
  const idx = v.findIndex((c) => c.id === props.card.id);
  if (idx >= 0) variantIndex.value = idx;
});

const currentCard = computed(() => {
  if (!variants.value?.length) return props.card;
  return variants.value[variantIndex.value] ?? props.card;
});

const totalVariants = computed(() => variants.value?.length ?? 1);
const hasMultipleVariants = computed(() => totalVariants.value > 1);

function prevVariant() {
  if (variantIndex.value > 0) variantIndex.value--;
}
function nextVariant() {
  if (variantIndex.value < totalVariants.value - 1) variantIndex.value++;
}

// Pokeproxy status for current variant
const currentCardId = computed(() => currentCard.value.id);
const { data: ppStatus } = usePokeproxyStatus(currentCardId);

const hasCleanedImage = computed(() =>
  ppStatus.value?.hasClean || ppStatus.value?.hasComposite
);

const cleanedImageUrl = computed(() => {
  if (!ppStatus.value) return null;
  if (ppStatus.value.hasComposite) return api.pokeproxyImageUrl(currentCard.value.id, "composite");
  if (ppStatus.value.hasClean) return api.pokeproxyImageUrl(currentCard.value.id, "clean");
  return null;
});

const svgUrl = computed(() => {
  if (!ppStatus.value?.hasSvg) return null;
  return api.pokeproxySvgUrl(currentCard.value.id);
});

const generating = computed(() => isGenerating(currentCard.value.id));

function handleGenerate() {
  generateCleanImage(currentCard.value.id);
}

// Tags
const tags = computed(() =>
  [
    currentCard.value.isEx && "ex",
    currentCard.value.isV && "V",
    currentCard.value.isVmax && "VMAX",
    currentCard.value.isVstar && "VSTAR",
    currentCard.value.isAncient && "Ancient",
    currentCard.value.isFuture && "Future",
    currentCard.value.isTera && "Tera",
    currentCard.value.isFullArt && "Full Art",
    currentCard.value.hasFoil && "Foil",
  ].filter(Boolean) as string[]
);
</script>

<template>
  <div class="dialog-overlay" @click="emit('close')">
    <div class="lightbox" @click.stop>
      <!-- Variant navigation -->
      <div v-if="hasMultipleVariants" class="variant-nav">
        <button class="variant-btn" :disabled="variantIndex <= 0" @click="prevVariant">&lsaquo;</button>
        <span class="variant-label">
          Variant {{ variantIndex + 1 }} / {{ totalVariants }}
          <span class="variant-id">{{ currentCard.setCode }} {{ currentCard.localId }}</span>
        </span>
        <button class="variant-btn" :disabled="variantIndex >= totalVariants - 1" @click="nextVariant">&rsaquo;</button>
      </div>

      <!-- Images row: always show Original + PokeProxy columns -->
      <div class="lightbox-images">
        <!-- Original -->
        <div class="lightbox-image-col">
          <div class="image-label">Original</div>
          <img
            v-if="currentCard.imageUrl"
            :src="currentCard.imageUrl"
            :alt="currentCard.name"
            class="lightbox-img"
          />
          <div v-else class="lightbox-placeholder">{{ currentCard.name }}</div>
        </div>

        <!-- Cleaned / Placeholder -->
        <div class="lightbox-image-col">
          <div class="image-label">Cleaned</div>
          <!-- Has cleaned image -->
          <img
            v-if="hasCleanedImage && cleanedImageUrl"
            :src="cleanedImageUrl"
            :alt="`${currentCard.name} (cleaned)`"
            class="lightbox-img"
          />
          <!-- Generating spinner -->
          <div v-else-if="generating" class="lightbox-placeholder lightbox-generating" @click="handleGenerate">
            <div class="generate-spinner"></div>
            <div class="generate-text">Generating via Framehouse...</div>
          </div>
          <!-- Click to generate -->
          <div v-else class="lightbox-placeholder lightbox-clickable" @click="handleGenerate">
            <div class="generate-icon">+</div>
            <div class="generate-label">Click to Generate</div>
            <div class="generate-sublabel">via Framehouse</div>
          </div>
        </div>

        <!-- SVG proxy (if available) -->
        <div v-if="svgUrl" class="lightbox-image-col">
          <div class="image-label">SVG Proxy</div>
          <img
            :src="svgUrl"
            :alt="`${currentCard.name} (SVG)`"
            class="lightbox-img"
          />
        </div>
      </div>

      <!-- Details -->
      <div class="lightbox-details">
        <h2>{{ currentCard.name }}</h2>
        <div class="lightbox-meta">
          <div><span class="label">Set:</span> {{ currentCard.setName }} ({{ currentCard.setCode }})</div>
          <div><span class="label">Number:</span> {{ currentCard.localId }}</div>
          <div><span class="label">Rarity:</span> {{ currentCard.rarity }}</div>
          <div>
            <span class="label">Category:</span> {{ currentCard.category }}{{ currentCard.trainerType ? ` - ${currentCard.trainerType}` : "" }}
          </div>
          <div v-if="currentCard.energyTypes.length > 0">
            <span class="label">Type:</span> {{ currentCard.energyTypes.join(", ") }}
          </div>
          <div v-if="currentCard.hp !== undefined">
            <span class="label">HP:</span> {{ currentCard.hp }}
          </div>
          <div v-if="currentCard.stage">
            <span class="label">Stage:</span> {{ currentCard.stage }}
          </div>
          <div v-if="currentCard.retreat !== undefined">
            <span class="label">Retreat:</span> {{ currentCard.retreat }}
          </div>
        </div>
        <div v-if="tags.length > 0" class="lightbox-tags">
          <span v-for="t in tags" :key="t" class="lightbox-tag">{{ t }}</span>
        </div>
        <div class="lightbox-actions">
          <button class="lightbox-add" @click="emit('add', currentCard)">
            Add to Decklist
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
