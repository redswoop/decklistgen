<script setup lang="ts">
import { computed } from "vue";
import type { LabBasicEnergyCard } from "../types";

const props = defineProps<{
  card: LabBasicEnergyCard;
}>();

/*
 * Pill tint comes from the energy palette so a Fire card gets a warm pill
 * over Fire-tinted decoration, a Water card gets blue, etc. The CSS picks
 * up `--energy-tint` and routes it into the pill bg / accent color. Themes
 * then control luminosity (saturation, stroke weight, etc.) per their look.
 */
const tintStyle = computed(() => ({
  "--energy-tint": `var(--color-type-${props.card.energyType})`,
}));
</script>

<template>
  <article class="card" :style="tintStyle">
    <img class="art" :src="card.artUrl" alt="" aria-hidden="true" />

    <div class="name-anchor">
      <h1 class="name">{{ card.name }}</h1>
    </div>

    <div class="pill-anchor">
      <span class="pill">Basic Energy</span>
    </div>

    <div class="footer-anchor">
      <div class="footer-panel">
        <span class="footer-text">{{ card.footer ?? "" }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
/*
 * Mirrors basic-energy.json geometry. The card has three elements:
 *   name-cluster   anchorX=45, anchorY=76, vAlign=bottom
 *   energy-type    anchorX=30 hAnchor=right, anchorY=20  ("Basic Energy" pill)
 *   footer-block   anchorX=20, anchorY=0  vAnchor=bottom (glassy panel w/ set+num)
 *
 * SVG-parity anchor convention: anchorY in the JSON is the baseline of text
 * for vAlign=bottom; CSS top here offsets by ~8px to compensate, matching the
 * convention already used in CardTrainer.vue's name-anchor (template Y=86 → top=78).
 */
.card {
  position: relative;
  width:  calc(var(--card-w) * 1px);
  height: calc(var(--card-h) * 1px);
  border-radius: 28px;
  overflow: hidden;
  background: #111;
  font-family: var(--font-body);
  color: var(--color-name);
  box-shadow: 0 12px 32px rgb(0 0 0 / 0.4);
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

.art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  user-select: none;
  -webkit-user-drag: none;
}

.name-anchor {
  position: absolute;
  left: 45px;
  top:  68px;
}

.name {
  margin: 0;
  font-family: var(--font-title);
  font-weight: var(--weight-title);
  font-size:   var(--size-trainer-name);
  color: var(--color-name);
  -webkit-text-stroke: var(--width-name-stroke) var(--color-name-stroke);
  text-shadow: var(--shadow-title);
  paint-order: stroke fill;
  line-height: 1;
  white-space: nowrap;
}

/*
 * "Basic Energy" pill — top-right corner. Tint comes from --energy-tint so
 * a Fire card's pill leans warm, a Water card's leans cool, etc. Themes own
 * the stroke widths, font, and final saturation.
 */
.pill-anchor {
  position: absolute;
  right: 30px;
  top:   20px;
}

.pill {
  display: inline-block;
  font-family: var(--font-title);
  font-weight: var(--weight-title);
  font-size:   var(--size-energy-pill-label);
  color:       var(--color-energy-pill-text);
  background:  var(--color-energy-pill-bg);
  border:      var(--width-energy-pill-border) solid var(--color-energy-pill-border);
  border-radius: 16px;
  padding: 4px 16px;
  -webkit-text-stroke: var(--width-energy-pill-stroke) var(--color-energy-pill-stroke);
  paint-order: stroke fill;
  line-height: 1.05;
  filter: drop-shadow(var(--shadow-title));
}

/*
 * Footer block — bottom-anchored glass panel that just holds the set + number
 * line. Mirrors basic-energy.json footer-block at anchorX=20, anchorY=0 bottom,
 * width=710, paddingTop=15, paddingX=15, paddingBottom=37, rx=25, glass-blur.
 * Same panel decoration variables as the fullart content panel.
 */
.footer-anchor {
  position: absolute;
  left:   var(--panel-inset-side);
  right:  var(--panel-inset-side);
  bottom: 0;
}

.footer-panel {
  background: var(--panel-bg);
  backdrop-filter: blur(var(--panel-blur));
  -webkit-backdrop-filter: blur(var(--panel-blur));
  border-radius: var(--panel-radius);
  padding: 15px 15px 37px;
}

@media print {
  .footer-panel {
    background: rgb(0 0 0 / 0.62);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

.footer-text {
  font-family: var(--font-infobar);
  font-weight: 400;
  font-size: var(--size-footer);
  color: var(--color-name);
  opacity: var(--opacity-tertiary);
}
</style>
