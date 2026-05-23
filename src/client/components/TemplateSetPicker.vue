<script setup lang="ts">
import { computed } from "vue";
import { useTemplateSetCatalog } from "../composables/useTemplateSetCatalog.js";

const props = defineProps<{
  /** Currently selected set id. `undefined`/empty = inherit from parent context. */
  modelValue: string | undefined;
  /** Compact mode for inline per-card use. */
  compact?: boolean;
  /** What "inherit" means in this context. */
  inheritLabel?: string;
  /** Label for the picker. Hidden in compact mode. */
  label?: string;
  /** Disable the picker (e.g. anonymous users on a saved deck). */
  disabled?: boolean;
  /** Tooltip when disabled. */
  disabledTitle?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string | undefined];
}>();

const { entries, globalSetId, setLabel } = useTemplateSetCatalog();

const inheritText = computed(() => {
  if (props.inheritLabel) return props.inheritLabel;
  return `Inherit (${setLabel(globalSetId.value)})`;
});

function onChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value;
  emit("update:modelValue", value || undefined);
}
</script>

<template>
  <label class="tsp-root" :class="{ 'tsp-compact': compact }">
    <span v-if="label && !compact" class="tsp-label">{{ label }}</span>
    <select
      class="tsp-select"
      :value="modelValue ?? ''"
      :disabled="disabled"
      :title="disabled ? disabledTitle : undefined"
      @change="onChange"
      @click.stop
    >
      <option value="">{{ inheritText }}</option>
      <option
        v-for="entry in entries"
        :key="entry.id"
        :value="entry.id"
      >
        {{ entry.name }}{{ entry.origin === 'user' ? ' (user)' : '' }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.tsp-root {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #c9d1d9;
}

.tsp-label {
  white-space: nowrap;
  color: #8b949e;
}

.tsp-select {
  background: #0d1117;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  min-width: 0;
}

.tsp-select:hover:not(:disabled) {
  border-color: #58a6ff;
}

.tsp-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tsp-compact .tsp-select {
  padding: 2px 4px;
  font-size: 11px;
}
</style>
