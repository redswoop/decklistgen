<script setup lang="ts">
import type { PropDef } from "../../../shared/types/editor.js";

const props = defineProps<{
  def: PropDef;
  value: string | number;
}>();

const emit = defineEmits<{
  update: [key: string, value: string | number];
}>();

function normalizeHex(v: unknown): string {
  const s = String(v || "#000000");
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  return s;
}

function onInput(e: Event) {
  const input = e.target as HTMLInputElement | HTMLSelectElement;
  let v: string | number = input.value;
  if (input instanceof HTMLInputElement && (input.type === "number" || input.type === "range")) {
    v = parseFloat(input.value);
  }
  emit("update", props.def.key, v);
}
</script>

<template>
  <div class="prop-row">
    <label>{{ def.label }}</label>
    <input
      v-if="def.type === 'number'"
      type="number"
      :value="value"
      :min="def.min"
      :max="def.max"
      :step="def.step"
      :data-position="def.isPosition ? '1' : '0'"
      @input="onInput"
      @change="onInput"
    />
    <template v-else-if="def.type === 'range'">
      <span class="range-val">{{ value }}</span>
      <input
        type="range"
        :value="value"
        :min="def.min ?? 0"
        :max="def.max ?? 1"
        :step="def.step ?? 0.01"
        @input="onInput"
        @change="onInput"
      />
    </template>
    <select
      v-else-if="def.type === 'select'"
      :value="String(value)"
      @input="onInput"
      @change="onInput"
    >
      <option v-for="opt in def.options" :key="opt" :value="opt" :selected="String(opt) === String(value)">{{ opt }}</option>
    </select>
    <input
      v-else-if="def.type === 'text'"
      type="text"
      :value="value ?? ''"
      @input="onInput"
      @change="onInput"
    />
    <input
      v-else-if="def.type === 'color'"
      type="color"
      :value="normalizeHex(value)"
      @input="onInput"
      @change="onInput"
    />
  </div>
</template>

<style scoped>
.prop-row { margin-bottom: 10px; }
.prop-row label { display: block; font-size: 11px; color: #888; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
.prop-row input[type="number"] { width: 80px; background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 3px 6px; font-size: 13px; }
.prop-row input[type="text"] { width: 100%; background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 3px 6px; font-size: 13px; }
.prop-row input[type="range"] { width: 100%; accent-color: #4a9eff; }
.prop-row input[type="color"] { width: 100%; height: 28px; padding: 1px; border: 1px solid #444; border-radius: 3px; background: #0f3460; cursor: pointer; }
.prop-row select { width: 100%; background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 3px 6px; font-size: 13px; }
.range-val { font-size: 11px; color: #aaa; float: right; }
</style>
