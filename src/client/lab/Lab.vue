<script setup lang="ts">
import { ref, computed } from "vue";
import CardFullArt from "./cards/CardFullArt.vue";
import { SAMPLE_CARDS } from "./sample-cards";

const THEMES = [
  { id: "default-fullart", label: "Default" },
  { id: "noir-fullart",    label: "Noir"    },
];

const activeTheme = ref(THEMES[0].id);
const zoom        = ref(0.4);

/*
 * Card geometry — kept in sync with the --card-w / --card-h CSS vars.
 * 750×1050 matches the SVG renderer's native canvas (constants.ts CARD_W/H),
 * so JSON template coordinates (anchorX, anchorY, fontSize) port 1:1.
 * Used to compute scaled frame dimensions so flexbox lays cards out at
 * their visual (post-transform) size.
 */
const CARD_W = 750;
const CARD_H = 1050;

const frameStyle = computed(() => ({
  width:  `${CARD_W * zoom.value}px`,
  height: `${CARD_H * zoom.value}px`,
}));

const scalerStyle = computed(() => ({
  transform: `scale(${zoom.value})`,
  transformOrigin: "top left",
}));
</script>

<template>
  <main class="lab">
    <header class="bar">
      <h1 class="lab-title">Card Lab</h1>

      <div class="control">
        <label>Theme</label>
        <select v-model="activeTheme">
          <option v-for="t in THEMES" :key="t.id" :value="t.id">{{ t.label }}</option>
        </select>
      </div>

      <div class="control">
        <label>Zoom</label>
        <input type="range" min="0.25" max="1.0" step="0.05" v-model.number="zoom" />
        <span class="zoom-readout">{{ Math.round(zoom * 100) }}%</span>
      </div>

      <span class="count">{{ SAMPLE_CARDS.length }} cards</span>
    </header>

    <section class="stage" :class="`theme-${activeTheme}`">
      <div
        v-for="(c, i) in SAMPLE_CARDS"
        :key="i"
        class="card-frame"
        :style="frameStyle"
      >
        <div class="card-scaler" :style="scalerStyle">
          <CardFullArt :card="c" />
        </div>
      </div>
    </section>
  </main>
</template>

<style>
html, body {
  margin: 0;
  padding: 0;
  background: #0a0a0c;
  color: #e8e8ea;
  font-family: system-ui, -apple-system, sans-serif;
  min-height: 100vh;
}
</style>

<style scoped>
.lab {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.bar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px 24px;
  background: #15151a;
  border-bottom: 1px solid #2a2a32;
  position: sticky;
  top: 0;
  z-index: 10;
  flex-wrap: wrap;
}

.lab-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #c8c8d0;
}

.control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control label {
  font-size: 13px;
  color: #909098;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.control select,
.control input[type="range"] {
  background: #1f1f26;
  color: #e8e8ea;
  border: 1px solid #2a2a32;
  padding: 4px 8px;
  border-radius: 4px;
  font: inherit;
  font-size: 13px;
}

.zoom-readout {
  font-size: 13px;
  color: #909098;
  width: 40px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.count {
  margin-left: auto;
  font-size: 13px;
  color: #707078;
}

/*
 * Stage is a flex-wrap grid. Theme class is applied here so all child
 * cards inherit the active theme's CSS variables.
 */
.stage {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  justify-content: center;
  gap: 24px;
  padding: 32px;
  overflow: auto;
  background:
    radial-gradient(circle at 50% 30%, #1a1a22 0%, #0a0a0c 70%);
}

/*
 * card-frame reserves the post-scale visual footprint so flexbox can
 * lay cards out correctly. The inner scaler applies the actual transform.
 */
.card-frame {
  flex: 0 0 auto;
}

.card-scaler {
  /* transform set inline via scalerStyle */
}
</style>
