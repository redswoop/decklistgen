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
import { useCardDetail } from "../composables/useCardDetail.js";
import { api } from "../lib/client.js";
import { useDecklist } from "../composables/useDecklist.js";
import CardZoom from "./lightbox/CardZoom.vue";
import LightboxDevTools from "./lightbox/LightboxDevTools.vue";
import LightboxProxySettings from "./lightbox/LightboxProxySettings.vue";
import { useProxySettings } from "../composables/useProxySettings.js";
import type { ProxySettings } from "../../shared/types/proxy-settings.js";

useGenerationQueryClient();

const ENERGY_COLORS: Record<string, string> = {
  Grass: "#439837", Fire: "#e4613e", Water: "#3099e1",
  Lightning: "#dfbc28", Psychic: "#e96c8c", Fighting: "#e49021",
  Darkness: "#4f4747", Metal: "#74b0cb", Fairy: "#e18ce1",
  Dragon: "#576fbc", Colorless: "#828282",
};

const props = defineProps<{
  card: Card;
  searchCards: Card[];
  source: 'grid' | 'deck';
}>();
const emit = defineEmits<{
  close: [];
}>();

const { addCard, removeCard, getDeckCount } = useDecklist();
const { getSettings } = useProxySettings();

// Search set navigation
const searchIndex = ref(0);

watch(() => props.card.id, () => {
  const idx = props.searchCards.findIndex((c) => c.id === props.card.id);
  searchIndex.value = idx >= 0 ? idx : 0;
}, { immediate: true });

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

// Card detail (attacks, abilities, weakness/resistance)
const currentCardId = computed(() => currentCard.value.id);
const lightboxOpen = ref(true);
const { data: cardDetail } = useCardDetail(currentCardId, lightboxOpen);

// Pokeproxy status for current variant
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

// Background art: cleaned image if available, else original
const bgImageUrl = computed(() => cleanedImageUrl.value ?? currentCard.value.imageUrl ?? null);

// Proxy settings for current card
const currentProxySettings = computed(() =>
  getSettings(currentCard.value.setCode, currentCard.value.localId)
);

// SVG Proxy
const svgUrl = computed(() => {
  const settings = currentProxySettings.value;
  const hasSettings = settings.fontSize != null || settings.maxCover != null;
  const base = hasSettings
    ? api.pokeproxySvgUrl(currentCard.value.id, settings)
    : api.pokeproxySvgUrl(currentCard.value.id);
  return `${base}${base.includes('?') ? '&' : '?'}v=${svgCacheBust.value}`;
});
const svgLoading = ref(true);
const svgError = ref(false);
function onSvgLoad() { svgLoading.value = false; svgError.value = false; }
function onSvgError() { svgLoading.value = false; svgError.value = true; }

watch(currentCardId, () => {
  svgLoading.value = true; svgError.value = false;
});

const generating = computed(() => isGenerating(currentCard.value.id));

watch(generating, (now, was) => {
  if (was && !now) {
    cleanCacheBust.value++;
    svgCacheBust.value++;
    svgLoading.value = true; svgError.value = false;
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
  svgLoading.value = true; svgError.value = false;
  try {
    await regenerateSvg(currentCard.value.id);
    svgCacheBust.value++;
  } finally {
    svgRegenerating.value = false;
  }
}

// When proxy settings change, debounce SVG reload
let settingsTimer: ReturnType<typeof setTimeout> | null = null;
function onProxySettingsChange() {
  if (settingsTimer) clearTimeout(settingsTimer);
  settingsTimer = setTimeout(() => {
    svgCacheBust.value++;
    svgLoading.value = true;
    svgError.value = false;
  }, 300);
}

// Zoom
const showZoom = ref(false);
const zoomImageUrl = computed(() => {
  // Show SVG proxy if loaded, else original
  if (!svgLoading.value && !svgError.value) return svgUrl.value;
  return currentCard.value.imageUrl;
});

// Keyboard: Escape/arrows
function onKeydown(e: KeyboardEvent) {
  if (showZoom.value) return; // zoom handles its own keys
  if (e.key === "Escape") emit("close");
  if (e.key === "ArrowLeft") prevCard();
  if (e.key === "ArrowRight") nextCard();
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

function energyColor(type: string): string {
  return ENERGY_COLORS[type] ?? "#828282";
}
</script>

<template>
  <div class="dialog-overlay lb-overlay" @click="emit('close')">
    <!-- Background art -->
    <div
      v-if="bgImageUrl"
      class="lb-bg"
      :style="{ backgroundImage: `url(${bgImageUrl})` }"
    ></div>

    <div class="lb-modal" @click.stop>
      <!-- Header -->
      <div class="lb-header">
        <button class="nav-btn" :disabled="searchIndex <= 0" @click="prevCard">&lsaquo;</button>
        <div class="lb-header-info">
          <div v-if="source === 'deck'" class="lb-source-label">Browsing Deck</div>
          <h2 class="lb-title">
            {{ currentCard.name }}
            <span v-if="currentCard.hp" class="lb-hp">{{ currentCard.hp }} HP</span>
          </h2>
          <div class="lb-meta">
            <span>{{ currentCard.setName }} ({{ currentCard.setCode }}) #{{ currentCard.localId }}</span>
            <span class="meta-sep"> · </span>
            <span>{{ currentCard.rarity }}</span>
            <template v-if="tags.length">
              <span v-for="t in tags" :key="t" class="lb-tag">{{ t }}</span>
            </template>
          </div>
        </div>
        <button class="nav-btn" :disabled="searchIndex >= searchCards.length - 1" @click="nextCard">&rsaquo;</button>
        <button class="lightbox-close" @click="emit('close')">&times;</button>
      </div>

      <!-- Body: image left, info right -->
      <div class="lb-body">
        <!-- Left: card image + variants -->
        <div class="lb-left">
          <div class="lb-card-image" @click="showZoom = true">
            <!-- Original art as stable base layer (no layout shift) -->
            <img
              v-if="currentCard.imageUrl"
              :src="currentCard.imageUrl"
              :alt="currentCard.name"
              class="lb-img"
            />
            <div v-else class="lb-img-placeholder">{{ currentCard.name }}</div>
            <!-- SVG proxy layered on top, fades in when loaded -->
            <img
              :src="svgUrl"
              :alt="currentCard.name"
              :class="['lb-img-svg', { loaded: !svgLoading && !svgError }]"
              @load="onSvgLoad"
              @error="onSvgError"
            />
            <!-- Generation overlay -->
            <div v-if="generating" class="lb-generating-overlay">
              <div class="generate-spinner"></div>
              <div class="lb-gen-text">Generating...</div>
            </div>
            <div class="lb-zoom-hint">Click to zoom</div>
          </div>

          <!-- Variants row -->
          <div v-if="hasMultipleVariants" class="lb-variants">
            <div
              v-for="(v, i) in variants"
              :key="v.id"
              :class="['lb-variant', { active: i === variantIndex }]"
              @click="variantIndex = i"
            >
              <img v-if="v.imageUrl" :src="v.imageUrl" class="lb-variant-img" />
              <div v-else class="lb-variant-placeholder">?</div>
              <span v-if="getDeckCount(v.setCode, v.localId)" class="lb-variant-badge">
                {{ getDeckCount(v.setCode, v.localId) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Right: info panel -->
        <div class="lb-right">
          <div class="lb-info-scroll">
            <!-- Card metadata -->
            <div v-if="currentCard.category === 'Pokemon'" class="lb-card-meta-block">
              <div class="lb-stage-line">
                <span>{{ currentCard.stage ?? 'Basic' }}</span>
                <template v-if="cardDetail?.evolveFrom">
                  <span class="meta-sep"> · </span>
                  <span class="lb-evolve">Evolves from {{ cardDetail.evolveFrom }}</span>
                </template>
                <template v-if="currentCard.energyTypes?.length">
                  <span class="meta-sep"> · </span>
                  <span v-for="t in currentCard.energyTypes" :key="t"
                    class="lb-energy-dot"
                    :style="{ background: energyColor(t) }"
                    :title="t"
                  ></span>
                </template>
              </div>
            </div>

            <!-- Description (flavor text) -->
            <p v-if="cardDetail?.description" class="lb-description">
              {{ cardDetail.description }}
            </p>

            <!-- Abilities -->
            <div v-if="cardDetail?.abilities?.length" class="lb-section">
              <div
                v-for="ab in cardDetail.abilities"
                :key="ab.name"
                class="lb-ability"
              >
                <div class="lb-ability-header">
                  <span class="lb-ability-type">{{ ab.type }}</span>
                  <span class="lb-ability-name">{{ ab.name }}</span>
                </div>
                <p class="lb-effect-text">{{ ab.effect }}</p>
              </div>
            </div>

            <!-- Attacks -->
            <div v-if="cardDetail?.attacks?.length" class="lb-section">
              <div
                v-for="atk in cardDetail.attacks"
                :key="atk.name"
                class="lb-attack"
              >
                <div class="lb-attack-header">
                  <span class="lb-attack-cost">
                    <span
                      v-for="(c, ci) in atk.cost"
                      :key="ci"
                      class="lb-energy-dot"
                      :style="{ background: energyColor(c) }"
                      :title="c"
                    ></span>
                  </span>
                  <span class="lb-attack-name">{{ atk.name }}</span>
                  <span v-if="atk.damage" class="lb-attack-damage">{{ atk.damage }}</span>
                </div>
                <p v-if="atk.effect" class="lb-effect-text">{{ atk.effect }}</p>
              </div>
            </div>

            <!-- Trainer / Energy effect -->
            <div v-if="!cardDetail?.attacks?.length && !cardDetail?.abilities?.length && currentCard.category !== 'Pokemon'" class="lb-section">
              <p v-if="cardDetail?.description" class="lb-effect-text">{{ cardDetail.description }}</p>
            </div>

            <!-- Weakness / Resistance / Retreat -->
            <div v-if="cardDetail && currentCard.category === 'Pokemon'" class="lb-wrr">
              <div v-if="cardDetail.weaknesses?.length" class="lb-wrr-item">
                <span class="lb-wrr-label">Weakness</span>
                <span v-for="w in cardDetail.weaknesses" :key="w.type" class="lb-wrr-value">
                  <span class="lb-energy-dot sm" :style="{ background: energyColor(w.type) }" :title="w.type"></span>
                  {{ w.value }}
                </span>
              </div>
              <div v-if="cardDetail.resistances?.length" class="lb-wrr-item">
                <span class="lb-wrr-label">Resistance</span>
                <span v-for="r in cardDetail.resistances" :key="r.type" class="lb-wrr-value">
                  <span class="lb-energy-dot sm" :style="{ background: energyColor(r.type) }" :title="r.type"></span>
                  {{ r.value }}
                </span>
              </div>
              <div v-if="currentCard.retreat !== undefined" class="lb-wrr-item">
                <span class="lb-wrr-label">Retreat</span>
                <span class="lb-wrr-value">
                  <span v-for="i in currentCard.retreat" :key="i" class="lb-energy-dot sm" :style="{ background: energyColor('Colorless') }"></span>
                  <span v-if="currentCard.retreat === 0" class="lb-wrr-none">None</span>
                </span>
              </div>
            </div>

            <!-- Deck Controls -->
            <div class="lb-deck-controls">
              <button v-if="deckCount === 0" class="lb-add-btn" @click="addCard(currentCard)">
                Add to Decklist
              </button>
              <div v-else class="lb-deck-row">
                <button class="deck-ctrl-btn" @click="removeCard(currentCard.setCode, currentCard.localId)">&minus;</button>
                <span class="deck-ctrl-count">In Deck (x{{ deckCount }})</span>
                <button class="deck-ctrl-btn" @click="addCard(currentCard)">+</button>
              </div>
            </div>

            <!-- Proxy Settings -->
            <LightboxProxySettings
              :card="currentCard"
              @change="onProxySettingsChange"
            />

            <!-- Dev Tools (collapsible) -->
            <LightboxDevTools
              :current-card="currentCard"
              :has-cleaned-image="!!hasCleanedImage"
              :cleaned-image-url="cleanedImageUrl"
              :svg-url="svgUrl"
              :svg-loading="svgLoading"
              :svg-error="svgError"
              :generating="generating"
              :svg-regenerating="svgRegenerating"
              @generate="handleGenerate"
              @regenerate="handleRegenerate"
              @regenerate-svg="handleRegenerateSvg"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Zoom overlay -->
    <div v-if="showZoom" @click.stop>
      <CardZoom
        :image-url="zoomImageUrl"
        :alt="currentCard.name"
        @close="showZoom = false"
      />
    </div>
  </div>
</template>
