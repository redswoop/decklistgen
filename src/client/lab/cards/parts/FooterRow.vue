<script setup lang="ts">
import type { EnergyType } from "../../types";
import EnergyDot from "./EnergyDot.vue";

defineProps<{
  weakness?: { type: EnergyType; value: string };
  resistance?: { type: EnergyType; value: string };
  retreat: number;
  illustrator?: string;
}>();
</script>

<template>
  <footer class="footer">
    <div class="matchup">
      <span class="label">Weak</span>
      <template v-if="weakness">
        <EnergyDot :type="weakness.type" :size="24" />
        <span class="value">{{ weakness.value }}</span>
      </template>
      <span v-else class="value muted">—</span>
    </div>

    <div class="matchup">
      <span class="label">Resist</span>
      <template v-if="resistance">
        <EnergyDot :type="resistance.type" :size="24" />
        <span class="value">{{ resistance.value }}</span>
      </template>
      <span v-else class="value muted">—</span>
    </div>

    <div class="matchup">
      <span class="label">Retreat</span>
      <div class="retreat-dots">
        <EnergyDot
          v-for="n in retreat"
          :key="n"
          type="Colorless"
          :size="24"
        />
        <span v-if="retreat === 0" class="value muted">0</span>
      </div>
    </div>

    <span v-if="illustrator" class="illus">Illus. {{ illustrator }}</span>
  </footer>
</template>

<style scoped>
/*
 * Footer row mirrors the trailing row inside content-block in
 * pokemon-fullart.json — label / icon / multiplier triples plus the
 * trailing retreat-cost dots.
 *
 * Sizes (px → mirror constants/font-sizes.ts):
 *   label      24  ("Weak", "Resist", "Retreat")
 *   multiplier 32  ("×2", "-30")
 *   footer     14  (illustrator / set + number)
 */
.footer {
  display: flex;
  align-items: center;
  gap: 16px;
  font-family: var(--font-infobar);
  font-weight: 700;
  color: var(--color-name);
}

.matchup {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Stroked text uses fill-alpha for the "secondary/tertiary" feel rather than
 * element-level opacity, so the black stroke stays full strength and the
 * label remains legible if the glass panel ever clears off. Same technique
 * as .evolves-from in NameCluster.vue. */
.label {
  font-size: var(--size-label);
  color: rgb(255 255 255 / 0.85);
  -webkit-text-stroke: var(--width-name-stroke) var(--color-name-stroke);
  text-shadow: var(--shadow-title);
  paint-order: stroke fill;
}

.value {
  font-size: var(--size-multiplier);
  -webkit-text-stroke: var(--width-name-stroke) var(--color-name-stroke);
  text-shadow: var(--shadow-title);
  paint-order: stroke fill;
}

.value.muted {
  color: rgb(255 255 255 / 0.6);
}

.retreat-dots {
  display: flex;
  gap: 4px;
}

.illus {
  margin-left: auto;
  font-size: var(--size-footer);
  font-style: italic;
  font-weight: 400;
  opacity: var(--opacity-tertiary);
}
</style>
