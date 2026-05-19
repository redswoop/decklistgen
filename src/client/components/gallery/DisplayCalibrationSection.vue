<script setup lang="ts">
/** Left-rail panel for the display-calibration readout + the dialog trigger.
 *  The orchestrator owns the dialog itself (so it can teleport to body without
 *  layout shenanigans). */
import { computed } from "vue";
import { useDisplayCalibration } from "../../composables/useDisplayCalibration.js";

const emit = defineEmits<{ open: [] }>();

const { cssPxPerInch, isCalibrated, zoomDrift, savedAt, physicalCardPx } =
  useDisplayCalibration();

const savedAtPretty = computed(() => {
  if (!savedAt.value) return "";
  try { return new Date(savedAt.value).toLocaleString(); } catch { return savedAt.value; }
});

const printPxLine = computed(() =>
  `Print preview: ${Math.round(physicalCardPx.value.w)} × ${Math.round(physicalCardPx.value.h)} px`,
);
</script>

<template>
  <div class="dcs">
    <div class="dcs-row">
      <div :class="['dcs-dpi', !isCalibrated && 'dcs-dpi-warn']">
        {{ Math.round(cssPxPerInch) }} DPI
        <span v-if="!isCalibrated" class="dcs-uncal">· uncalibrated</span>
      </div>
      <button class="btn btn-cal" @click="emit('open')">Calibrate…</button>
    </div>
    <div class="dcs-sub">{{ printPxLine }}</div>
    <div v-if="isCalibrated" class="dcs-sub-faint">Last calibrated: {{ savedAtPretty }}</div>
    <div v-if="isCalibrated && zoomDrift > 0.05" class="dcs-warn">
      Browser zoom changed since calibration — re-verify.
    </div>
  </div>
</template>

<style scoped>
.dcs-row { display: flex; align-items: center; gap: 8px; }
.dcs-dpi {
  font-size: 14px;
  font-weight: 700;
  color: #f39c12;
  font-family: monospace;
}
.dcs-dpi-warn { color: #f6ad55; }
.dcs-uncal { font-size: 10px; color: #888; font-weight: 400; font-family: inherit; }
.dcs-sub { font-size: 11px; color: #aaa; margin-top: 4px; }
.dcs-sub-faint { font-size: 10px; color: #666; }
.dcs-warn {
  background: #3d2f06;
  color: #f6e05e;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 10px;
  margin-top: 6px;
  line-height: 1.4;
}

.btn-cal {
  background: #2d3748;
  color: #a0aec0;
  border: 1px solid #3a4660;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  margin-left: auto;
}
.btn-cal:hover { color: #fff; border-color: #5a8cd6; }
</style>
