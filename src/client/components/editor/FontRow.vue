<script setup lang="ts">
import NumericStepper from "./NumericStepper.vue";

defineProps<{
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
}>();

const emit = defineEmits<{
  update: [key: string, value: string | number];
}>();

function onSizeUpdate(v: number) {
  emit("update", "fontSize", v);
}

function onFamilyInput(e: Event) {
  emit("update", "fontFamily", (e.target as HTMLSelectElement).value);
}

function onWeightInput(e: Event) {
  emit("update", "fontWeight", (e.target as HTMLSelectElement).value);
}
</script>

<template>
  <div class="font-row">
    <label>Font</label>
    <div class="font-controls">
      <NumericStepper
        :model-value="fontSize"
        :min="8"
        :max="120"
        :step="1"
        compact
        @update:model-value="onSizeUpdate"
      />
      <select class="font-family" :value="fontFamily" title="Font family" @change="onFamilyInput">
        <option value="title">title</option>
        <option value="body">body</option>
      </select>
      <select class="font-weight" :value="fontWeight" title="Font weight" @change="onWeightInput">
        <option value="normal">normal</option>
        <option value="bold">bold</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.font-row { margin-bottom: 10px; }
.font-row label { display: block; font-size: 11px; color: #888; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
.font-controls { display: flex; gap: 4px; }
.font-family, .font-weight { flex: 1; background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 3px 4px; font-size: 12px; min-width: 0; }
</style>
