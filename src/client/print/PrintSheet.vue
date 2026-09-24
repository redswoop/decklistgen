<script setup lang="ts">
/**
 * Print sheet — replaces the server-side `/api/pokeproxy/print/:deckId` HTML
 * generator. Boots into a Vue app at /print.html, fetches the deck (or a
 * gallery card-ID list from sessionStorage), and renders the same 63×87mm
 * grid the lab pioneered (see src/client/lab/Lab.vue for the reference).
 *
 * URL params:
 *   ?deckId=…         — saved-deck print (tries protected endpoint first,
 *                       falls back to public).
 *   ?cardId=a[,b…]    — explicit card print (the lightbox "Print Jumbo" action;
 *                       one card, or a 2-up pair). Bypasses the category filter —
 *                       the user picked these cards.
 *   ?size=jumbo       — print at the oversized promo size (132mm × 185mm).
 *                       One per page portrait; two per page landscape.
 *                       Default "standard" (63×87mm, a measured real card).
 *   ?gallery=1        — read card IDs from sessionStorage key
 *                       `gallery-print-ids` (set by GalleryView.openPrint).
 *   ?qty=one-each     — print exactly 1 of each card; default repeats by deck count.
 *   ?paper=super-b    — paper size; default "letter".
 *   ?orientation=…    — "portrait" (default) or "landscape".
 *   ?exclude=a,b      — comma-separated category exclusions
 *                       (pokemon|supporters|items|tools|stadiums|specialenergy).
 *   ?noBasicEnergy=1  — drop basic energies (Energy cards with no effect).
 *   ?crop=0           — disable crop/registration marks (on by default).
 *   ?art=…            — which version to print, mirroring the lightbox tabs:
 *                       "proxy" (default, CSS card over cleaned art),
 *                       "cleaned" (plain cleaned PNG), or
 *                       "original" (plain untouched card scan).
 *                       May be a comma-separated list aligned 1:1 with cardId
 *                       (jumbo pair-picker) to give each card its own version;
 *                       a single value applies to all cards.
 *   ?auto=1           — fire window.print() automatically after fonts settle.
 */
import { ref, computed, watch, onMounted } from "vue";
import {
  gridForPaper,
  CARD_DIMS_IN,
  PAGE_MARGIN_IN,
} from "../../shared/utils/print-grid.js";
import {
  cutSvgForGrid,
  cutSvgFilename,
  solveCutCorrection,
  type CutCalibration,
} from "../../shared/utils/print-cut-svg.js";
import {
  cropMarkLayout,
  pageGridShape,
  CARD_GAP_IN,
  type CropMarkLayout,
} from "../../shared/utils/print-crop-marks.js";
import { parsePrintParams } from "../../shared/utils/print-params.js";
import { usePrintLoader, type PrintEntry } from "../composables/usePrintLoader.js";
import CssCardRenderer from "../components/CssCardRenderer.vue";

interface PrintPage {
  cells: PrintEntry[];
  cols: number;
  rows: number;
  marks: CropMarkLayout | null;
}

// Native canvas of the lab card renderer (750×1050 = 2.5:3.5). A real card is
// 63×87mm, a slightly wider ratio, so the scaler stretches ~1% on one axis to
// fill the cell exactly rather than clipping the bottom or leaving side gaps.
const CARD_W = 750;
const CARD_H = 1050;
const CSS_PX_PER_IN = 96;

// Parsed URL grammar (see print-params.ts / PRINT_SHEET.md).
const params = parsePrintParams(window.location.search);
const { cardSize, paper, orientation, cropMarks, autoPrint } = params;
const cardDims = CARD_DIMS_IN[cardSize];
const PRINT_SCALE_X = (cardDims.w * CSS_PX_PER_IN) / CARD_W;
const PRINT_SCALE_Y = (cardDims.h * CSS_PX_PER_IN) / CARD_H;

// With crop marks on, cards sit in a 0.5mm gap so a single cut lands between
// two cards; with marks off they print flush.
const cardGapIn = cropMarks ? CARD_GAP_IN : 0;

const grid = computed(() => gridForPaper(paper, orientation, cardSize));

const { entries, error, load } = usePrintLoader(params);
const ready = ref(false);

/**
 * Split the flat entry list into per-sheet pages. Each page knows its own grid
 * shape (a partial last page shrinks to its cards) and, when enabled, the
 * crop-mark geometry sized to that shape.
 */
const pages = computed<PrintPage[]>(() => {
  const g = grid.value;
  const per = g.cardsPerSheet;
  const out: PrintPage[] = [];
  for (let i = 0; i < entries.value.length; i += per) {
    const cells = entries.value.slice(i, i + per);
    const shape = pageGridShape(cells.length, g.cols, g.rows);
    out.push({
      cells,
      cols: shape.cols,
      rows: shape.rows,
      marks: cropMarks
        ? cropMarkLayout(
            shape.cols,
            shape.rows,
            g.pageW,
            g.pageH,
            cardGapIn,
            cardDims.w,
            cardDims.h,
          )
        : null,
    });
  }
  return out;
});

// Deterministic readiness contract for tests and headless screenshots. The
// print sheet is a separate Vite entry reached only by hand-built URLs, and the
// real output is window.print() — which hangs headless Chromium. Rather than
// race timers, anything driving this page should wait on
// `document.documentElement[data-print-state]` reaching a terminal value:
//   "loading"  — mount in progress
//   "ready"    — sheet rendered, fonts settled, layout committed (safe snapshot)
//   "empty"    — loaded successfully but nothing to print (filters/empty deck)
//   "error"    — load failed; the message is shown in .status-error
// See PRINT_SHEET.md for the URL grammar and the wait-on-state recipe.
function setPrintState(state: "loading" | "ready" | "empty" | "error") {
  document.documentElement.dataset.printState = state;
}

onMounted(async () => {
  setPrintState("loading");
  installPageRule();
  try {
    if ((await load()) === "no-params") {
      setPrintState("error");
      return;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    setPrintState("error");
    return;
  }
  // Block render until fonts settle. Print snapshots would otherwise use
  // fallback metrics and produce wrong glyph widths.
  await document.fonts.ready;
  ready.value = true;
  // Publish the terminal state two frames out — the same commit point auto-print
  // trusts — so the attribute only flips once the sheet is fully laid out.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      setPrintState(entries.value.length > 0 ? "ready" : "empty");
      if (autoPrint && entries.value.length > 0) {
        window.print();
      }
    }),
  );
});

const printScalerStyle = {
  transform: `scale(${PRINT_SCALE_X}, ${PRINT_SCALE_Y})`,
  transformOrigin: "top left",
};

const cellStyle = {
  width: `${cardDims.w}in`,
  height: `${cardDims.h}in`,
};

const cardGapCss = `${cardGapIn}in`;

const originStyle = {
  top: `${PAGE_MARGIN_IN}in`,
  left: `${PAGE_MARGIN_IN}in`,
};

function cropMarkStyle(pad: number) {
  return {
    top: `-${pad}in`,
    left: `-${pad}in`,
  };
}

// Cricut calibration: where the blade actually landed on a test cut, mm from
// the paper edges. Per printer+cutter+mat, not per deck, so it lives in
// localStorage on the app origin rather than the URL. Empty = uncorrected.
const CAL_KEY = "cricut-cut-calibration";
const calFields = ["firstLeft", "firstTop", "lastRight", "lastBottom"] as const;
type CalDraft = Record<(typeof calFields)[number], string>;
const emptyCal = (): CalDraft => ({ firstLeft: "", firstTop: "", lastRight: "", lastBottom: "" });

function loadCal(): CalDraft {
  try {
    const raw = localStorage.getItem(CAL_KEY);
    if (!raw) return emptyCal();
    // Vue casts type="number" inputs to numbers before v-model stores them,
    // so accept either and normalise to the string the inputs bind to.
    const parsed = JSON.parse(raw) as Partial<Record<keyof CalDraft, string | number>>;
    const out = emptyCal();
    for (const k of calFields) {
      const v = parsed[k];
      if (typeof v === "string" || typeof v === "number") out[k] = String(v);
    }
    return out;
  } catch {
    return emptyCal();
  }
}
const cal = ref<CalDraft>(loadCal());
const showCal = ref(false);

watch(
  cal,
  (v) => {
    try {
      localStorage.setItem(CAL_KEY, JSON.stringify(v));
    } catch {
      /* private mode etc. — calibration just won't persist */
    }
  },
  { deep: true },
);

function clearCal() {
  cal.value = emptyCal();
}

/** All four numbers present and sane → a CutCalibration; otherwise null. */
const calibration = computed<CutCalibration | null>(() => {
  const n = (k: keyof CalDraft) => Number.parseFloat(cal.value[k]);
  const v = { firstLeft: n("firstLeft"), firstTop: n("firstTop"), lastRight: n("lastRight"), lastBottom: n("lastBottom") };
  if (Object.values(v).some((x) => !Number.isFinite(x))) return null;
  if (v.lastRight <= v.firstLeft || v.lastBottom <= v.firstTop) return null;
  return v;
});

// Cricut cut file for a full sheet — same cols/rows/card dims/gap as the grid
// on screen, so the download can only ever describe what's printed. Screen-only
// (hidden under @media print). A partial last page just cuts some empty paper.
const cutFile = computed(() => {
  const g = grid.value;
  const originMm = PAGE_MARGIN_IN * 25.4;
  const ink = {
    originMm,
    widthMm: (g.cols * cardDims.w + (g.cols - 1) * cardGapIn) * 25.4,
    heightMm: (g.rows * cardDims.h + (g.rows - 1) * cardGapIn) * 25.4,
  };
  const correction = calibration.value ? solveCutCorrection(calibration.value, ink) : undefined;
  const cut = cutSvgForGrid({
    cols: g.cols,
    rows: g.rows,
    gap: cardGapIn,
    originIn: PAGE_MARGIN_IN,
    cardW: cardDims.w,
    cardH: cardDims.h,
    correction,
  });
  const filename = cutSvgFilename({
    paper,
    orientation,
    cols: g.cols,
    rows: g.rows,
    gap: cardGapIn,
    cardW: cardDims.w,
    cardH: cardDims.h,
  });
  const mm = (v: number) => v.toFixed(2).replace(/\.?0+$/, "");
  return {
    ...cut,
    filename: correction ? filename.replace(/\.svg$/, "-calibrated.svg") : filename,
    sizeLabel: `${mm(cut.widthMm)} × ${mm(cut.heightMm)} mm`,
    originLabel: `${mm(cut.originMm)} mm`,
    // Expected edges for the calibration placeholders: where the ink is.
    expected: {
      firstLeft: mm(ink.originMm),
      firstTop: mm(ink.originMm),
      lastRight: mm(ink.originMm + ink.widthMm),
      lastBottom: mm(ink.originMm + ink.heightMm),
    },
    correctionLabel: correction
      ? `scale ${correction.scaleX.toFixed(4)} × ${correction.scaleY.toFixed(4)}, corner lands at ${mm(correction.cornerX)}, ${mm(correction.cornerY)} mm`
      : null,
  };
});

function downloadCutFile() {
  const blob = new Blob([cutFile.value.svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = cutFile.value.filename;
  a.click();
  URL.revokeObjectURL(url);
}

// @page is set imperatively because the size depends on URL params and Vue's
// template <style> blocks are static. Inject one rule into <head> at mount.
// Margin is 0: each .print-page-sheet is sized to the full paper. The grid
// pins to a 0.25in top-left origin (Cricut no-cut zone); crop marks sit in
// that gutter.
function installPageRule() {
  const size = paper === "super-b" ? "13in 19in" : "letter";
  const style = document.createElement("style");
  style.textContent = `@page { size: ${size} ${orientation}; margin: 0; }`;
  document.head.appendChild(style);
}
</script>

<template>
  <main class="print-page theme-default-fullart">
    <div v-if="error" class="status status-error">{{ error }}</div>
    <div v-else-if="!ready" class="status">Loading…</div>
    <div v-else-if="entries.length === 0" class="status">
      Nothing to print — every card was filtered out.
    </div>
    <template v-else>
      <aside class="cut-file-bar" data-testid="cut-file-bar">
        <button
          type="button"
          class="cut-file-btn"
          data-testid="cut-file-download"
          :title="`One compound path, ${cutFile.cutCount} cuts, 3 mm corners. Import into Design Space, then place the group's top-left at X ${cutFile.originLabel}, Y ${cutFile.originLabel} on the mat with the paper in the mat corner.`"
          @click="downloadCutFile"
        >
          Download Cricut cut file
        </button>
        <span class="cut-file-meta">
          {{ cutFile.sizeLabel }} · place at {{ cutFile.originLabel }} from the mat corner
          <template v-if="cardGapIn > 0"> · matches the crop-mark gap</template>
          <template v-else> · flush</template>
          <template v-if="cutFile.correctionLabel"> · <strong>calibrated</strong></template>
        </span>
        <button
          type="button"
          class="cut-file-btn cut-file-btn-quiet"
          data-testid="cut-cal-toggle"
          :aria-expanded="showCal"
          @click="showCal = !showCal"
        >
          {{ showCal ? "Hide calibration" : "Calibrate" }}
        </button>
      </aside>
      <aside v-if="showCal" class="cut-cal" data-testid="cut-cal">
        <p class="cut-cal-help">
          Cut one uncalibrated sheet, then caliper where the blade actually went, in mm from the paper edges.
          Placeholders show where the ink is. The cut file will pre-distort so the next cut lands on it, as long as you seat the paper and place the group exactly as you did for the test cut.
        </p>
        <div class="cut-cal-grid">
          <label>Card 1 left edge
            <input v-model.trim="cal.firstLeft" type="number" step="0.01" inputmode="decimal" :placeholder="cutFile.expected.firstLeft" data-testid="cal-firstLeft" /></label>
          <label>Card 1 top edge
            <input v-model.trim="cal.firstTop" type="number" step="0.01" inputmode="decimal" :placeholder="cutFile.expected.firstTop" data-testid="cal-firstTop" /></label>
          <label>Last column right edge
            <input v-model.trim="cal.lastRight" type="number" step="0.01" inputmode="decimal" :placeholder="cutFile.expected.lastRight" data-testid="cal-lastRight" /></label>
          <label>Last row bottom edge
            <input v-model.trim="cal.lastBottom" type="number" step="0.01" inputmode="decimal" :placeholder="cutFile.expected.lastBottom" data-testid="cal-lastBottom" /></label>
        </div>
        <p v-if="cutFile.warning" class="cut-cal-warn" data-testid="cut-cal-warning">{{ cutFile.warning }}</p>
        <p v-else-if="cutFile.correctionLabel" class="cut-cal-result" data-testid="cut-cal-result">
          {{ cutFile.correctionLabel }}<template v-if="cutFile.anchored">. The file gains a 1.5 mm anchor square in the margin; discard it after cutting.</template>
        </p>
        <p v-else class="cut-cal-result">Fill all four to apply.</p>
        <button
          type="button"
          class="cut-file-btn cut-file-btn-quiet"
          data-testid="cut-cal-clear"
          :disabled="!calFields.some((k) => cal[k] !== '')"
          title="Forget the measurements and go back to the uncorrected file"
          @click="clearCal"
        >
          Clear
        </button>
      </aside>
      <section
        v-for="(page, p) in pages"
        :key="p"
        class="print-page-sheet"
        :style="{ width: `${grid.pageW}in`, height: `${grid.pageH}in` }"
      >
        <div class="print-origin" :style="originStyle">
          <div class="print-grid" :style="{
            'grid-template-columns': `repeat(${page.cols}, ${cardDims.w}in)`,
            'grid-template-rows': `repeat(${page.rows}, ${cardDims.h}in)`,
            gap: cardGapCss,
          }">
            <div
              v-for="(e, i) in page.cells"
              :key="`${e.card.id}-${i}`"
              class="print-cell"
              :style="cellStyle"
            >
              <!-- Original / cleaned print as a plain image; no CSS chrome overlay. -->
              <img v-if="e.plain" class="print-original" :src="e.artUrl" alt="" />
              <div v-else class="print-scaler" :style="printScalerStyle">
                <CssCardRenderer
                  :card="e.card"
                  :detail="e.detail"
                  :art-url="e.artUrl"
                />
              </div>
            </div>
          </div>
          <svg
            v-if="page.marks"
            class="crop-marks"
            :style="cropMarkStyle(page.marks.pad)"
            :width="`${page.marks.svgW}in`"
            :height="`${page.marks.svgH}in`"
            :viewBox="`${-page.marks.pad} ${-page.marks.pad} ${page.marks.svgW} ${page.marks.svgH}`"
          >
            <g
              stroke="#000"
              fill="none"
              :stroke-width="page.marks.strokeIn"
              shape-rendering="crispEdges"
            >
              <line
                v-for="(ln, li) in page.marks.lines"
                :key="li"
                :x1="ln.x1"
                :y1="ln.y1"
                :x2="ln.x2"
                :y2="ln.y2"
              />
            </g>
          </svg>
        </div>
      </section>
    </template>
  </main>
</template>

<style>
html, body {
  margin: 0;
  padding: 0;
  background: #1f1f24;
  color: #e8e8ea;
  font-family: system-ui, -apple-system, sans-serif;
  min-height: 100vh;
}

@media print {
  html, body {
    background: white !important;
    color: black;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
</style>

<style scoped>
.print-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 24px;
}

.status {
  margin: 64px auto;
  font-size: 14px;
  color: #a0a0a8;
}
.status-error { color: #e57373; }

/* Screen-only chrome for the Cricut workflow; never printed. */
.cut-file-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  align-self: stretch;
  padding: 8px 12px;
  border-radius: 8px;
  background: #1c2230;
  color: #9aa5b8;
  font-size: 13px;
}
.cut-file-btn {
  padding: 6px 12px;
  border: 1px solid #3b4658;
  border-radius: 6px;
  background: #2a3242;
  color: #e6ebf3;
  font: inherit;
  cursor: pointer;
}
.cut-file-btn:hover { background: #354057; }
.cut-file-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cut-file-btn-quiet { background: transparent; }
.cut-file-meta { white-space: nowrap; }

.cut-cal {
  align-self: stretch;
  padding: 10px 12px;
  border-radius: 8px;
  background: #1c2230;
  color: #9aa5b8;
  font-size: 13px;
  display: grid;
  gap: 8px;
}
.cut-cal-help { margin: 0; }
.cut-cal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}
.cut-cal-grid label {
  display: grid;
  gap: 4px;
  font-size: 12px;
}
.cut-cal-grid input {
  padding: 4px 8px;
  border: 1px solid #3b4658;
  border-radius: 6px;
  background: #0f131b;
  color: #e6ebf3;
  font: inherit;
}
.cut-cal-result { margin: 0; color: #cfd6e2; }
.cut-cal-warn { margin: 0; color: #f0b26b; }

/* One sheet of paper: full page size. Grid pins 0.25in from the top-left so
   a Cricut mat's no-cut zone lines up; leftover paper falls right/bottom.
   Crop marks live in that 0.25in gutter. */
.print-page-sheet {
  position: relative;
  background: white;
  box-shadow: 0 2px 24px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  page-break-after: always;
  break-after: page;
}

.print-origin {
  position: absolute;
}
.print-page-sheet:last-child {
  page-break-after: auto;
  break-after: auto;
}

.print-grid {
  display: grid;
}

.print-cell {
  /* width/height set inline via cellStyle (varies by card size). */
  overflow: hidden;
  break-inside: avoid;
  page-break-inside: avoid;
}

.print-scaler {
  width: 750px;
  height: 1050px;
  /* transform set inline via printScalerStyle */
}

.print-original {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.crop-marks {
  position: absolute;
  pointer-events: none;
}

@media print {
  .cut-file-bar,
  .cut-cal {
    display: none;
  }
  .print-page {
    padding: 0;
    gap: 0;
    min-height: 0;
  }
  .print-page-sheet {
    box-shadow: none;
  }
  .print-cell :deep(.card) {
    box-shadow: none;
  }
}
</style>
