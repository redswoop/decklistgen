<script setup lang="ts">
import { computed } from "vue";
import type { TrainerType } from "../../types";

const props = defineProps<{
  trainerType: TrainerType;
}>();

/*
 * Right-hand tag: regular trainers ("Supporter" / "Item" / "Tool" / "Stadium")
 * say TRAINER; special-energy cards route through this same component (the
 * SVG renderer does the same — enrich-card-data.ts sets trainerType="Special
 * Energy" for category=Energy with effect) but get an ENERGY tag instead.
 */
const tagText = computed(() => props.trainerType === "Special Energy" ? "ENERGY" : "TRAINER");
</script>

<template>
  <div class="trainer-header" :data-trainer-type="trainerType">
    <span class="trainer-type">{{ trainerType }}</span>
    <span class="trainer-tag">{{ tagText }}</span>
  </div>
</template>

<style scoped>
/*
 * Skewed gradient banner above the trainer name. Mirrors the header-banner
 * element in data/templates/builtin/default/trainer.json:
 *   anchorX=20, anchorY=12, width=710
 *   skewX=-10, rx=18
 *   paddingLeft/Right=32, paddingTop/Bottom=8
 *   fillGradient="metallic-trainer-default"
 *
 * Inner text is counter-skewed so it reads upright while the chrome slants.
 * That's how the SVG renderer paints it too (skew applies to the box; the
 * text element has its own transform that cancels it out).
 */
.trainer-header {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 710px;
  /* border-box so the SVG template's width:710 includes the 32px L/R padding.
   * With the default content-box, the banner's actual occupied width would
   * be 710 + 32*2 = 774px and the right edge would extend past the card's
   * 750px frame — where the card's overflow:hidden clips the "R" off
   * "TRAINER". */
  box-sizing: border-box;
  padding: 8px 32px;
  border-radius: 18px;
  background: var(--color-trainer-banner-bg);
  transform: skewX(-10deg);
  box-shadow: 0 4px 4px rgb(0 0 0 / 0.6);
}

.trainer-type,
.trainer-tag {
  font-family: var(--font-title);
  font-weight: var(--weight-title);
  font-style: italic;
  -webkit-text-stroke: 2.5px #000;
  paint-order: stroke fill;
  line-height: 1;
}

/*
 * Counter-skew so text reads upright while the banner box slants. Each
 * side's transform-origin anchors to the adjacent banner edge — left text
 * pins to the left edge, right text pins to the right edge — so the
 * counter-rotation pushes content *inward* instead of past the banner
 * chrome. Without this anchoring, the default center origin shifts the
 * right text past the banner's right edge and the "R" in "TRAINER" clips.
 */
.trainer-type {
  transform: skewX(10deg);
  transform-origin: left center;
  font-size: var(--size-trainer-type);
  color: var(--color-trainer-type);
}

.trainer-tag {
  margin-left: auto;
  transform: skewX(10deg);
  transform-origin: right center;
  font-size: 24px;
  font-style: normal;
  /* fill-alpha rather than element opacity so the 2.5px black stroke stays
   * full strength on the metallic banner. */
  color: rgb(255 255 255 / 0.85);
  letter-spacing: 0.04em;
}
</style>
