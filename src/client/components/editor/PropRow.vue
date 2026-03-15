<script setup lang="ts">
import { ref } from "vue";
import type { PropDef } from "../../../shared/types/editor.js";
import NumericStepper from "./NumericStepper.vue";

const props = defineProps<{
  def: PropDef;
  value: string | number;
  binding?: string;
}>();

const emit = defineEmits<{
  update: [key: string, value: string | number];
  "update:binding": [key: string, path: string];
  "clear:binding": [key: string];
}>();

const editingBinding = ref(false);
const bindingInput = ref("");

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

function onNumericUpdate(v: number) {
  emit("update", props.def.key, v);
}

function onBindClick() {
  if (editingBinding.value) return;
  bindingInput.value = props.binding ?? "";
  editingBinding.value = true;
}

function onBindSubmit() {
  if (!editingBinding.value) return;
  const path = bindingInput.value.trim();
  if (path) {
    emit("update:binding", props.def.key, path);
  } else {
    emit("clear:binding", props.def.key);
  }
  editingBinding.value = false;
}

function onBindKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") onBindSubmit();
  else if (e.key === "Escape") editingBinding.value = false;
}
</script>

<template>
  <div class="prop-row" :class="{ 'is-bound': binding }">
    <div class="prop-header">
      <label>{{ def.label }}</label>
      <span
        v-if="binding && !editingBinding"
        class="binding-badge"
        :title="'Bound to: ' + binding + ' (click to edit)'"
        @click.stop="onBindClick"
      >{{ binding }}</span>
      <button
        v-if="!editingBinding"
        class="bind-toggle"
        :class="{ active: !!binding }"
        :title="binding ? 'Edit binding' : 'Add data binding'"
        @click.stop="onBindClick"
      >&#x26D3;</button>
    </div>
    <div v-if="editingBinding" class="binding-editor">
      <input
        type="text"
        v-model="bindingInput"
        placeholder="e.g. hp, attacks[0].name"
        @keydown="onBindKeydown"
        @blur="onBindSubmit"
      />
    </div>
    <NumericStepper
      v-if="def.type === 'number'"
      :model-value="Number(value)"
      :min="def.min"
      :max="def.max"
      :step="def.step"
      @update:model-value="onNumericUpdate"
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
      />
    </template>
    <select
      v-else-if="def.type === 'select'"
      :value="String(value)"
      @change="onInput"
    >
      <option v-for="opt in def.options" :key="opt" :value="opt" :selected="String(opt) === String(value)">{{ opt }}</option>
    </select>
    <input
      v-else-if="def.type === 'text'"
      type="text"
      :value="value ?? ''"
      @change="onInput"
    />
    <input
      v-else-if="def.type === 'color'"
      type="color"
      :value="normalizeHex(value)"
      @input="onInput"
    />
  </div>
</template>

<style scoped>
.prop-row { margin-bottom: 10px; }
.prop-row.is-bound { border-left: 2px solid #4a9eff; padding-left: 6px; }
.prop-header { display: flex; align-items: center; gap: 4px; margin-bottom: 3px; }
.prop-header label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; flex-shrink: 0; }
.binding-badge { font-size: 10px; color: #4a9eff; background: rgba(74,158,255,0.12); padding: 1px 5px; border-radius: 3px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px; }
.binding-badge:hover { background: rgba(74,158,255,0.25); }
.bind-toggle { background: none; border: none; color: #555; font-size: 11px; cursor: pointer; padding: 0 2px; margin-left: auto; line-height: 1; flex-shrink: 0; }
.bind-toggle:hover { color: #4a9eff; }
.bind-toggle.active { color: #4a9eff; }
.binding-editor input { width: 100%; background: #0a1e3d; color: #4a9eff; border: 1px solid #4a9eff; border-radius: 3px; padding: 3px 6px; font-size: 12px; margin-bottom: 4px; }
.prop-row input[type="text"] { width: 100%; background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 4px 6px; font-size: 13px; }
.prop-row input[type="range"] { width: 100%; accent-color: #4a9eff; }
.prop-row input[type="color"] { width: 100%; height: 28px; padding: 1px; border: 1px solid #444; border-radius: 3px; background: #0f3460; cursor: pointer; }
.prop-row select { width: 100%; background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 3px; padding: 3px 6px; font-size: 13px; }
.range-val { font-size: 11px; color: #aaa; float: right; }
</style>
