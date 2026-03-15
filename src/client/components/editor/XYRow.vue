<script setup lang="ts">
import NumericStepper from "./NumericStepper.vue";

defineProps<{
  label: string;
  xValue: number;
  yValue: number;
  xLabel?: string;
  yLabel?: string;
  xMin?: number;
  xMax?: number;
  xStep?: number;
  yMin?: number;
  yMax?: number;
  yStep?: number;
}>();

const emit = defineEmits<{
  "update:x": [value: number];
  "update:y": [value: number];
}>();
</script>

<template>
  <div class="xy-row">
    <label>{{ label }}</label>
    <div class="xy-inputs">
      <NumericStepper
        :model-value="xValue"
        :min="xMin"
        :max="xMax"
        :step="xStep ?? 1"
        :title="xLabel"
        @update:model-value="v => emit('update:x', v)"
      />
      <NumericStepper
        :model-value="yValue"
        :min="yMin"
        :max="yMax"
        :step="yStep ?? 1"
        :title="yLabel"
        @update:model-value="v => emit('update:y', v)"
      />
    </div>
  </div>
</template>

<style scoped>
.xy-row { margin-bottom: 8px; }
.xy-row label { display: block; font-size: 11px; color: #888; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
.xy-inputs { display: flex; gap: 4px; }
</style>
