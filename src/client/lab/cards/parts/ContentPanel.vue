<script setup lang="ts">
import type { LabAbility, LabAttack } from "../../types";
import AttackBlock      from "./AttackBlock.vue";
import EnergyTokenText  from "./EnergyTokenText.vue";

defineProps<{
  ability?: LabAbility;
  attacks: LabAttack[];
}>();
</script>

<template>
  <section class="content-panel">
    <div v-if="ability" class="ability">
      <div class="ability-header">
        <span class="ability-label">Ability</span>
        <h3 class="ability-name">{{ ability.name }}</h3>
      </div>
      <p class="ability-effect">
        <EnergyTokenText :text="ability.effect" />
      </p>
    </div>

    <AttackBlock
      v-for="(atk, i) in attacks"
      :key="i"
      :attack="atk"
    />
  </section>
</template>

<style scoped>
.content-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--panel-bg);
  backdrop-filter: blur(var(--panel-blur));
  -webkit-backdrop-filter: blur(var(--panel-blur));
  border-radius: var(--panel-radius);
  padding: var(--panel-padding);
}

/*
 * Print fallback: backdrop-filter renders inconsistently across Chromium
 * print pipelines (sometimes dropped entirely, sometimes rasterized as a
 * flat tint). Replace it with an opaque dark wash so text contrast is
 * preserved deterministically on paper — the artwork is already crisp
 * without the blur, and the eye reads the opaque tint as the glass.
 */
@media print {
  .content-panel {
    background: rgb(0 0 0 / 0.62);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

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
  font-weight: 700;                             /* SVG template uses bold for fullart effect text */
  font-size:   var(--size-ability-text);
  color: var(--color-attack-text);
  -webkit-text-stroke: var(--width-name-stroke) var(--color-name-stroke);
  text-shadow: var(--shadow-title);
  paint-order: stroke fill;
  line-height: 1.25;
}
</style>
