<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import type { Card } from "../../shared/types/card.js";
import {
  useVariants,
  usePokeproxyStatus,
  isGenerating,
  generateCleanImage,
  regenerateSvg,
  useGenerationQueryClient,
} from "../composables/usePokeproxy.js";
import { api } from "../lib/client.js";
import { useDecklist } from "../composables/useDecklist.js";

useGenerationQueryClient();

const props = defineProps<{
  card: Card;
  searchCards: Card[];
  source: 'grid' | 'deck';
}>();
const emit = defineEmits<{
  close: [];
}>();

const { addCard, removeCard, isInDeck, getDeckCount } = useDecklist();

// Search set navigation
const searchIndex = ref(0);

watch(() => props.card.id, () => {
  const idx = props.searchCards.findIndex((c) => c.id === props.card.id);
  searchIndex.value = idx >= 0 ? idx : 0;
}, { immediate: true });

// Clamp index when search set shrinks (e.g. deck cards removed)
watch(() => props.searchCards.length, (len) => {
  if (len > 0 && searchIndex.value >= len) {
    searchIndex.value = len - 1;
  }
});

const activeCard = computed(() => {
  if (!props.searchCards.length) return props.card;
  return props.searchCards[searchIndex.value] ?? props.card;
});

function prevCard() {
  if (searchIndex.value > 0) searchIndex.value--;
}
function nextCard() {
  if (searchIndex.value < props.searchCards.length - 1) searchIndex.value++;
}

// Variant navigation
const activeCardId = computed(() => activeCard.value.id);
const { data: variants } = useVariants(activeCardId);
const variantIndex = ref(0);

watch([variants, activeCardId], () => {
  if (!variants.value) return;
  const idx = variants.value.findIndex((c) => c.id === activeCard.value.id);
  variantIndex.value = idx >= 0 ? idx : 0;
}, { immediate: true });

const currentCard = computed(() => {
  if (!variants.value?.length) return activeCard.value;
  return variants.value[variantIndex.value] ?? activeCard.value;
});

const hasMultipleVariants = computed(() => (variants.value?.length ?? 1) > 1);

const deckCount = computed(() => getDeckCount(currentCard.value.setCode, currentCard.value.localId));

// Pokeproxy status for current variant
const currentCardId = computed(() => currentCard.value.id);
const { data: ppStatus } = usePokeproxyStatus(currentCardId);

const hasCleanedImage = computed(() =>
  ppStatus.value?.hasClean || ppStatus.value?.hasComposite
);

const cleanCacheBust = ref(0);
const svgCacheBust = ref(0);

const cleanedImageUrl = computed(() => {
  if (!ppStatus.value) return null;
  const v = cleanCacheBust.value;
  if (ppStatus.value.hasComposite) return `${api.pokeproxyImageUrl(currentCard.value.id, "composite")}?v=${v}`;
  if (ppStatus.value.hasClean) return `${api.pokeproxyImageUrl(currentCard.value.id, "clean")}?v=${v}`;
  return null;
});

const svgUrl = computed(() => `${api.pokeproxySvgUrl(currentCard.value.id)}?v=${svgCacheBust.value}`);

const svgLoading = ref(true);
const svgError = ref(false);
function onSvgLoad() { svgLoading.value = false; svgError.value = false; }
function onSvgError() { svgLoading.value = false; svgError.value = true; }

watch(currentCardId, () => { svgLoading.value = true; svgError.value = false; });

const generating = computed(() => isGenerating(currentCard.value.id));

watch(generating, (now, was) => {
  if (was && !now) {
    cleanCacheBust.value++;
    svgCacheBust.value++;
    svgLoading.value = true;
    svgError.value = false;
  }
});

function handleGenerate() {
  generateCleanImage(currentCard.value.id);
}

function handleRegenerate() {
  generateCleanImage(currentCard.value.id, true);
}

const svgRegenerating = ref(false);
async function handleRegenerateSvg() {
  if (svgRegenerating.value) return;
  svgRegenerating.value = true;
  svgLoading.value = true;
  svgError.value = false;
  try {
    await regenerateSvg(currentCard.value.id);
    svgCacheBust.value++;
  } finally {
    svgRegenerating.value = false;
  }
}

// Keyboard: Escape to close
function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close");
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

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
      <!-- Header: search set navigation + card info -->
      <div class="lightbox-header">
        <button class="nav-btn" :disabled="searchIndex <= 0" @click="prevCard">&lsaquo;</button>
        <div class="lightbox-card-info">
          <div v-if="source === 'deck'" class="lightbox-source-label">Browsing Deck</div>
          <h2>{{ currentCard.name }}</h2>
          <div class="lightbox-card-meta">
            <span>{{ currentCard.category }}</span>
            <template v-if="currentCard.energyTypes?.length">
              <span class="meta-sep"> &middot; </span>
              <span>{{ currentCard.energyTypes.join(", ") }}</span>
            </template>
            <template v-if="currentCard.hp">
              <span class="meta-sep"> &middot; </span>
              <span>{{ currentCard.hp }} HP</span>
            </template>
            <template v-if="currentCard.stage">
              <span class="meta-sep"> &middot; </span>
              <span>{{ currentCard.stage }}</span>
            </template>
            <template v-if="currentCard.retreat !== undefined">
              <span class="meta-sep"> &middot; </span>
              <span>Retreat {{ currentCard.retreat }}</span>
            </template>
          </div>
          <div class="lightbox-card-set">
            {{ currentCard.setName }} ({{ currentCard.setCode }}) &middot; #{{ currentCard.localId }} &middot; {{ currentCard.rarity }}
          </div>
          <div v-if="tags.length" class="lightbox-tags">
            <span v-for="t in tags" :key="t" class="lightbox-tag">{{ t }}</span>
          </div>
        </div>
        <button class="nav-btn" :disabled="searchIndex >= searchCards.length - 1" @click="nextCard">&rsaquo;</button>
        <button class="lightbox-close" @click="emit('close')">&times;</button>
      </div>

      <!-- Body: images + variant sidebar -->
      <div class="lightbox-body">
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

          <!-- Cleaned (full-art only) -->
          <div v-if="currentCard.isFullArt" class="lightbox-image-col">
            <div class="image-label">Cleaned</div>
            <div v-if="generating" class="lightbox-placeholder lightbox-generating">
              <div class="generate-spinner"></div>
              <div class="generate-text">Generating via ComfyUI...</div>
            </div>
            <img
              v-else-if="hasCleanedImage && cleanedImageUrl"
              :src="cleanedImageUrl"
              :alt="`${currentCard.name} (cleaned)`"
              class="lightbox-img lightbox-img-clickable"
              title="Click to regenerate"
              @click="handleRegenerate"
            />
            <div v-else class="lightbox-placeholder lightbox-clickable" @click="handleGenerate">
              <div class="generate-icon">+</div>
              <div class="generate-label">Click to Generate</div>
              <div class="generate-sublabel">via ComfyUI</div>
            </div>
          </div>

          <!-- SVG Proxy -->
          <div class="lightbox-image-col">
            <div class="image-label">SVG Proxy</div>
            <div v-if="(svgLoading || svgRegenerating) && !svgError" class="lightbox-placeholder">
              <div class="generate-spinner"></div>
              <div class="generate-text">{{ svgRegenerating ? 'Regenerating SVG...' : 'Rendering SVG...' }}</div>
            </div>
            <div v-if="svgError" class="lightbox-placeholder lightbox-clickable" @click="handleRegenerateSvg">
              <div class="generate-label">SVG Failed</div>
              <div class="generate-sublabel">Click to retry</div>
            </div>
            <img
              v-show="!svgLoading && !svgError && !svgRegenerating"
              :src="svgUrl"
              :alt="`${currentCard.name} (SVG)`"
              class="lightbox-img lightbox-img-clickable"
              title="Click to regenerate SVG"
              @click="handleRegenerateSvg"
              @load="onSvgLoad"
              @error="onSvgError"
            />
          </div>
        </div>

        <!-- Variant sidebar -->
        <div v-if="hasMultipleVariants" class="variant-sidebar">
          <div class="variant-sidebar-title">Variants</div>
          <div class="variant-sidebar-list">
            <div
              v-for="(v, i) in variants"
              :key="v.id"
              :class="['variant-item', { active: i === variantIndex }]"
              @click="variantIndex = i"
            >
              <div class="variant-item-thumb">
                <img v-if="v.imageUrl" :src="v.imageUrl" class="variant-item-img" />
                <div v-else class="variant-item-placeholder">?</div>
                <span v-if="getDeckCount(v.setCode, v.localId)" class="variant-item-badge">{{ getDeckCount(v.setCode, v.localId) }}</span>
              </div>
              <div class="variant-item-label">{{ v.setCode }} #{{ v.localId }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="lightbox-actions">
        <button v-if="deckCount === 0" class="lightbox-add" @click="addCard(currentCard)">Add to Decklist</button>
        <div v-else class="lightbox-deck-controls">
          <button class="deck-ctrl-btn" @click="removeCard(currentCard.setCode, currentCard.localId)">&minus;</button>
          <span class="deck-ctrl-count">In Deck (x{{ deckCount }})</span>
          <button class="deck-ctrl-btn" @click="addCard(currentCard)">+</button>
        </div>
      </div>
    </div>
  </div>
</template>
