<script setup lang="ts">
import { computed } from "vue";
import type { NameSuffix, Stage } from "../../types";
import { formatStageLabel, isShowableStage, pillLabelForSuffix } from "./stage";

const props = defineProps<{
  stage?: Stage | string;
  suffix?: NameSuffix;
}>();

// VMAX/VSTAR override the stage label with the suffix name — that's how
// the real cards mark them ("VMAX" / "VSTAR" plaque in lieu of stage).
const suffixLabel = computed(() => pillLabelForSuffix(props.suffix));
const show  = computed(() => !!suffixLabel.value || isShowableStage(props.stage));
const label = computed(() =>
  suffixLabel.value
    ?? (isShowableStage(props.stage) ? formatStageLabel(props.stage as Stage) : "")
);
</script>

<template>
  <div v-if="show" class="stage-pill">
    <!--
      Two adjacent flex children share the same vertical gradient so they
      visually fuse into one plaque. Splitting body+tail (instead of one
      element with clip-path) keeps the rounded-left corner crisp — clip-path
      on a rounded-corner element loses the antialiased curve.
    -->
    <div class="stage-pill-body">{{ label }}</div>
    <div class="stage-pill-tail" aria-hidden="true"></div>
  </div>
</template>

<style scoped>
.stage-pill {
  display: inline-flex;
  align-items: stretch;
  height: var(--stage-pill-height);
  /*
   * drop-shadow on the wrapper (rather than box-shadow on each piece) so the
   * shadow follows the composite silhouette — body + triangular tail — as a
   * single shape, with no shadow leakage along the seam between them.
   */
  filter: drop-shadow(0 3px 4px rgb(0 0 0 / 0.55));
}

.stage-pill-body {
  display: flex;
  align-items: center;
  padding: 0 var(--stage-pill-pad-r) 0 var(--stage-pill-pad-l);
  background: var(--stage-pill-bg);
  border-radius: var(--stage-pill-radius) 0 0 var(--stage-pill-radius);

  font-family: var(--font-infobar);
  font-weight: var(--stage-pill-weight);
  font-size: var(--stage-pill-font-size);
  letter-spacing: var(--stage-pill-letter-spacing);
  text-transform: uppercase;
  line-height: 1;
  color: var(--stage-pill-color);
  white-space: nowrap;
}

/*
 * The right "/" of the user's `(basic/` mockup: a triangle whose hypotenuse
 * runs from top-right down to bottom-left of the tail box, so the plaque
 * juts further right at the top than at the bottom. Same gradient as the
 * body so the two pieces read as one continuous plate; both flex children
 * span the same height, so a 180° linear-gradient lines up at every y.
 */
.stage-pill-tail {
  width: var(--stage-pill-tail-width);
  background: var(--stage-pill-bg);
  clip-path: polygon(0 0, 100% 0, 0 100%);
}
</style>
