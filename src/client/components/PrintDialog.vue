<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import { gridForPaper } from "../../shared/utils/print-grid.js";
import { summarizePrint } from "../../shared/utils/print-summary.js";
import { buildDeckPrintUrl } from "../../shared/utils/print-params.js";
import { cricutCardsPerSheet, cricutSheetCm, CRICUT_LAYOUT } from "../../shared/utils/print-cricut-layout.js";
import { loadPrintOptions, savePrintOptions } from "../lib/print-options.js";

/**
 * Layout step of a deck print. Which cards, and how many copies, were decided
 * in the deck grid's print mode (usePrintPlan) — this dialog only picks paper,
 * orientation, art and cut guides, shows the sheet fit, and opens the sheet.
 */
const props = defineProps<{
  deckId: string;
  /** Total copies the print plan will put on paper. */
  copies: number;
  /** Sparse `counts=` overrides from encodePrintCounts; "" prints the whole deck. */
  counts: string;
}>();

const emit = defineEmits<{
  close: [];
  /** The sheet was opened — the caller records the plan as printed. */
  printed: [];
}>();

const stored = loadPrintOptions();
const artwork = ref(stored.artwork);
const paper = ref(stored.paper);
const orientation = ref(stored.orientation);
const cropMarks = ref(stored.cropMarks);
const mode = ref(stored.mode);

watchEffect(() => {
  savePrintOptions({
    artwork: artwork.value,
    paper: paper.value,
    orientation: orientation.value,
    cropMarks: cropMarks.value,
    mode: mode.value,
  });
});

// Cricut Print Then Cut fixes Letter portrait, six landscape cards, Design
// Space's marks; the paper/orientation/crop knobs stay visible but inert.
const isCricut = computed(() => mode.value === "cricut");
const lockedTitle = "Cricut Print Then Cut fixes this: Letter, portrait, Design Space registration marks";
const cricutSheetSize = cricutSheetCm(CRICUT_LAYOUT);
const cardsPerSheet = computed(() =>
  isCricut.value ? cricutCardsPerSheet() : gridForPaper(paper.value, orientation.value).cardsPerSheet,
);
const summary = computed(() => summarizePrint(props.copies, cardsPerSheet.value));

function handlePrint() {
  const url = buildDeckPrintUrl({
    deckId: props.deckId,
    counts: props.counts,
    art: artwork.value,
    paper: paper.value,
    orientation: orientation.value,
    cropMarks: cropMarks.value,
    mode: mode.value,
  });
  window.open(url, "_blank");
  emit("printed");
}
</script>

<template>
  <div class="dialog-overlay" @click="emit('close')">
    <div class="dialog print-dialog" @click.stop>
      <h3>Print Options</h3>

      <div v-if="summary.incomplete" class="print-warn-banner">
        ⚠ Incomplete sheet — last sheet has
        {{ summary.emptySlots }} empty slot{{ summary.emptySlots === 1 ? "" : "s" }}
      </div>

      <div class="print-section-label">Layout</div>
      <div class="print-radio-group">
        <label class="print-radio">
          <input type="radio" v-model="mode" value="sheet" data-testid="print-mode-sheet" />
          Print sheet
        </label>
        <label class="print-radio" title="Six landscape cards per Letter page with Design Space's own registration marks, as a lossless PDF. Design Space only cuts.">
          <input type="radio" v-model="mode" value="cricut" data-testid="print-mode-cricut" />
          Cricut Print Then Cut
        </label>
      </div>

      <div class="print-section-label">Artwork</div>
      <div class="print-radio-group">
        <label class="print-radio">
          <input type="radio" v-model="artwork" value="proxy" />
          Generated proxy
        </label>
        <label class="print-radio">
          <input type="radio" v-model="artwork" value="original" />
          Original art
        </label>
      </div>

      <div class="print-section-label">Paper</div>
      <div class="print-radio-group" :title="isCricut ? lockedTitle : undefined">
        <label class="print-radio">
          <input type="radio" v-model="paper" value="letter" :disabled="isCricut" />
          Letter (8.5 × 11)
        </label>
        <label class="print-radio">
          <input type="radio" v-model="paper" value="super-b" :disabled="isCricut" />
          Super-B (13 × 19)
        </label>
      </div>

      <div class="print-section-label">Orientation <span class="print-section-hint">— {{ cardsPerSheet }} cards/sheet</span></div>
      <div class="print-radio-group" :title="isCricut ? lockedTitle : undefined">
        <label class="print-radio">
          <input type="radio" v-model="orientation" value="portrait" :disabled="isCricut" />
          Portrait
        </label>
        <label class="print-radio">
          <input type="radio" v-model="orientation" value="landscape" :disabled="isCricut" />
          Landscape
        </label>
      </div>

      <div class="print-section-label">Cut guides</div>
      <div class="print-checkbox-list" :title="isCricut ? lockedTitle : undefined">
        <label class="print-checkbox">
          <input type="checkbox" v-model="cropMarks" :disabled="isCricut" />
          Crop marks
        </label>
      </div>

      <p v-if="isCricut" class="print-origin-hint" data-testid="print-cricut-hint">
        Letter, six landscape cards per page, Design Space's own registration marks, lifted {{ CRICUT_LAYOUT.liftMm }} mm
        so the lower marks clear the printer. Print the PDF at 100% on Letter with fit-to-page off.
        In Design Space keep one project holding the cut fixture at {{ cricutSheetSize.w }} × {{ cricutSheetSize.h }} cm;
        per sheet: Make It, discard its print, load the paper flush in the mat corner, cut.
      </p>
      <p v-else class="print-origin-hint">
        Cards start 0.25″ from the top-left (Cricut no-cut zone). Print at 100% with margins set to None.
        Uncheck crop marks for flush 63×87mm spacing (a real card's measured size).
        Adjust which cards print, and how many, on the deck grid behind this dialog.
      </p>

      <div class="print-summary" data-testid="print-dialog-summary">
        <template v-if="summary.cardCount === 0">
          <span class="print-summary-muted">Nothing to print</span>
        </template>
        <template v-else>
          <span>
            {{ summary.cardCount }} card{{ summary.cardCount === 1 ? "" : "s" }} ·
            {{ summary.sheets }} sheet{{ summary.sheets === 1 ? "" : "s" }}
          </span>
        </template>
      </div>

      <div class="dialog-actions">
        <button class="btn-secondary" @click="emit('close')">Cancel</button>
        <button
          class="btn-primary"
          :disabled="summary.cardCount === 0"
          :title="summary.cardCount === 0 ? 'Every card is set to 0 copies' : isCricut ? 'Open the Cricut sheet in a new tab; it renders the pages and downloads the print PDF' : 'Open the print sheet in a new tab'"
          @click="handlePrint"
        >{{ isCricut ? "Cricut PDF" : "Print" }}</button>
      </div>
    </div>
  </div>
</template>
