<script setup lang="ts">
import { computed } from "vue";
import type { NameSuffix } from "../../types";

const props = defineProps<{
  name: string;
  suffix?: NameSuffix;
  evolvesFrom?: string;
}>();

/*
 * Suffix rendering: ex/V/VSTAR have PNG logos shipped from the SVG renderer's
 * asset folder; VMAX has no asset and renders as styled text. If/when a VMAX
 * logo lands at /logos/pokemon-vmax.png, add it to LOGO_FILES below.
 */
const LOGO_FILES: Partial<Record<NameSuffix, string>> = {
  ex:    "/logos/pokemon-ex.png",
  V:     "/logos/pokemon-v.png",
  VSTAR: "/logos/pokemon-vstar.png",
};

const logoSrc = computed(() => props.suffix ? LOGO_FILES[props.suffix] : undefined);
</script>

<template>
  <div class="name-cluster">
    <span v-if="evolvesFrom" class="evolves-from">Evolves from {{ evolvesFrom }}</span>
    <div class="name-row">
      <h1 class="name">{{ name }}</h1>
      <img
        v-if="logoSrc"
        :src="logoSrc"
        :alt="suffix"
        class="suffix-logo"
        :data-suffix="suffix"
      />
      <span
        v-else-if="suffix"
        class="suffix-text"
        :data-suffix="suffix"
      >{{ suffix }}</span>
    </div>
  </div>
</template>

<style scoped>
.name-cluster {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Evolves-from uses the infobar (Frutiger) face and a stroke, matching
 * fontFamily="infobar" + strokeWidth=2.5 on the evolves-from text node in
 * data/templates/pokemon-fullart.json. Sizing comes from $evolvesFrom.fullart. */
.evolves-from {
  font-family: var(--font-infobar);
  font-weight: 700;
  font-size: var(--size-evolves-from);
  color: var(--color-name);
  opacity: var(--opacity-secondary);
  -webkit-text-stroke: var(--width-name-stroke) var(--color-name-stroke);
  text-shadow: var(--shadow-title);
  paint-order: stroke fill;
  line-height: 1;
  white-space: nowrap;
}

.name-row {
  display: flex;
  align-items: end;
  gap: 12px;
}

/* nowrap mirrors wrap=0 in the SVG renderer — long names overflow rather
 * than break to a second line. The name-anchor has no right constraint so
 * the overflow has somewhere to go. */
.name {
  margin: 0;
  font-family: var(--font-title);
  font-size:   var(--size-name);
  font-weight: var(--weight-title);
  line-height: 1;
  color: var(--color-name);
  -webkit-text-stroke: var(--width-name-stroke) var(--color-name-stroke);
  text-shadow: var(--shadow-title);
  paint-order: stroke fill;
  white-space: nowrap;
}

/*
 * Logo: image-based, fixed pixel height per --size-suffix-logo. Width is
 * implicit from intrinsic aspect ratio. drop-shadow mirrors --shadow-title
 * so logos sit on the art with the same depth cue as the name text.
 *
 * The SVG renderer's JSON template specifies a literal `"height": 55` on
 * the suffix-image node (not a multiple of the name font size). Matching
 * that absolute behavior keeps cross-renderer parity — see
 * data/templates/pokemon-fullart.json.
 */
.suffix-logo {
  height: var(--size-suffix-logo);
  width: auto;
  display: block;
  margin-bottom: 4px;
  filter: drop-shadow(0 4px 4px rgb(0 0 0 / 0.6));
}

/* Text fallback (VMAX) — styled to read as a logo until we have an asset. */
.suffix-text {
  font-family: var(--font-title);
  font-weight: var(--weight-title);
  font-size: calc(var(--size-name) * 0.55);
  letter-spacing: 0.04em;
  color: var(--color-name);
  -webkit-text-stroke: var(--width-name-stroke) var(--color-name-stroke);
  text-shadow: var(--shadow-title);
  padding-bottom: 4px;
  paint-order: stroke fill;
}
</style>
