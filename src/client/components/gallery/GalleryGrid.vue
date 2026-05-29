<script setup lang="ts">
import GallerySvgThumb from "../GallerySvgThumb.vue";
import { isGenerating } from "../../composables/usePokeproxy.js";
import type { GalleryCardWithSource } from "../../composables/useGalleryCardSource.js";

type PreviewMode = "editing" | "physical";

const props = defineProps<{
  cards: GalleryCardWithSource[];
  selectedCardId: string | null;
  previewMode: PreviewMode;
  thumbWidth: number;
  /** Per-card cache-bust resolver. The grid evaluates this inside the v-for
   *  binding so a per-card bump only updates the affected thumb's prop, not
   *  the whole grid. (See useGallerySvgRev.) */
  svgRevFor: (cardId: string) => number;
}>();

const emit = defineEmits<{
  select: [card: GalleryCardWithSource];
  "open-editor": [cardId: string];
  swap: [card: GalleryCardWithSource];
}>();

/** A reference slot is "swappable" when it has a slotKey set — i.e. it came
 *  from TEST_CARDS (or an override of one). Deck cards aren't swappable. */
function isSwappable(card: GalleryCardWithSource): boolean {
  return card.source === "reference" && !!card.slotKey;
}

function hasOverride(card: GalleryCardWithSource): boolean {
  return !!card.slotKey && card.slotKey !== card.cardId;
}

type ThumbBadge = { text: string; variant: "standard" | "fullart" | "clean" | "expanded" | "missing" | "reference" };

function metaLine(card: GalleryCardWithSource): string {
  return [card.category, card.stage, card.hp ? `HP ${card.hp}` : null,
    card.energyTypes?.join(", ") || null, card.rarity].filter(Boolean).join(" | ");
}

function badgesFor(card: GalleryCardWithSource): ThumbBadge[] {
  const out: ThumbBadge[] = [];
  if (card.source === "reference") {
    out.push({ text: "REFERENCE", variant: "reference" });
  }
  if (!card.hasClean && !card.hasComposite) {
    out.push({ text: "MISSING ART", variant: "missing" });
  } else {
    out.push(card.isFullArt
      ? { text: "CLEANED", variant: "clean" }
      : { text: "EXPANDED", variant: "expanded" });
  }
  out.push(card.isFullArt
    ? { text: "FULLART", variant: "fullart" }
    : { text: "STANDARD", variant: "standard" });
  return out;
}
</script>

<template>
  <div :class="['gallery-grid', previewMode === 'physical' && 'gallery-grid-physical']">
    <GallerySvgThumb
      v-for="card in cards"
      :key="card.cardId"
      :card-id="card.cardId"
      :card="card.card"
      :has-clean="card.hasClean"
      :cache-bust="svgRevFor(card.cardId)"
      :width="thumbWidth"
      :label="card.label"
      :name="card.name"
      :meta-line="metaLine(card)"
      :badges="badgesFor(card)"
      :loading="isGenerating(card.cardId)"
      :selected="selectedCardId === card.cardId"
      :physical="previewMode === 'physical'"
      :chrome="previewMode === 'physical' ? 'compact' : 'full'"
      :swappable="isSwappable(card)"
      :has-override="hasOverride(card)"
      @click="emit('select', card)"
      @dblclick="emit('open-editor', card.cardId)"
      @swap="emit('swap', card)"
    />
  </div>
</template>

<style scoped>
.gallery-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  justify-content: flex-start;
}
.gallery-grid-physical { gap: 10px; }
</style>
