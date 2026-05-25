<script setup lang="ts">
import type { EnergyType } from "../../types";
import EnergyDot from "./EnergyDot.vue";

defineProps<{
  hp: number;
  type: EnergyType;
}>();
</script>

<template>
  <div class="hp-cluster">
    <span class="hp-label">HP</span>
    <span class="hp-value">{{ hp }}</span>
    <EnergyDot :type="type" :size="42" class="hp-dot" />
  </div>
</template>

<style scoped>
/*
 * Layout mirrors the hp-cluster box in data/templates/pokemon-fullart.json:
 *   direction:row → flex row
 *   HP label has marginRight=4 / marginBottom=4 / vAlign=bottom
 *   HP value has marginRight=6 / vAlign=bottom
 *   energy circle has radius=21 (→ 42px diameter) / vAlign=middle
 */
.hp-cluster {
  display: flex;
  align-items: flex-end;
  gap: 0;                                          /* per-child margins below */
}

.hp-label,
.hp-value {
  font-family: var(--font-hp);
  font-weight: var(--weight-hp);
  color: var(--color-hp-text);
  -webkit-text-stroke: var(--width-hp-stroke) var(--color-hp-stroke);
  text-shadow: var(--shadow-title);
  line-height: 1;
  paint-order: stroke fill;
}

.hp-label {
  font-size: var(--size-hp-label);
  margin-right: 4px;
  margin-bottom: 4px;                              /* baseline-align with HP digits */
}

.hp-value {
  font-size: var(--size-hp);
  margin-right: 6px;
}

/* vAlign:middle on the energy circle — re-center vertically against the
 * larger HP-value glyph height. */
.hp-dot {
  align-self: center;
  margin-bottom: 4px;
}
</style>
