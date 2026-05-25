<script setup lang="ts">
import type { LabAttack } from "../../types";
import EnergyDot       from "./EnergyDot.vue";
import EnergyTokenText from "./EnergyTokenText.vue";

defineProps<{
  attack: LabAttack;
}>();
</script>

<template>
  <div class="attack">
    <div class="attack-header">
      <div class="cost">
        <EnergyDot
          v-for="(type, i) in attack.cost"
          :key="i"
          :type="type"
          :size="38"
        />
      </div>
      <h3 class="attack-name">{{ attack.name }}</h3>
      <span v-if="attack.damage" class="damage">{{ attack.damage }}</span>
    </div>
    <p v-if="attack.effect" class="effect">
      <EnergyTokenText :text="attack.effect" />
    </p>
  </div>
</template>

<style scoped>
.attack {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.attack-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cost {
  display: flex;
  gap: 4px;                                       /* marginRight=4 per cost in template */
  flex-shrink: 0;
}

.attack-name {
  margin: 0;
  flex: 1;
  font-family: var(--font-title);
  font-weight: var(--weight-title);
  font-size:   var(--size-attack-name);
  color: var(--color-attack-name);
  -webkit-text-stroke: var(--width-name-stroke) var(--color-name-stroke);
  text-shadow: var(--shadow-title);
  paint-order: stroke fill;
  line-height: 1.1;
}

.damage {
  font-family: var(--font-hp);                  /* damage values share the heavy HP face */
  font-weight: var(--weight-hp);
  font-size:   var(--size-attack-damage);
  color: var(--color-attack-name);
  -webkit-text-stroke: var(--width-hp-stroke) var(--color-hp-stroke);
  text-shadow: var(--shadow-title);
  paint-order: stroke fill;
  line-height: 1;
}

.effect {
  margin: 0;
  font-family: var(--font-body);
  font-weight: 700;                             /* SVG template uses bold for fullart effect text */
  font-size:   var(--size-attack-effect);
  color: var(--color-attack-text);
  -webkit-text-stroke: var(--width-name-stroke) var(--color-name-stroke);
  text-shadow: var(--shadow-title);
  paint-order: stroke fill;
  line-height: 1.25;
}
</style>
