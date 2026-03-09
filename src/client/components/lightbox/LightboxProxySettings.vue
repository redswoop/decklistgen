<script setup lang="ts">
import { computed } from "vue";
import type { Card } from "../../../shared/types/card.js";
import type { ProxySettings } from "../../../shared/types/proxy-settings.js";
import { useProxySettings } from "../../composables/useProxySettings.js";

const props = defineProps<{
  card: Card;
}>();
const emit = defineEmits<{
  change: [settings: ProxySettings];
}>();

const { getSettings, updateSettings } = useProxySettings();

const settings = computed(() => getSettings(props.card.id));

function update(patch: Partial<ProxySettings>) {
  updateSettings(props.card.id, patch);
  emit("change", { ...settings.value, ...patch });
}

const fontSize = computed({
  get: () => settings.value.fontSize ?? (props.card.isFullArt ? 36 : 40),
  set: (v: number) => update({ fontSize: v }),
});

const maxCover = computed({
  get: () => settings.value.maxCover ?? 0.55,
  set: (v: number) => update({ maxCover: v }),
});
</script>

<template>
  <div class="proxy-settings">
    <div class="ps-header">Proxy Settings</div>

    <div class="ps-row">
      <label class="ps-label">Font Size</label>
      <input
        type="range"
        :min="20" :max="48" :step="1"
        :value="fontSize"
        @input="fontSize = Number(($event.target as HTMLInputElement).value)"
        class="ps-slider"
      />
      <span class="ps-value">{{ fontSize }}px</span>
    </div>

    <div v-if="card.isFullArt" class="ps-row">
      <label class="ps-label">Overlay Coverage</label>
      <input
        type="range"
        :min="0.3" :max="0.7" :step="0.05"
        :value="maxCover"
        @input="maxCover = Number(($event.target as HTMLInputElement).value)"
        class="ps-slider"
      />
      <span class="ps-value">{{ Math.round(maxCover * 100) }}%</span>
    </div>
  </div>
</template>

<style scoped>
.proxy-settings {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(15, 52, 96, 0.4);
}

.ps-header {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #7f8fa6;
  margin-bottom: 8px;
}

.ps-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.ps-label {
  font-size: 12px;
  color: #b0b0b0;
  min-width: 100px;
}

.ps-slider {
  flex: 1;
  accent-color: #e94560;
  height: 4px;
}

.ps-value {
  font-size: 11px;
  color: #7f8fa6;
  min-width: 40px;
  text-align: right;
}
</style>
