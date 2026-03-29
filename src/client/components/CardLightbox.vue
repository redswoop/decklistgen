<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import type { Card } from "../../shared/types/card.js";
import {
  useVariants,
  usePokeproxy,
  usePokeproxyStatus,
  isGenerating,
  generateCleanImage,
  regenerateSvg,
  useGenerationQueryClient,
  getGenerationVersion,
  getCardImageUrl,
} from "../composables/usePokeproxy.js";
import { useCardDetail } from "../composables/useCardDetail.js";
import { api } from "../lib/client.js";
import { useDecklist } from "../composables/useDecklist.js";
import { useDecks } from "../composables/useDecks.js";
import { useAuth } from "../composables/useAuth.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import CardZoom from "./lightbox/CardZoom.vue";
import LightboxDevTools from "./lightbox/LightboxDevTools.vue";
import type { DeckMembership } from "../../shared/types/customized-card.js";
import type { DeckCard } from "../../shared/types/deck.js";
import { consolidateDeckCards } from "../../shared/utils/consolidate-deck.js";
import { deduplicateByArt } from "../../shared/utils/variant-allocation.js";
import { getRarityRank } from "../../shared/utils/rarity-rank.js";

function artTier(rarity: string): number {
  const rank = getRarityRank(rarity);
  return rank <= 3 ? 0 : rank;
}

useGenerationQueryClient();
const { imageMode } = usePokeproxy();

// Version selection (sticky via localStorage)
type CardVersion = "original" | "cleaned" | "proxy";
const VERSION_LS_KEY = "decklistgen-card-version";
const selectedVersion = ref<CardVersion>(
  (localStorage.getItem(VERSION_LS_KEY) as CardVersion) || "proxy",
);

function selectVersion(v: CardVersion) {
  selectedVersion.value = v;
  localStorage.setItem(VERSION_LS_KEY, v);
}

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
  deckMembership?: DeckMembership[];
  deckName?: string;
  /** When set, replace operates on this saved deck instead of working deck */
  savedDeckId?: string;
  savedDeckCards?: DeckCard[];
}>();
const emit = defineEmits<{
  close: [];
  cardChange: [cardId: string];
  deckUpdated: [];
}>();

const { addCard, removeCard, getDeckCount, findSwappable, replaceCard } = useDecklist();
const { isAuthorized } = useAuth();
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

// Variant navigation — deduplicate same-art reprints
const activeCardId = computed(() => activeCard.value.id);
const { data: rawVariants } = useVariants(activeCardId);
const variants = computed(() => rawVariants.value ? deduplicateByArt(rawVariants.value) : undefined);

// Same-art printings of the current card (same illustrator + same art tier, different set)
const sameArtPrintings = computed(() => {
  if (!rawVariants.value) return [];
  const current = currentCard.value;
  if (!current.illustrator) return [];
  const currentTier = artTier(current.rarity);
  return rawVariants.value.filter(
    (v) => v.id !== current.id && v.illustrator === current.illustrator && artTier(v.rarity) === currentTier,
  );
});
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
const deckCount = computed(() => {
  if (props.savedDeckCards) {
    const card = currentCard.value;
    return props.savedDeckCards.find(
      (dc) => dc.card.setCode === card.setCode && dc.card.localId === card.localId
    )?.count ?? 0;
  }
  return getDeckCount(currentCard.value.setCode, currentCard.value.localId);
});

function getContextDeckCount(setCode: string, localId: string): number {
  if (props.savedDeckCards) {
    return props.savedDeckCards.find(
      (dc) => dc.card.setCode === setCode && dc.card.localId === localId
    )?.count ?? 0;
  }
  return getDeckCount(setCode, localId);
}

// Swap detection: check saved deck cards if available, otherwise working deck
const swappableItem = computed(() => {
  const card = currentCard.value;
  if (props.savedDeckCards?.length) {
    const matches = props.savedDeckCards.filter(
      (dc) => dc.card.name === card.name && dc.card.mechanicsHash === card.mechanicsHash && !(dc.card.setCode === card.setCode && dc.card.localId === card.localId)
    );
    if (!matches.length) return null;
    // Prefer the card the user actually clicked on (activeCard)
    const active = activeCard.value;
    const preferred = matches.find(dc => dc.card.setCode === active.setCode && dc.card.localId === active.localId);
    const match = preferred ?? matches[0];
    return { setCode: match.card.setCode, localId: match.card.localId, name: match.card.name, count: match.count };
  }
  return findSwappable(card);
});

const { updateDeck } = useDecks();

async function handleAdd() {
  const card = currentCard.value;
  if (props.savedDeckId && props.savedDeckCards) {
    const newCards = [...props.savedDeckCards];
    const existing = newCards.find(
      (dc) => dc.card.setCode === card.setCode && dc.card.localId === card.localId
    );
    if (existing) {
      existing.count++;
    } else {
      newCards.push({ count: 1, card });
    }
    await updateDeck({ id: props.savedDeckId, data: { cards: newCards } });
    emit("deckUpdated");
  } else {
    addCard(card);
  }
}

async function handleRemove() {
  const card = currentCard.value;
  if (props.savedDeckId && props.savedDeckCards) {
    const newCards: DeckCard[] = [];
    for (const dc of props.savedDeckCards) {
      if (dc.card.setCode === card.setCode && dc.card.localId === card.localId) {
        if (dc.count > 1) newCards.push({ ...dc, count: dc.count - 1 });
      } else {
        newCards.push(dc);
      }
    }
    await updateDeck({ id: props.savedDeckId, data: { cards: newCards } });
    emit("deckUpdated");
  } else {
    removeCard(card.setCode, card.localId);
  }
}

async function handleReplace() {
  if (!swappableItem.value) return;
  const oldSet = swappableItem.value.setCode;
  const oldLocal = swappableItem.value.localId;
  const newCard = currentCard.value;

  if (props.savedDeckId && props.savedDeckCards) {
    const newCards = props.savedDeckCards.map(dc => ({ ...dc }));
    // Decrement old card by 1
    const oldIdx = newCards.findIndex(dc => dc.card.setCode === oldSet && dc.card.localId === oldLocal);
    if (oldIdx !== -1) {
      if (newCards[oldIdx].count > 1) newCards[oldIdx].count--;
      else newCards.splice(oldIdx, 1);
    }
    // Increment new card by 1
    const newIdx = newCards.findIndex(dc => dc.card.setCode === newCard.setCode && dc.card.localId === newCard.localId);
    if (newIdx !== -1) newCards[newIdx].count++;
    else newCards.push({ count: 1, card: newCard });
    // Defensive consolidation
    await updateDeck({ id: props.savedDeckId, data: { cards: consolidateDeckCards(newCards) } });
    emit("deckUpdated");
  } else {
    replaceCard(oldSet, oldLocal, newCard);
  }
}

// Card detail (attacks, abilities, weakness/resistance)
const currentCardId = computed(() => currentCard.value.id);

// Emit card changes for URL sync (skip the initial value — App.vue already knows)
watch(currentCardId, (id) => {
  emit("cardChange", id);
});
const lightboxOpen = ref(true);
const { data: cardDetail } = useCardDetail(currentCardId, lightboxOpen);

// Pokeproxy status for current variant
const { data: ppStatus } = usePokeproxyStatus(currentCardId);

const hasCleanedImage = computed(() =>
  ppStatus.value?.hasClean || ppStatus.value?.hasComposite
);

// Local bump for settings changes; global generationVersion handles cross-component cache busting
const localBust = ref(0);

const cacheBust = computed(() =>
  getGenerationVersion(currentCard.value.id) + localBust.value
);

const cleanedImageUrl = computed(() => {
  if (!ppStatus.value) return null;
  const v = cacheBust.value;
  if (ppStatus.value.hasComposite) return api.pokeproxyImageUrl(currentCard.value.id, "composite", v);
  if (ppStatus.value.hasClean) return api.pokeproxyImageUrl(currentCard.value.id, "clean", v);
  return null;
});

// Background art: cleaned image if available, else original (low-res, decorative blur)
const bgImageUrl = computed(() => cleanedImageUrl.value ?? (cardImageUrl(currentCard.value.imageBase, "low") || null));

// Main image URL based on selected version
const mainImageUrl = computed(() => {
  if (selectedVersion.value === "cleaned" && cleanedImageUrl.value) {
    return cleanedImageUrl.value;
  }
  if (selectedVersion.value === "cleaned" && !cleanedImageUrl.value) {
    // No cleaned image — show original as background for the "generate" overlay
    return currentCard.value.imageBase
      ? cardImageUrl(currentCard.value.imageBase, "high")
      : null;
  }
  if (selectedVersion.value === "proxy" && !hasCleanedImage.value) {
    // Proxy without clean — no background image, SVG only
    return null;
  }
  // Original or proxy-with-clean
  return currentCard.value.imageBase
    ? cardImageUrl(currentCard.value.imageBase, "high")
    : null;
});

// SVG Proxy
const svgUrl = computed(() => {
  const v = cacheBust.value;
  return api.pokeproxySvgUrl(currentCard.value.id, undefined, v);
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
    // generationVersion was already bumped globally; just reset SVG loading state
    svgLoading.value = true; svgError.value = false;
  }
});

function handleGenerate() {
  generateCleanImage(currentCard.value.id);
}

function handleRegenerate() {
  generateCleanImage(currentCard.value.id, true);
}

// Whether the current version needs a cleaned image that doesn't exist yet
const needsGeneration = computed(() => {
  if (generating.value) return false;
  if (selectedVersion.value === "cleaned" && !cleanedImageUrl.value) return true;
  if (selectedVersion.value === "proxy" && !hasCleanedImage.value) return true;
  return false;
});

// Show regenerate button when a cleaned image exists and we're in cleaned/proxy view
const canRegenerate = computed(() => {
  if (generating.value) return false;
  if (selectedVersion.value === "original") return false;
  return !!hasCleanedImage.value && isAuthorized.value;
});

function handleMainImageClick() {
  if (needsGeneration.value) {
    hasCleanedImage.value ? handleRegenerate() : handleGenerate();
  } else {
    showZoom.value = true;
  }
}

const svgRegenerating = ref(false);
async function handleRegenerateSvg() {
  if (svgRegenerating.value) return;
  svgRegenerating.value = true;
  svgLoading.value = true; svgError.value = false;
  try {
    await regenerateSvg(currentCard.value.id);
    localBust.value++;
  } finally {
    svgRegenerating.value = false;
  }
}


// Zoom
const showZoom = ref(false);
const zoomImageUrl = computed(() => {
  if (selectedVersion.value === "cleaned" && cleanedImageUrl.value) {
    return cleanedImageUrl.value;
  }
  if (selectedVersion.value === "proxy" && !svgLoading.value && !svgError.value) {
    return svgUrl.value;
  }
  return cardImageUrl(currentCard.value.imageBase, "high");
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

function navigateToDeck(deckId: string) {
  window.location.hash = `#/decks/${deckId}`;
  emit("close");
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
          <div v-if="source === 'deck'" class="lb-source-label">{{ deckName ?? 'Browsing Deck' }}</div>
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
          <div v-if="sameArtPrintings.length" class="lb-meta lb-same-art">
            Also printed in: {{ sameArtPrintings.map(v => `${v.setName} #${v.localId}`).join(', ') }}
          </div>
        </div>
        <button class="nav-btn" :disabled="searchIndex >= searchCards.length - 1" @click="nextCard">&rsaquo;</button>
        <button class="lightbox-close" @click="emit('close')">&times;</button>
      </div>

      <!-- Body: top area (image + variants grid), bottom area (version picker + info) -->
      <div class="lb-body">
        <!-- Left: card image + version picker -->
        <div class="lb-left">
          <div class="lb-card-image" @click="handleMainImageClick">
            <img
              v-if="mainImageUrl"
              :src="mainImageUrl"
              :alt="currentCard.name"
              class="lb-img"
            />
            <div v-else class="lb-img-placeholder">{{ selectedVersion !== 'proxy' ? currentCard.name : '' }}</div>
            <img
              :src="svgUrl"
              :alt="currentCard.name"
              :class="['lb-img-svg', { loaded: selectedVersion === 'proxy' && !svgLoading && !svgError }]"
              @load="onSvgLoad"
              @error="onSvgError"
            />
            <div v-if="generating" class="lb-generating-overlay">
              <div class="generate-spinner"></div>
              <div class="lb-gen-text">Generating...</div>
            </div>
            <div v-else-if="needsGeneration" class="lb-generate-cta" @click.stop="handleMainImageClick">
              <span class="lb-generate-cta-text">{{ isAuthorized ? 'Click to generate' : 'Authorization required' }}</span>
            </div>
            <div v-if="!needsGeneration && !generating" class="lb-zoom-hint">Click to zoom</div>
            <button
              v-if="canRegenerate"
              class="lb-regen-btn"
              @click.stop="handleRegenerate"
              title="Regenerate cleaned image"
            >&#x21bb;</button>
          </div>

          <div class="lb-versions">
            <div :class="['lb-version', { active: selectedVersion === 'original' }]">
              <div class="lb-version-thumb" @click="selectVersion('original')">
                <img v-if="currentCard.imageBase" :src="cardImageUrl(currentCard.imageBase, 'low')" class="lb-version-img" />
                <div v-else class="lb-version-placeholder">?</div>
              </div>
              <span class="lb-version-label">Original</span>
            </div>
            <div :class="['lb-version', { active: selectedVersion === 'cleaned' }]">
              <div class="lb-version-thumb" @click="selectVersion('cleaned')">
                <div v-if="generating" class="lb-version-placeholder"><div class="generate-spinner small"></div></div>
                <img v-else-if="cleanedImageUrl" :src="cleanedImageUrl" class="lb-version-img" />
                <div v-else class="lb-version-placeholder">--</div>
              </div>
              <span class="lb-version-label">Cleaned</span>
            </div>
            <div :class="['lb-version', { active: selectedVersion === 'proxy' }]">
              <div class="lb-version-thumb" @click="selectVersion('proxy')">
                <img v-if="!svgLoading && !svgError" :src="svgUrl" class="lb-version-img" />
                <div v-else class="lb-version-placeholder">
                  <div v-if="svgLoading || svgRegenerating" class="generate-spinner small"></div>
                  <span v-else>--</span>
                </div>
              </div>
              <span class="lb-version-label">Proxy</span>
            </div>
          </div>
        </div>

        <!-- Right: scrolling stack — variants, card stats, actions -->
        <div class="lb-right">
          <div class="lb-info-scroll">
            <!-- Variant grid -->
            <div v-if="hasMultipleVariants" class="lb-variants-section">
              <div class="lb-variants-grid">
                <div
                  v-for="(v, i) in variants"
                  :key="v.id"
                  :class="['lb-variant', { active: i === variantIndex }]"
                  @click="variantIndex = i"
                >
                  <img v-if="v.imageBase" :src="getCardImageUrl(v, imageMode, 'low') ?? cardImageUrl(v.imageBase, 'low')" class="lb-variant-img" />
                  <div v-else class="lb-variant-placeholder">?</div>
                  <span v-if="getContextDeckCount(v.setCode, v.localId)" class="lb-variant-badge">
                    {{ getContextDeckCount(v.setCode, v.localId) }}
                  </span>
                  <span class="lb-variant-set">{{ v.setCode }} #{{ v.localId }}</span>
                </div>
              </div>
            </div>

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
              <button v-if="deckCount === 0" class="lb-add-btn" @click="handleAdd">
                {{ savedDeckId ? 'Add to Deck' : 'Add to Decklist' }}
              </button>
              <div v-else class="lb-deck-row">
                <button class="deck-ctrl-btn" @click="handleRemove">&minus;</button>
                <span class="deck-ctrl-count">In Deck (x{{ deckCount }})</span>
                <button class="deck-ctrl-btn" @click="handleAdd">+</button>
              </div>
              <button
                v-if="swappableItem"
                class="lb-replace-btn"
                @click="handleReplace"
              >
                Swap 1× {{ swappableItem.setCode }} #{{ swappableItem.localId }}
              </button>
            </div>

            <!-- Deck Membership (from Cards view) -->
            <div v-if="deckMembership?.length" class="lb-deck-membership">
              <div class="lb-dm-header">Appears in Decks</div>
              <div
                v-for="dm in deckMembership"
                :key="dm.deckId"
                class="lb-dm-entry"
                @click="navigateToDeck(dm.deckId)"
              >
                <span class="lb-dm-name">{{ dm.deckName }}</span>
                <span class="lb-dm-count">x{{ dm.count }}</span>
              </div>
            </div>

            <!-- Dev Tools (collapsible) -->
            <LightboxDevTools
              :current-card="currentCard"
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
