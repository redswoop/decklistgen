<script setup lang="ts">
/** Left rail container with three collapsible sections:
 *  Font sizes (open by default), Font family, Display calibration.
 *
 *  Emits @saved when any editor saves so the parent can refresh the grid. */
import { ref } from "vue";
import FontSizeEditor from "./FontSizeEditor.vue";
import FontFamilyEditor from "./FontFamilyEditor.vue";
import DisplayCalibrationSection from "./DisplayCalibrationSection.vue";

const emit = defineEmits<{ saved: []; openCalibration: [] }>();

type Section = "sizes" | "family" | "calibration";
const open = ref<Record<Section, boolean>>({
  sizes: true,
  family: false,
  calibration: true,
});

function toggle(s: Section) { open.value[s] = !open.value[s]; }
function handleSaved() { emit("saved"); }
</script>

<template>
  <aside class="rail">
    <div class="rail-section">
      <button class="rail-head" @click="toggle('sizes')">
        <span class="rail-caret">{{ open.sizes ? "▾" : "▸" }}</span>
        Font sizes
      </button>
      <div v-if="open.sizes" class="rail-body">
        <FontSizeEditor @saved="handleSaved" @reset="handleSaved" />
      </div>
    </div>

    <div class="rail-section">
      <button class="rail-head" @click="toggle('family')">
        <span class="rail-caret">{{ open.family ? "▾" : "▸" }}</span>
        Font family
      </button>
      <div v-if="open.family" class="rail-body">
        <FontFamilyEditor @saved="handleSaved" @reset="handleSaved" />
      </div>
    </div>

    <div class="rail-section">
      <button class="rail-head" @click="toggle('calibration')">
        <span class="rail-caret">{{ open.calibration ? "▾" : "▸" }}</span>
        Display
      </button>
      <div v-if="open.calibration" class="rail-body">
        <DisplayCalibrationSection @open="emit('openCalibration')" />
      </div>
    </div>
  </aside>
</template>

<style scoped>
.rail {
  background: #131826;
  border-right: 1px solid #2a2a40;
  padding: 14px 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
}

.rail-section {
  background: #181d2a;
  border-radius: 6px;
  overflow: hidden;
}

.rail-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: none;
  border: none;
  color: #aaa;
  text-align: left;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}
.rail-head:hover { color: #fff; }
.rail-caret { color: #666; font-size: 10px; }

.rail-body { padding: 4px 12px 12px; }
</style>
