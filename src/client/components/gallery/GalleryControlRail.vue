<script setup lang="ts">
/** Left rail container. Display calibration is the last surviving section after
 *  the SVG override editors (font size, font family) were retired. */
import { ref } from "vue";
import DisplayCalibrationSection from "./DisplayCalibrationSection.vue";

const emit = defineEmits<{ openCalibration: [] }>();

const calibrationOpen = ref(true);
</script>

<template>
  <aside class="rail">
    <div class="rail-section">
      <button class="rail-head" @click="calibrationOpen = !calibrationOpen">
        <span class="rail-caret">{{ calibrationOpen ? "▾" : "▸" }}</span>
        Display
      </button>
      <div v-if="calibrationOpen" class="rail-body">
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
