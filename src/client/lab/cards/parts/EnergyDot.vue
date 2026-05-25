<script setup lang="ts">
import { computed } from "vue";
import type { EnergyType } from "../../types";

/*
 * Energy circle — matches renderTypeIcon() in
 * src/server/services/pokeproxy/type-icons.ts as closely as the
 * CSS box model allows.
 *
 * Layers (bottom to top):
 *   1. Solid type-color background
 *   2. Radial-gradient overlay (top-left highlight → soft fade →
 *      bottom-right shade) for the inset glassy look
 *   3. Inner white-ring + outer black-ring via box-shadow
 *   4. Specular highlight ellipse via ::before
 *   5. EssentiarumTCG glyph centered (or inline SVG paths for Dragon,
 *      since 'N' renders as "LEGEND" in that font)
 *
 * Sizing: `size` is the diameter in CSS px (matches SVG radius * 2).
 */

const props = defineProps<{
  type: EnergyType;
  /** Diameter in px. Default 42 ≈ radius 21 in pokemon-fullart.json. */
  size?: number;
}>();

/** Glyph character per type (mirrors ICON_MAP in type-icons.ts). */
const GLYPH: Record<EnergyType, string> = {
  Grass: "G", Fire: "R", Water: "W", Lightning: "L", Psychic: "P",
  Fighting: "F", Darkness: "D", Metal: "M", Fairy: "Y",
  Dragon: "N",   // unused — Dragon renders via inline SVG below
  Colorless: "C",
};

const diameter = computed(() => props.size ?? 42);
const radius   = computed(() => diameter.value / 2);

/* font-size = radius * 1.55, matching type-icons.ts line 178. */
const glyphFontSize = computed(() => Math.floor(radius.value * 1.55));

/* Stroke width on glyph = max(1, radius * 0.08), same source. */
const glyphStrokeWidth = computed(() =>
  Math.max(1, radius.value * 0.08).toFixed(1)
);

const isDragon = computed(() => props.type === "Dragon");
</script>

<template>
  <span
    class="energy-dot"
    :style="{
      width:  diameter + 'px',
      height: diameter + 'px',
      '--bg': `var(--color-type-${type})`,
      '--ring': Math.max(1, radius * 0.08).toFixed(1) + 'px',
      '--inner-ring': Math.max(0.5, radius * 0.04).toFixed(1) + 'px',
    }"
    :title="type"
  >
    <span class="highlight" />

    <!-- Dragon: inline SVG paths copied from DRAGON_PATHS in type-icons.ts.
         The original 256-unit drawing is scaled to fit (radius*2)/256. -->
    <svg
      v-if="isDragon"
      class="dragon"
      viewBox="0 0 256 256"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <path fill="#fff" d="M170.93,124.41c.8,15.21-5.05,28.07-14.96,38.95-4.86,5.34-7.13,10.82-7.01,17.85.07,4.3-.64,8.63-1.21,12.91-1.48,11.17-7.97,16.55-19.79,16.53-11.81-.02-18.2-5.38-19.75-16.59-.18-1.32-.43-2.65-.42-3.97.07-12.31-3.37-22.68-11.93-32.43-14.25-16.22-14.56-45.3-2.66-60.49,5.82-7.42,4.65-17.14,7.55-25.58,2.37-6.9,4.02-14.05,6.07-21.06,.48-1.65,1.51-3.06,3.48-3,2.02,.06,2.71,1.6,3.11,3.3,1.8,7.77,4.05,15.47,5.23,23.33,.95,6.31,4.94,5.95,9.39,5.97,4.5,.02,8.42,.25,9.35-6.03,1.11-7.53,3.32-14.9,5.03-22.34,.45-1.96,.74-4.19,3.34-4.19,2.43,0,3.15,1.99,3.71,4,1.88,6.72,3.88,13.4,5.7,20.14,3.01,11.13,4.22,22.74,11.59,32.51,4.31,5.71,3.98,13.22,4.18,20.21Z"/>
      <path fill="#fff" d="M194.2,95.93c16.78,17.37,18.87,64.53-8.22,85.49-5.83-6.35-8.44-14.77-13.52-21.58-.65-.87-.74-2.88-.18-3.82,5.41-9,4.95-20.46,12.96-28.54,7.84-7.92,9.39-18.61,8.97-31.55Z"/>
      <path fill="var(--color-type-Dragon)" d="M141.47,153.95c6.61-10.7,12.32-19.93,18.62-30.12,5.76,18.39-.34,28.8-18.62,30.12Z"/>
      <path fill="#fff" d="M61.68,95.93c-16.78,17.37-18.87,64.53,8.22,85.49,5.83-6.35,8.44-14.77,13.52-21.58,.65-.87,.74-2.88,.18-3.82-5.41-9-4.95-20.46-12.96-28.54-7.84-7.92-9.39-18.61-8.97-31.55Z"/>
      <path fill="var(--color-type-Dragon)" d="M115.46,153.95c-6.61-10.7-12.32-19.93-18.62-30.12-5.76,18.39,.34,28.8,18.62,30.12Z"/>
    </svg>

    <span
      v-else
      class="glyph"
      :style="{
        fontSize:        glyphFontSize + 'px',
        WebkitTextStrokeWidth: glyphStrokeWidth + 'px',
      }"
    >{{ GLYPH[type] }}</span>
  </span>
</template>

<style scoped>
/*
 * Single span hosting the entire icon. Background composes the solid color
 * with the radial inset gradient; box-shadow gives the inner white ring +
 * outer black ring (mirrors the two SVG <circle> stroke rings).
 */
.energy-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  background:
    radial-gradient(
      circle at 45% 40%,
      rgba(255, 255, 255, 0.35) 0%,
      rgba(0, 0, 0, 0)         60%,
      rgba(0, 0, 0, 0.30)     100%
    ),
    var(--bg);
  box-shadow:
    inset 0 0 0 var(--inner-ring) rgba(255, 255, 255, 0.15),
    0     0 0 var(--ring)         rgba(0,   0,   0,   0.50);
}

/*
 * Specular highlight ellipse near the top — mirrors the second radial
 * gradient + ellipse in glassyCircle() (type-icons.ts).
 */
.highlight {
  position: absolute;
  left:  15%;
  right: 15%;
  top:    4%;
  height: 45%;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at center 30%,
    rgba(255, 255, 255, 0.55) 0%,
    rgba(255, 255, 255, 0.12) 50%,
    rgba(255, 255, 255, 0)   100%
  );
  pointer-events: none;
}

/*
 * Glyph: EssentiarumTCG character with white stroke + dark fill.
 * paint-order:stroke fill puts the stroke behind the fill so the letter
 * stays crisp (same trick as the SVG renderer uses).
 */
.glyph {
  position: relative;
  font-family: "EssentiarumTCG", sans-serif;
  line-height: 1;
  color: #111;
  -webkit-text-stroke-color: #fff;
  paint-order: stroke fill;
  /* nudge slightly down — EssentiarumTCG glyphs sit visually high */
  transform: translateY(2%);
}

.dragon {
  position: relative;
  width:  100%;
  height: 100%;
}
</style>
