<script setup lang="ts">
import type { LabAbility } from "../../types";
import EnergyTokenText from "./EnergyTokenText.vue";

defineProps<{
  ability: LabAbility;
}>();
</script>

<template>
  <div class="ability">
    <div class="ability-header">
      <span class="ability-label">Ability</span>
      <h3 class="ability-name">{{ ability.name }}</h3>
    </div>
    <p class="ability-effect">
      <EnergyTokenText :text="ability.effect" />
    </p>
  </div>
</template>

<style scoped>
.ability {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ability-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

/*
 * "Ability" pill mirrors the gradient-filled rounded-rect in pokemon-fullart.json:
 *   paddingTop=3 paddingBottom=3 paddingL/R=14, rx=14, italic title font.
 */
.ability-label {
  font-family: var(--font-title);
  font-weight: var(--weight-title);
  font-style:  italic;
  font-size:   var(--size-ability-label);
  color: var(--color-ability-label-text);
  background: var(--color-ability-label-bg);
  padding: 3px 14px;
  border-radius: 14px;
  -webkit-text-stroke: 1.5px #000;
  paint-order: stroke fill;
  line-height: 1;
}

.ability-name {
  margin: 0;
  font-family: var(--font-title);
  font-weight: var(--weight-title);
  font-size:   var(--size-ability-name);
  color: var(--color-ability-name);
  -webkit-text-stroke: var(--width-name-stroke) var(--color-name-stroke);
  text-shadow: var(--shadow-title);
  paint-order: stroke fill;
  line-height: 1;
}

.ability-effect {
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
