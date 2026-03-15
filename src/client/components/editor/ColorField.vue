<script setup lang="ts">
import { ref } from "vue";
import NumericStepper from "./NumericStepper.vue";

const props = defineProps<{
  modelValue: string;
  label?: string;
  opacity?: number;
  width?: number;
  widthMin?: number;
  widthMax?: number;
  widthStep?: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "update:opacity": [value: number];
  "update:width": [value: number];
}>();

const hexInput = ref("");
const editingHex = ref(false);

function normalizeHex(v: string): string {
  const s = v || "#000000";
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  return s;
}

function onColorInput(e: Event) {
  emit("update:modelValue", (e.target as HTMLInputElement).value);
}

function onHexFocus() {
  editingHex.value = true;
  hexInput.value = props.modelValue || "#000000";
}

function onHexCommit() {
  editingHex.value = false;
  const v = hexInput.value.trim();
  if (/^#?[0-9a-fA-F]{3,6}$/.test(v)) {
    emit("update:modelValue", v.startsWith("#") ? v : "#" + v);
  }
}

function onHexKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  else if (e.key === "Escape") { editingHex.value = false; }
}

function onHexInput(e: Event) {
  if (editingHex.value) {
    hexInput.value = (e.target as HTMLInputElement).value;
  }
}

function onOpacityInput(e: Event) {
  emit("update:opacity", parseFloat((e.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="color-field">
    <label v-if="label">{{ label }}</label>
    <div class="color-row">
      <div class="swatch" :class="{ empty: !modelValue }" :style="{ background: modelValue || undefined, opacity: opacity ?? 1 }" title="Click to pick color">
        <input type="color" :value="normalizeHex(modelValue)" @input="onColorInput" />
      </div>
      <input
        v-if="width === undefined"
        type="text"
        class="hex-input"
        title="Hex color value"
        :value="editingHex ? hexInput : (modelValue || '')"
        @focus="onHexFocus"
        @blur="onHexCommit"
        @keydown="onHexKeydown"
        @input="onHexInput"
      />
      <NumericStepper
        v-if="width !== undefined"
        :model-value="width"
        :min="widthMin"
        :max="widthMax"
        :step="widthStep ?? 0.5"
        title="Width"
        @update:model-value="v => emit('update:width', v)"
      />
      <template v-if="opacity !== undefined">
        <span class="opacity-val">{{ opacity }}</span>
        <input type="range" class="opacity-slider" title="Opacity" :value="opacity" min="0" max="1" step="0.05" @input="onOpacityInput" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.color-field { margin-bottom: 8px; }
.color-field label { display: block; font-size: 11px; color: #888; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
.color-row { display: inline-flex; align-items: stretch; border: 1px solid #444; border-radius: 3px; overflow: hidden; height: 26px; }
.swatch { width: 26px; flex-shrink: 0; position: relative; cursor: pointer; }
.swatch.empty { background: linear-gradient(135deg, #1a2a4a 45%, #844 49%, #844 51%, #1a2a4a 55%) !important; }
.swatch input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.hex-input { flex: 1; min-width: 0; height: 100%; background: #0f3460; color: #e0e0e0; border: none; border-left: 1px solid #444; padding: 0 6px; font-size: 12px; font-family: monospace; box-sizing: border-box; outline: none; }
.hex-input:focus { background: #1a3d6d; }
.opacity-val { font-size: 11px; color: #aaa; min-width: 28px; text-align: center; border-left: 1px solid #444; display: flex; align-items: center; justify-content: center; padding: 0 4px; }
.opacity-slider { flex: 1; accent-color: #4a9eff; min-width: 40px; border-left: 1px solid #444; }
.color-row :deep(.stepper) { border: none; border-left: 1px solid #444; border-radius: 0; height: 100%; }
</style>
