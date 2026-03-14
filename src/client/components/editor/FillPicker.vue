<script setup lang="ts">
const props = defineProps<{
  color: string;
  opacity: number;
}>();

const emit = defineEmits<{
  update: [color: string, opacity: number];
}>();

function normalizeHex(v: string): string {
  const s = v || "#000000";
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  return s;
}

function onColorInput(e: Event) {
  const input = e.target as HTMLInputElement;
  emit("update", input.value, props.opacity);
}

function onOpacityInput(e: Event) {
  const input = e.target as HTMLInputElement;
  emit("update", props.color, parseFloat(input.value));
}
</script>

<template>
  <div class="fill-picker">
    <label>Fill</label>
    <div class="row">
      <div
        class="swatch"
        :style="{ background: color || 'transparent', border: color ? '1px solid ' + color : '1px dashed #666', opacity }"
      >
        <input type="color" :value="normalizeHex(color)" @input="onColorInput" />
      </div>
      <span class="val">{{ opacity }}</span>
      <input type="range" :value="opacity" min="0" max="1" step="0.05" @input="onOpacityInput" />
    </div>
  </div>
</template>

<style scoped>
.fill-picker { margin-bottom: 10px; }
label { display: block; font-size: 11px; color: #888; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
.row { display: flex; align-items: center; gap: 8px; }
.swatch { width: 28px; height: 28px; border-radius: 4px; flex-shrink: 0; position: relative; cursor: pointer; }
.swatch input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
input[type="range"] { flex: 1; accent-color: #4a9eff; }
.val { font-size: 11px; color: #aaa; min-width: 28px; text-align: right; }
</style>
