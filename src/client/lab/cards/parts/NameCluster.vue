<script setup lang="ts">
import { computed } from "vue";
import type { NameSuffix } from "../../types";

const props = defineProps<{
  name: string;
  suffix?: NameSuffix;
  evolvesFrom?: string;
}>();

/*
 * Suffix rendering: every named suffix maps to a single PNG logo. VMAX uses
 * the combined "V chrome + rainbow MAX" composite asset rather than two
 * separate marks — that's how real VMAX cards print, and the pre-built PNG
 * carries the metallic/rainbow treatment the live CSS can't approximate.
 */
const LOGO_FILES: Partial<Record<NameSuffix, string>> = {
  ex:    "/logos/pokemon-ex.png",
  V:     "/logos/pokemon-v.png",
  VSTAR: "/logos/pokemon-vstar.png",
  VMAX:  "/logos/pokemon-vmax.png",
};

const logoSrc = computed(() => props.suffix ? LOGO_FILES[props.suffix] : undefined);
</script>

<template>
  <div class="name-cluster">
    <div class="name-row">
      <h1 class="name">{{ name }}</h1>
      <img
        v-if="logoSrc"
        :src="logoSrc"
        :alt="suffix"
        class="suffix-logo"
        :data-suffix="suffix"
      />
    </div>
    <span v-if="evolvesFrom" class="evolves-from">Evolves from {{ evolvesFrom }}</span>
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
 * data/templates/pokemon-fullart.json. Sizing comes from $evolvesFrom.fullart.
 *
 * Legibility note: the "secondary" feel comes from fading the *fill* only
 * (rgb alpha on color). Element-level `opacity` would also fade the black
 * stroke, collapsing the contrast that keeps the text readable over busy
 * artwork. The stroke and shadow stay full-strength on purpose. */
.evolves-from {
  font-family: var(--font-infobar);
  font-weight: 700;
  font-size: var(--size-evolves-from);
  color: rgb(255 255 255 / 0.85);
  -webkit-text-stroke: var(--width-name-stroke) var(--color-name-stroke);
  text-shadow: 0 2px 6px rgb(0 0 0 / 0.9);
  paint-order: stroke fill;
  line-height: 1;
  white-space: nowrap;
}

/*
 * Inline flow (not flexbox) so suffix logos can vertical-align to the
 * text content area — the strip from the font's ascent line down to its
 * descent line. Flexbox's align-items only speaks in margin-box edges
 * (line-box bottom, which includes descender slack); CSS's `vertical-align`
 * is the primitive that knows about ascent/descent metrics from the font's
 * OS/2 table. The badge feels "part of the text" when it fills that strip.
 *
 * white-space:nowrap mirrors wrap=0 in the SVG renderer — long names
 * overflow rather than break to a second line. The name-anchor has no
 * right constraint so the overflow has somewhere to go.
 */
.name-row {
  white-space: nowrap;
  line-height: 1;
  /*
   * The badge uses vertical-align:text-bottom, which CSS resolves against
   * the *parent's* font metrics — not the sibling text's. Setting the row's
   * own font-size to --size-name makes "text-bottom" mean "descent line of
   * 48px Gill Sans," which is what we want. Without this it'd resolve
   * against an inherited 16px font and the badge would sit too high.
   */
  font-family: var(--font-title);
  font-size:   var(--size-name);
}

.name {
  display: inline-block;       /* sit inline with the suffix logo / text */
  margin: 0;
  font-family: var(--font-title);
  font-size:   var(--size-name);
  font-weight: var(--weight-title);
  line-height: 1;
  color: var(--color-name);
  -webkit-text-stroke: var(--width-name-stroke) var(--color-name-stroke);
  text-shadow: var(--shadow-title);
  paint-order: stroke fill;
}

/*
 * Logo height (var(--size-suffix-logo) = 55px) is calibrated to roughly
 * equal the name font's ascent + descent (1.146× the 48px name size).
 * vertical-align:text-bottom anchors the logo's bottom edge to the text's
 * descent line — since height ≈ ascent+descent, its top edge lands at the
 * ascent line. Result: the badge fills the same vertical strip as the
 * letterforms, no floating, no protrusion.
 *
 * If --size-name changes (e.g. a future name-shrinking pass for long
 * names), bump --size-suffix-logo proportionally to keep the relationship.
 */
.suffix-logo {
  display: inline-block;
  vertical-align: text-bottom;
  height: var(--size-suffix-logo);
  width: auto;
  margin-left: 12px;
  filter: drop-shadow(0 4px 4px rgb(0 0 0 / 0.6));
}

</style>
