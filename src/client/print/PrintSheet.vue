<script setup lang="ts">
/**
 * Print sheet — replaces the server-side `/api/pokeproxy/print/:deckId` HTML
 * generator. Boots into a Vue app at /print.html, fetches the deck (or a
 * gallery card-ID list from sessionStorage), and renders the same 2.5"×3.5"
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
 *                       Default "standard" (2.5"×3.5").
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
import { ref, computed, onMounted } from "vue";
import {
  gridForPaper,
  CARD_DIMS_IN,
} from "../../shared/utils/print-grid.js";
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

const CARD_W = 750;
const CSS_PX_PER_IN = 96;

// Parsed URL grammar (see print-params.ts / PRINT_SHEET.md).
const params = parsePrintParams(window.location.search);
const { cardSize, paper, orientation, cropMarks, autoPrint } = params;
const cardDims = CARD_DIMS_IN[cardSize];
const PRINT_SCALE = (cardDims.w * CSS_PX_PER_IN) / CARD_W;

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
  transform: `scale(${PRINT_SCALE})`,
  transformOrigin: "top left",
};

const cellStyle = {
  width: `${cardDims.w}in`,
  height: `${cardDims.h}in`,
};

const cardGapCss = `${cardGapIn}in`;

// @page is set imperatively because the size depends on URL params and Vue's
// template <style> blocks are static. Inject one rule into <head> at mount.
// Margin is 0: each .print-page-sheet is sized to the full paper and centers
// its own grid, leaving the white margin region where crop marks live.
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
      <section
        v-for="(page, p) in pages"
        :key="p"
        class="print-page-sheet"
        :style="{ width: `${grid.pageW}in`, height: `${grid.pageH}in` }"
      >
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

/* One sheet of paper: full page size, centering its grid so the surrounding
   white margin is where crop marks sit. */
.print-page-sheet {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  box-shadow: 0 2px 24px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  page-break-after: always;
  break-after: page;
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
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

@media print {
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
