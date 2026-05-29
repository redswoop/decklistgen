<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import CardFullArt    from "./cards/CardFullArt.vue";
import CardTrainer    from "./cards/CardTrainer.vue";
import CardBasicEnergy from "./cards/CardBasicEnergy.vue";
import { SAMPLE_CARDS, SAMPLE_TRAINERS, SAMPLE_BASIC_ENERGIES } from "./sample-cards";

const THEMES = [
  { id: "default-fullart", label: "Default" },
  { id: "noir-fullart",    label: "Noir"    },
];

/*
 * Card geometry — kept in sync with the --card-w / --card-h CSS vars.
 * 750×1050 matches the SVG renderer's native canvas (constants.ts CARD_W/H),
 * so JSON template coordinates (anchorX, anchorY, fontSize) port 1:1.
 */
const CARD_W = 750;
const CARD_H = 1050;

/*
 * Print scale: 750 CSS px ↔ 2.5in at 96 dpi. (2.5 * 96) / 750 = 0.32.
 * Height matches: (3.5 * 96) / 1050 = 0.32. One scale factor for both.
 * The wrapper holds the physical 2.5in × 3.5in footprint; the inner card
 * stays at 750×1050 px and `transform: scale(0.32)` maps it down.
 */
const PRINT_SCALE = (2.5 * 96) / CARD_W;

/*
 * URL ?print=1 flips the page into a print-ready 3×3 grid sized to US Letter.
 * Anything in the live-iteration UI (toolbar, page background, zoom) is hidden.
 * Add &auto=1 to also fire window.print() once fonts settle — the Print
 * button below opens a new tab with both flags for one-click testing.
 */
const params = typeof window !== "undefined"
  ? new URLSearchParams(window.location.search)
  : new URLSearchParams();
const isPrint    = params.get("print") === "1";
const autoPrint  = params.get("auto")  === "1";

const activeTheme = ref(THEMES[0].id);
const zoom        = ref(0.4);

/*
 * Defer rendering in print mode until web fonts have finished loading.
 * Otherwise the printed page can snapshot fallback metrics — wrong widths
 * for card names, wrong glyph alignment in energy dots, etc. The fonts
 * declare font-display:block so they're invisible until loaded anyway,
 * but waiting on document.fonts.ready also blocks layout-dependent code
 * (and anything that triggers print via window.print()).
 */
const ready = ref(!isPrint);
onMounted(async () => {
  if (isPrint) {
    await document.fonts.ready;
    ready.value = true;
    if (autoPrint) {
      // One frame after layout so the print sheet is committed to the DOM.
      requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    }
  }
});

function openPrintView() {
  // Carry the active theme so the new tab inherits the same look.
  const url = `${window.location.pathname}?print=1&auto=1&theme=${activeTheme.value}`;
  window.open(url, "_blank", "noopener");
}

// Apply ?theme= from the URL (set by openPrintView) so the print tab matches.
const urlTheme = params.get("theme");
if (urlTheme && THEMES.some(t => t.id === urlTheme)) {
  activeTheme.value = urlTheme;
}

const frameStyle = computed(() => ({
  width:  `${CARD_W * zoom.value}px`,
  height: `${CARD_H * zoom.value}px`,
}));

const scalerStyle = computed(() => ({
  transform: `scale(${zoom.value})`,
  transformOrigin: "top left",
}));

const printScalerStyle = {
  transform: `scale(${PRINT_SCALE})`,
  transformOrigin: "top left",
};

/* String forms for <style> v-bind. */
const cardWPx = `${CARD_W}px`;
const cardHPx = `${CARD_H}px`;
</script>

<template>
  <main class="lab" :class="{ 'lab-print': isPrint }">
    <header v-if="!isPrint" class="bar">
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

      <button class="print-btn" type="button" @click="openPrintView">Print…</button>

      <span class="count">{{ SAMPLE_TRAINERS.length + SAMPLE_CARDS.length + SAMPLE_BASIC_ENERGIES.length }} cards</span>
    </header>

    <!--
      Print layout: 3×3 grid of cards at physical 2.5in × 3.5in, no gutters.
      Letter (8.5×11) with 0.25in margins → 8×10.5 usable → 3 across × 3 down
      fits exactly. With 10 sample cards, the 10th breaks to a second page.
    -->
    <section
      v-if="isPrint && ready"
      class="print-sheet"
      :class="`theme-${activeTheme}`"
    >
      <div
        v-for="(c, i) in SAMPLE_TRAINERS"
        :key="`t-${i}`"
        class="print-cell"
      >
        <div class="print-scaler" :style="printScalerStyle">
          <CardTrainer :card="c" />
        </div>
      </div>
      <div
        v-for="(c, i) in SAMPLE_CARDS"
        :key="`p-${i}`"
        class="print-cell"
      >
        <div class="print-scaler" :style="printScalerStyle">
          <CardFullArt :card="c" />
        </div>
      </div>
      <div
        v-for="(c, i) in SAMPLE_BASIC_ENERGIES"
        :key="`e-${i}`"
        class="print-cell"
      >
        <div class="print-scaler" :style="printScalerStyle">
          <CardBasicEnergy :card="c" />
        </div>
      </div>
    </section>

    <section
      v-else-if="!isPrint"
      class="stage"
      :class="`theme-${activeTheme}`"
    >
      <div
        v-for="(c, i) in SAMPLE_TRAINERS"
        :key="`t-${i}`"
        class="card-frame"
        :style="frameStyle"
      >
        <div class="card-scaler" :style="scalerStyle">
          <CardTrainer :card="c" />
        </div>
      </div>
      <div
        v-for="(c, i) in SAMPLE_CARDS"
        :key="`p-${i}`"
        class="card-frame"
        :style="frameStyle"
      >
        <div class="card-scaler" :style="scalerStyle">
          <CardFullArt :card="c" />
        </div>
      </div>
      <div
        v-for="(c, i) in SAMPLE_BASIC_ENERGIES"
        :key="`e-${i}`"
        class="card-frame"
        :style="frameStyle"
      >
        <div class="card-scaler" :style="scalerStyle">
          <CardBasicEnergy :card="c" />
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

/*
 * Print page: US Letter portrait with 0.25in margins on all sides.
 * Matches src/server/services/pokeproxy/print-html.ts so the lab's print
 * path is dimensionally identical to the existing SVG print path.
 */
@page {
  size: letter portrait;
  margin: 0.25in;
}

@media print {
  html, body {
    background: white !important;
    color: black;
  }
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

.print-btn {
  background: #1f1f26;
  color: #e8e8ea;
  border: 1px solid #2a2a32;
  padding: 6px 14px;
  border-radius: 4px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.print-btn:hover {
  background: #2a2a32;
  border-color: #3a3a44;
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

/*
 * Print sheet: CSS grid with exactly 3 columns of 2.5in cells, rows of 3.5in.
 * No gap — cards print flush so a paper cutter can slice rows/columns in
 * single passes. `break-inside: avoid` keeps cards intact across page breaks.
 *
 * On-screen (Chrome's print preview is rendered on-screen first) we also
 * show this layout — handy for eyeballing before committing to print.
 */
.print-sheet {
  display: grid;
  grid-template-columns: repeat(3, 2.5in);
  grid-auto-rows: 3.5in;
  justify-content: start;
  align-content: start;
  background: white;
}

.print-cell {
  width: 2.5in;
  height: 3.5in;
  overflow: hidden;
  break-inside: avoid;
  page-break-inside: avoid;
}

.print-scaler {
  /* transform set inline via printScalerStyle */
  width:  v-bind(cardWPx);
  height: v-bind(cardHPx);
}

@media print {
  .lab.lab-print {
    display: block;
    min-height: 0;
  }
  /*
   * Strip the on-screen drop shadow so cards print clean to the edge.
   * The shadow is a screen-only decoration; on paper it just shows as a
   * gray smudge along the right and bottom edges.
   */
  .print-cell :deep(.card) {
    box-shadow: none;
  }
}
</style>
