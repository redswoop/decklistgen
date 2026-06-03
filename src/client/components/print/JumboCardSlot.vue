<script setup lang="ts">
// One card slot in the jumbo pair-picker: a preview (CSS proxy or plain image)
// plus a per-card version toggle. Handles the optional/empty slot (card === null)
// for Card 2. Styling: global .jumbo-* rules in styles/jumbo.css.
import type { Card } from "../../../shared/types/card.js";
import type { ArtMode } from "../../../shared/utils/print-params.js";
import { getCardImageUrl } from "../../composables/usePokeproxy.js";
import { cardImageUrl } from "../../../shared/utils/card-image-url.js";
import CssCardRenderer from "../CssCardRenderer.vue";

defineProps<{
  card: Card | null;
  label: string;
  sublabel: string;
  clearable?: boolean;
}>();

const version = defineModel<ArtMode>("version", { required: true });

const emit = defineEmits<{ clear: [] }>();

/**
 * Preview art for a slot at a given version: original → the untouched scan;
 * cleaned/proxy → the cleaned PNG (falling back to original if none). The proxy
 * case is rendered by CssCardRenderer over this URL.
 */
function previewImg(card: Card, v: ArtMode): string | null {
  if (v === "original") return cardImageUrl(card.imageBase, "low");
  return getCardImageUrl(card, "proxy", "low") ?? cardImageUrl(card.imageBase, "low");
}

const VERSIONS: { value: ArtMode; label: string }[] = [
  { value: "original", label: "Original" },
  { value: "cleaned", label: "Cleaned" },
  { value: "proxy", label: "Proxy" },
];
</script>

<template>
  <div class="jumbo-slot">
    <div class="jumbo-slot-label">
      {{ label }} <span>{{ sublabel }}</span>
      <button v-if="clearable && card" class="jumbo-clear" type="button" @click="emit('clear')">Clear</button>
    </div>

    <template v-if="card">
      <div class="jumbo-preview">
        <div v-if="version === 'proxy'" class="jumbo-preview-css">
          <CssCardRenderer :card="card" :art-url="previewImg(card, 'proxy') ?? ''" />
        </div>
        <img v-else :src="previewImg(card, version) ?? ''" :alt="card.name" />
      </div>
      <div class="jumbo-versions" role="group" :aria-label="`${label} version`">
        <button
          v-for="opt in VERSIONS"
          :key="opt.value"
          type="button"
          class="jumbo-version-btn"
          :class="{ active: version === opt.value }"
          @click="version = opt.value"
        >{{ opt.label }}</button>
      </div>
    </template>
    <div v-else class="jumbo-slot-empty">No second card</div>
  </div>
</template>
