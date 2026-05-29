<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import type { Card, CardDetail } from "../../shared/types/card.js";
import CardFullArt    from "../lab/cards/CardFullArt.vue";
import CardTrainer    from "../lab/cards/CardTrainer.vue";
import CardBasicEnergy from "../lab/cards/CardBasicEnergy.vue";
import {
  adaptPokemon,
  adaptTrainer,
  adaptBasicEnergy,
  isSpecialEnergyCard,
} from "../lib/card-to-lab.js";

/*
 * Top-level CSS card renderer. Picks the lab component variant by category
 * (fullart Pokemon, trainer, basic energy) and runs the production Card →
 * LabCard adapter so the lab components — built around a tighter, lab-local
 * shape — can render the main app's enriched data.
 *
 * The .theme-default-fullart class scopes the lab's CSS variable block to this
 * subtree (themes/default-fullart.css defines all vars on that selector,
 * main.ts imports it once globally).
 *
 * Sizing: the lab cards draw at a native 750×1050 canvas. We measure the
 * outer container's width and apply `transform: scale(width / 750)` to the
 * inner 750×1050 box. CSS-only solutions (container queries) can't divide a
 * length by a unitless number into a transform-scale ratio, so we drive it
 * from JS via a ResizeObserver.
 */
const props = defineProps<{
  card: Card;
  detail?: CardDetail;
  artUrl: string;
}>();

type Variant = "fullart" | "trainer" | "basic-energy";

const variant = computed<Variant>(() => {
  if (props.card.category === "Pokemon") return "fullart";
  if (props.card.category === "Energy") {
    return isSpecialEnergyCard(props.card, props.detail) ? "trainer" : "basic-energy";
  }
  return "trainer";
});

const pokemonCard = computed(() => adaptPokemon(props.card, props.detail, props.artUrl));
const trainerCard = computed(() => adaptTrainer(props.card, props.detail, props.artUrl));
const basicEnergyCard = computed(() => adaptBasicEnergy(props.card, props.artUrl));

const outer = ref<HTMLDivElement | null>(null);
const measuredWidth = ref(0);
let ro: ResizeObserver | undefined;

onMounted(() => {
  if (!outer.value) return;
  // Seed from the initial layout so first paint already has the right scale.
  measuredWidth.value = outer.value.getBoundingClientRect().width;
  ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      if (e.contentRect.width > 0) measuredWidth.value = e.contentRect.width;
    }
  });
  ro.observe(outer.value);
});

onBeforeUnmount(() => {
  ro?.disconnect();
});

const scale = computed(() => (measuredWidth.value > 0 ? measuredWidth.value / 750 : 0));

const scalerStyle = computed(() => ({
  transform: `scale(${scale.value})`,
  transformOrigin: "top left",
}));

// Lock the renderer's layout height to the post-scale dimension so the
// 750x1050 scaler's natural footprint doesn't push the parent (.lb-card-css)
// out to 1050px tall.
const rendererStyle = computed(() => ({
  height: scale.value > 0 ? `${1050 * scale.value}px` : undefined,
}));
</script>

<template>
  <div ref="outer" class="css-card-renderer theme-default-fullart" :style="rendererStyle">
    <div class="css-card-scaler" :style="scalerStyle">
      <CardFullArt v-if="variant === 'fullart'" :card="pokemonCard" />
      <CardTrainer v-else-if="variant === 'trainer'" :card="trainerCard" />
      <CardBasicEnergy v-else :card="basicEnergyCard" />
    </div>
  </div>
</template>

<style scoped>
.css-card-renderer {
  width: 100%;
  aspect-ratio: 750 / 1050;
  position: relative;
  /* height is also bound inline via rendererStyle once we've measured width,
   * because the 750x1050 scaler's layout footprint would otherwise override
   * aspect-ratio's derived height. */
}

.css-card-scaler {
  width: 750px;
  height: 1050px;
  /* transform set inline via scalerStyle so JS can update it on resize */
}
</style>
