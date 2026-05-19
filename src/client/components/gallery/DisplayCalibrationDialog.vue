<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
  useDisplayCalibration,
  CARD_WIDTH_IN,
  CARD_HEIGHT_IN,
} from "../../composables/useDisplayCalibration.js";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { cssPxPerInch, isCalibrated, zoomDrift, savedAt, setCalibration, reset } =
  useDisplayCalibration();

const draftDpi = ref<number>(cssPxPerInch.value);
const showAdvanced = ref(false);

// When the dialog opens, seed draft from the currently-saved calibration.
watch(() => props.open, (opening) => {
  if (opening) {
    draftDpi.value = cssPxPerInch.value;
    showAdvanced.value = false;
  }
});

// Calibration target is a real Pokémon card (2.5″ × 3.5″ = 63.5 × 88.9 mm).
// This is the most direct reference — the user is calibrating for Pokémon-card
// preview anyway, and using the same card type sidesteps any aspect-ratio
// uncertainty that comes from substituting a credit card / ID.
const rectWidthPx = computed(() => CARD_WIDTH_IN * draftDpi.value);
const rectHeightPx = computed(() => CARD_HEIGHT_IN * draftDpi.value);

// Snapshot the drift value when the dialog opens so the banner doesn't flicker
// as the slider moves (drift compares saved DPR, not draft DPI).
const showDriftBanner = computed(() => isCalibrated.value && zoomDrift.value > 0.05);

function onSlider(e: Event) {
  draftDpi.value = Number((e.target as HTMLInputElement).value);
}

function onNumeric(e: Event) {
  const n = Number((e.target as HTMLInputElement).value);
  if (!isNaN(n)) draftDpi.value = Math.max(40, Math.min(600, n));
}

function save() {
  setCalibration(draftDpi.value);
  emit("close");
}

function cancel() {
  emit("close");
}

function clearCalibration() {
  reset();
  draftDpi.value = 96;
}

const savedAtPretty = computed(() => {
  if (!savedAt.value) return "";
  try {
    return new Date(savedAt.value).toLocaleString();
  } catch {
    return savedAt.value;
  }
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="cal-overlay" @click.self="cancel">
      <div class="cal-box">
        <div class="cal-top">
          <div class="cal-title">Calibrate display</div>
          <button class="cal-close" @click="cancel">&times;</button>
        </div>

        <p class="cal-intro">
          Hold a real Pokémon card flat against your screen and adjust the slider
          until the on-screen rectangle matches the card's outline exactly. The
          gallery's print-preview thumbnails will then render at this true size.
        </p>

        <div v-if="showDriftBanner" class="cal-banner">
          Your browser zoom or display scaling has changed since the last calibration
          ({{ savedAtPretty }}). Re-verify before trusting the print preview.
        </div>

        <div class="cal-rect-wrap">
          <div
            class="cal-rect"
            :style="{ width: `${rectWidthPx}px`, height: `${rectHeightPx}px` }"
            aria-label="Credit-card calibration rectangle"
          >
            <div class="cal-rect-corner cal-rect-corner-tl"></div>
            <div class="cal-rect-corner cal-rect-corner-tr"></div>
            <div class="cal-rect-corner cal-rect-corner-bl"></div>
            <div class="cal-rect-corner cal-rect-corner-br"></div>
            <div class="cal-rect-text">2.5″ × 3.5″ &nbsp;·&nbsp; 63.5 × 88.9 mm</div>
          </div>
        </div>

        <div class="cal-slider-row">
          <label class="cal-slider-label" for="cal-dpi-slider">Display DPI</label>
          <input
            id="cal-dpi-slider"
            class="cal-slider"
            type="range"
            min="60"
            max="300"
            step="1"
            :value="draftDpi"
            @input="onSlider"
          />
          <span class="cal-dpi-readout">{{ Math.round(draftDpi) }} DPI</span>
        </div>

        <div class="cal-advanced">
          <button class="cal-advanced-toggle" @click="showAdvanced = !showAdvanced">
            {{ showAdvanced ? '▾' : '▸' }} Use exact DPI
          </button>
          <div v-if="showAdvanced" class="cal-advanced-body">
            <input
              type="number"
              class="cal-numeric"
              min="40"
              max="600"
              step="1"
              :value="Math.round(draftDpi)"
              @input="onNumeric"
            />
            <span class="cal-advanced-hint">
              Common: 96 (default), 110 (27″ 1440p), 163 (27″ 4K), 227 (13″ Retina)
            </span>
          </div>
        </div>

        <div class="cal-notes">
          <div>· Set your browser zoom to 100% before calibrating (Ctrl+0).</div>
          <div>· If you move this window to a different display, re-calibrate.</div>
          <div v-if="isCalibrated">
            · Last calibrated: {{ savedAtPretty }} at {{ Math.round(cssPxPerInch) }} DPI.
          </div>
        </div>

        <div class="cal-actions">
          <button
            v-if="isCalibrated"
            class="btn cal-btn-clear"
            title="Forget calibration — preview reverts to the 96 DPI default."
            @click="clearCalibration"
          >Clear</button>
          <span class="cal-actions-spacer" />
          <button class="btn cal-btn-cancel" @click="cancel">Cancel</button>
          <button class="btn cal-btn-save" @click="save">Save calibration</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.78);
  z-index: 9700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.cal-box {
  background: #16213e;
  border-radius: 12px;
  padding: 20px 24px 18px;
  max-width: 640px;
  width: 100%;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
  color: #e0e0e0;
}

.cal-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.cal-title {
  font-size: 17px;
  font-weight: 700;
  color: #fff;
}

.cal-close {
  font-size: 24px;
  color: #888;
  background: none;
  border: none;
  cursor: pointer;
  line-height: 1;
  padding: 0 6px;
}
.cal-close:hover { color: #fff; }

.cal-intro {
  font-size: 13px;
  color: #bbb;
  line-height: 1.5;
  margin: 0 0 14px 0;
}

.cal-banner {
  background: #3d2f06;
  color: #f6e05e;
  border: 1px solid #744d10;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  margin-bottom: 14px;
  line-height: 1.5;
}

.cal-rect-wrap {
  display: flex;
  justify-content: center;
  padding: 22px 0 6px 0;
}

.cal-rect {
  position: relative;
  background: linear-gradient(135deg, #2a3a5a 0%, #1a2540 100%);
  border: 1px solid #5a8cd6;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(90, 140, 214, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cal-rect-corner {
  position: absolute;
  width: 8px;
  height: 8px;
  border: 2px solid #f6e05e;
}
.cal-rect-corner-tl { top: -1px; left: -1px; border-right: none; border-bottom: none; }
.cal-rect-corner-tr { top: -1px; right: -1px; border-left: none; border-bottom: none; }
.cal-rect-corner-bl { bottom: -1px; left: -1px; border-right: none; border-top: none; }
.cal-rect-corner-br { bottom: -1px; right: -1px; border-left: none; border-top: none; }

.cal-rect-text {
  font-size: 11px;
  color: #8fb3e4;
  font-family: monospace;
  letter-spacing: 0.04em;
}

.cal-slider-row {
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  align-items: center;
  gap: 12px;
  padding: 10px 4px 6px;
}

.cal-slider-label {
  font-size: 12px;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.cal-slider {
  width: 100%;
  accent-color: #f39c12;
}

.cal-dpi-readout {
  font-size: 14px;
  font-weight: 700;
  color: #f39c12;
  font-variant-numeric: tabular-nums;
  min-width: 70px;
  text-align: right;
}

.cal-advanced {
  margin: 6px 0 12px;
}

.cal-advanced-toggle {
  background: none;
  border: none;
  color: #8fb3e4;
  font-size: 12px;
  cursor: pointer;
  padding: 4px 0;
}
.cal-advanced-toggle:hover { color: #fff; }

.cal-advanced-body {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0 0 14px;
}

.cal-numeric {
  width: 80px;
  background: #0f1729;
  border: 1px solid #333;
  color: #fff;
  border-radius: 4px;
  padding: 5px 8px;
  font-size: 13px;
}

.cal-advanced-hint {
  font-size: 11px;
  color: #777;
}

.cal-notes {
  font-size: 11px;
  color: #777;
  line-height: 1.7;
  padding: 8px 4px 12px;
  border-top: 1px solid #243150;
  margin-top: 6px;
}

.cal-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cal-actions-spacer { flex: 1; }

.cal-btn-cancel { background: #2d3748; color: #a0aec0; }
.cal-btn-save { background: #f39c12; color: #000; }
.cal-btn-clear { background: #2d3748; color: #888; }
</style>
