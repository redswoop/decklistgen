<script setup lang="ts">
import type { LabAbility, LabAttack } from "../../types";
import AbilityBlock from "./AbilityBlock.vue";
import AttackBlock  from "./AttackBlock.vue";

defineProps<{
  ability?: LabAbility;
  attacks: LabAttack[];
}>();
</script>

<template>
  <section class="content-panel">
    <AbilityBlock v-if="ability" :ability="ability" />

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
</style>
