<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  modelValue: number;
  min?: number;
  max?: number;
  step?: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: number];
}>();

const editing = ref(false);
const editText = ref("");

const effectiveStep = () => props.step ?? 1;

function clamp(v: number): number {
  if (props.min != null && v < props.min) v = props.min;
  if (props.max != null && v > props.max) v = props.max;
  // Round to step precision to avoid floating-point drift
  const s = effectiveStep();
  const decimals = (String(s).split(".")[1] ?? "").length;
  return Number(v.toFixed(decimals));
}

function stepUp() {
  emit("update:modelValue", clamp(props.modelValue + effectiveStep()));
}

function stepDown() {
  emit("update:modelValue", clamp(props.modelValue - effectiveStep()));
}

function onFocus(e: FocusEvent) {
  editing.value = true;
  editText.value = String(props.modelValue);
  // Select all text for easy replacement
  const input = e.target as HTMLInputElement;
  requestAnimationFrame(() => input.select());
}

function commit() {
  editing.value = false;
  const parsed = parseFloat(editText.value);
  if (!isNaN(parsed)) {
    emit("update:modelValue", clamp(parsed));
  }
  // If NaN (empty/garbage), just revert — the displayed value returns to modelValue
}

function onInputText(e: Event) {
  if (editing.value) {
    editText.value = (e.target as HTMLInputElement).value;
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    (e.target as HTMLInputElement).blur();
  } else if (e.key === "Escape") {
    editing.value = false;
    editText.value = String(props.modelValue);
    (e.target as HTMLInputElement).blur();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    stepUp();
    editText.value = String(clamp(props.modelValue + effectiveStep()));
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    stepDown();
    editText.value = String(clamp(props.modelValue - effectiveStep()));
  }
}

</script>

<template>
  <div class="stepper">
    <button class="step-btn" tabindex="-1" title="Decrease" @click="stepDown">&minus;</button>
    <input
      type="text"
      inputmode="decimal"
      class="step-input"
      :value="editing ? editText : modelValue"
      :readonly="!editing"
      @focus="onFocus"
      @blur="commit"
      @keydown="onKeydown"
      @input="onInputText"
    />
    <button class="step-btn" tabindex="-1" title="Increase" @click="stepUp">&plus;</button>
  </div>
</template>

<style scoped>
.stepper { display: inline-flex; align-items: stretch; border: 1px solid #444; border-radius: 3px; overflow: hidden; height: 26px; width: fit-content; }
.step-btn { background: #0a2040; color: #aaa; border: none; width: 22px; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1; flex-shrink: 0; user-select: none; }
.step-btn:hover { background: #1a5276; color: #e0e0e0; }
.step-btn:active { background: #4a9eff; color: #fff; }
.step-input { width: 48px; height: 100%; background: #0f3460; color: #e0e0e0; border: none; border-left: 1px solid #444; border-right: 1px solid #444; padding: 0 4px; font-size: 13px; text-align: center; outline: none; min-width: 0; box-sizing: border-box; }
.step-input:focus { background: #1a3d6d; }
</style>
