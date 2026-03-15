<script setup lang="ts">
import type { AlignOption } from "../../../shared/types/editor.js";

defineProps<{
  modelValue: string;
  options: AlignOption[];
  label?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>

<template>
  <div class="align-buttons">
    <label v-if="label">{{ label }}</label>
    <div class="btn-group">
      <button
        v-for="opt in options"
        :key="opt.value"
        class="align-btn"
        :class="{ active: modelValue === opt.value }"
        :title="opt.title"
        @click="emit('update:modelValue', opt.value)"
      >
        <svg v-if="opt.icon" viewBox="0 0 16 16" width="14" height="14">
          <path :d="opt.icon" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span v-else-if="opt.text" class="btn-text" :class="{ bold: opt.value === 'bold' }">{{ opt.text }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.align-buttons { margin-bottom: 8px; }
.align-buttons label { display: block; font-size: 11px; color: #888; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
.btn-group { display: inline-flex; border: 1px solid #444; border-radius: 3px; overflow: hidden; }
.align-btn { background: #0a2040; color: #888; border: none; border-right: 1px solid #444; padding: 4px 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; min-width: 28px; height: 26px; }
.align-btn:last-child { border-right: none; }
.align-btn:hover { background: #1a5276; color: #e0e0e0; }
.align-btn.active { background: #1a3d6d; color: #4a9eff; }
.btn-text { font-size: 13px; font-weight: 300; line-height: 1; }
.btn-text.bold { font-weight: 800; }
</style>
