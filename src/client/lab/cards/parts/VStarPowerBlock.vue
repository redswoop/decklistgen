<script setup lang="ts">
import type { LabVStarPower } from "../../types";
import EnergyDot       from "./EnergyDot.vue";
import EnergyTokenText from "./EnergyTokenText.vue";

defineProps<{
  vstarPower: LabVStarPower;
}>();
</script>

<template>
  <div class="vstar">
    <div class="vstar-header">
      <span class="vstar-label">VSTAR Power</span>
      <div v-if="vstarPower.kind === 'attack' && vstarPower.cost" class="cost">
        <EnergyDot
          v-for="(type, i) in vstarPower.cost"
          :key="i"
          :type="type"
          :size="34"
        />
      </div>
      <h3 class="vstar-name">{{ vstarPower.name }}</h3>
      <span v-if="vstarPower.damage" class="damage">{{ vstarPower.damage }}</span>
    </div>
    <p class="vstar-effect">
      <EnergyTokenText :text="vstarPower.effect" />
    </p>
  </div>
</template>

<style scoped>
.vstar {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.vstar-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

/*
 * "VSTAR Power" pill — same pattern as the gold/red Ability pill but uses
 * its own variable set so themes can pick a distinct treatment (the SVG
 * renderer cards it cyan-to-purple). Italic title font, rounded rect,
 * thin black stroke for legibility against bright art.
 */
.vstar-label {
  font-family: var(--font-title);
  font-weight: var(--weight-title);
  font-style:  italic;
  font-size:   var(--size-ability-label);
  color: var(--color-vstar-label-text);
  background: var(--color-vstar-label-bg);
  padding: 3px 14px;
  border-radius: 14px;
  -webkit-text-stroke: 1.5px #000;
  paint-order: stroke fill;
  line-height: 1;
  white-space: nowrap;
}

.cost {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.vstar-name {
  margin: 0;
  flex: 1;
  font-family: var(--font-title);
  font-weight: var(--weight-title);
  font-size:   var(--size-ability-name);
  color: var(--color-vstar-name);
  -webkit-text-stroke: var(--width-name-stroke) var(--color-name-stroke);
  text-shadow: var(--shadow-title);
  paint-order: stroke fill;
  line-height: 1;
}

.damage {
  font-family: var(--font-hp);
  font-weight: var(--weight-hp);
  font-size:   var(--size-attack-damage);
  color: var(--color-attack-name);
  -webkit-text-stroke: var(--width-hp-stroke) var(--color-hp-stroke);
  text-shadow: var(--shadow-title);
  paint-order: stroke fill;
  line-height: 1;
}

.vstar-effect {
  margin: 0;
  font-family: var(--font-body);
  font-weight: 700;
  font-size:   var(--size-ability-text);
  color: var(--color-attack-text);
  -webkit-text-stroke: var(--width-name-stroke) var(--color-name-stroke);
  text-shadow: var(--shadow-title);
  paint-order: stroke fill;
  line-height: 1.25;
}
</style>
