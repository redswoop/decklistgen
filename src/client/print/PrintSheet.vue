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
 *   ?gallery=1        — read card IDs from sessionStorage key
 *                       `gallery-print-ids` (set by GalleryView.openPrint).
 *   ?qty=one-each     — print exactly 1 of each card; default repeats by deck count.
 *   ?paper=super-b    — paper size; default "letter".
 *   ?orientation=…    — "portrait" (default) or "landscape".
 *   ?exclude=a,b      — comma-separated category exclusions
 *                       (pokemon|supporters|items|tools|stadiums).
 *   ?noBasicEnergy=1  — drop basic energies (Energy cards with no effect).
 *   ?auto=1           — fire window.print() automatically after fonts settle.
 */
import { ref, computed, onMounted } from "vue";
import { api, ApiError } from "../lib/client.js";
import type { Card, CardDetail } from "../../shared/types/card.js";
import {
  gridForPaper,
  CARD_W_IN,
  CARD_H_IN,
  type PrintPaper,
  type PrintOrientation,
} from "../../shared/utils/print-grid.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import CssCardRenderer from "../components/CssCardRenderer.vue";

interface PrintEntry {
  card: Card;
  detail?: CardDetail;
  artUrl: string;
}

const CARD_W = 750;
const CARD_H = 1050;
const CSS_PX_PER_IN = 96;
const PRINT_SCALE = (CARD_W_IN * CSS_PX_PER_IN) / CARD_W;

const params = new URLSearchParams(window.location.search);
const deckId = params.get("deckId");
const isGallery = params.get("gallery") === "1";
const qtyOneEach = params.get("qty") === "one-each";
const paper: PrintPaper = params.get("paper") === "super-b" ? "super-b" : "letter";
const orientation: PrintOrientation =
  params.get("orientation") === "landscape" ? "landscape" : "portrait";
const excludeSet = new Set(
  (params.get("exclude") || "").split(",").filter(Boolean),
);
const noBasicEnergy = params.get("noBasicEnergy") === "1";
const useOriginalArt = params.get("art") === "original";
const autoPrint = params.get("auto") === "1";

const grid = computed(() => gridForPaper(paper, orientation));

const entries = ref<PrintEntry[]>([]);
const error = ref("");
const ready = ref(false);

/**
 * Pick the art URL for a print slot. With `art=original`, use the full TCGdex
 * card scan (printed as a plain image — no CSS chrome). Otherwise prefer the
 * cached `clean` PNG (no SVG chrome baked in), falling back to original if no
 * clean exists so a fresh deck still prints something.
 */
async function resolveArtUrl(card: Card): Promise<string> {
  if (useOriginalArt) {
    return cardImageUrl(card.imageBase, "high") || "";
  }
  try {
    const status = await api.pokeproxyStatus(card.id);
    if (status.hasClean || status.hasComposite) {
      return api.pokeproxyImageUrl(card.id, "clean");
    }
  } catch {
    // Status endpoint is best-effort; fall through to the original art.
  }
  return cardImageUrl(card.imageBase, "high") || "";
}

function shouldInclude(card: Card, detail: CardDetail | undefined): boolean {
  if (excludeSet.has("pokemon") && card.category === "Pokemon") return false;
  if (card.category === "Trainer" && card.trainerType) {
    const key = card.trainerType.toLowerCase() + "s";
    if (excludeSet.has(key)) return false;
  }
  if (noBasicEnergy && card.category === "Energy" && !detail?.effect) return false;
  return true;
}

async function buildEntry(card: Card, count: number): Promise<PrintEntry[]> {
  let detail: CardDetail | undefined;
  try {
    detail = await api.getCardDetail(card.id);
  } catch {
    detail = undefined;
  }
  if (!shouldInclude(card, detail)) return [];
  const artUrl = await resolveArtUrl(card);
  const repeats = qtyOneEach ? 1 : Math.max(1, count);
  const out: PrintEntry[] = [];
  for (let i = 0; i < repeats; i++) out.push({ card, detail, artUrl });
  return out;
}

async function loadDeck(id: string): Promise<void> {
  let deck;
  try {
    deck = await api.getDeck(id);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403 || e.status === 404)) {
      // Try the public endpoint so anonymous users can print shared decks.
      deck = await api.getPublicDeck(id);
    } else {
      throw e;
    }
  }
  const out: PrintEntry[] = [];
  for (const dc of deck.cards) {
    const card = dc.artCard ?? dc.card;
    const built = await buildEntry(card, dc.count);
    out.push(...built);
  }
  entries.value = out;
}

async function loadGallery(): Promise<void> {
  const raw = sessionStorage.getItem("gallery-print-ids");
  if (!raw) {
    error.value = "No gallery selection found (open Print from the Gallery again).";
    return;
  }
  let ids: string[];
  try {
    ids = JSON.parse(raw);
  } catch {
    error.value = "Could not parse gallery selection.";
    return;
  }
  const out: PrintEntry[] = [];
  for (const id of ids) {
    try {
      const card = await api.getCard(id);
      const built = await buildEntry(card, 1);
      out.push(...built);
    } catch {
      // Skip cards the server can't resolve; keep building the sheet.
    }
  }
  entries.value = out;
}

onMounted(async () => {
  installPageRule();
  try {
    if (deckId) {
      await loadDeck(deckId);
    } else if (isGallery) {
      await loadGallery();
    } else {
      error.value = "No deckId or gallery=1 parameter supplied.";
      return;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    return;
  }
  // Block render until fonts settle. Print snapshots would otherwise use
  // fallback metrics and produce wrong glyph widths.
  await document.fonts.ready;
  ready.value = true;
  if (autoPrint && entries.value.length > 0) {
    // Two frames after layout so the print sheet is fully committed to the DOM.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => window.print()),
    );
  }
});

const printScalerStyle = {
  transform: `scale(${PRINT_SCALE})`,
  transformOrigin: "top left",
};

// @page is set imperatively because the size depends on URL params and Vue's
// template <style> blocks are static. Inject one rule into <head> at mount.
function installPageRule() {
  const size = paper === "super-b" ? "13in 19in" : "letter";
  const style = document.createElement("style");
  style.textContent = `@page { size: ${size} ${orientation}; margin: 0.25in; }`;
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
    <section v-else class="print-sheet" :style="{
      'grid-template-columns': `repeat(${grid.cols}, ${CARD_W_IN}in)`,
      'grid-auto-rows': `${CARD_H_IN}in`,
    }">
      <div
        v-for="(e, i) in entries"
        :key="`${e.card.id}-${i}`"
        class="print-cell"
      >
        <!-- Originals print as the plain full-card scan; no CSS chrome overlay. -->
        <img v-if="useOriginalArt" class="print-original" :src="e.artUrl" alt="" />
        <div v-else class="print-scaler" :style="printScalerStyle">
          <CssCardRenderer
            :card="e.card"
            :detail="e.detail"
            :art-url="e.artUrl"
          />
        </div>
      </div>
    </section>
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
  padding: 24px;
}

.status {
  margin: 64px auto;
  font-size: 14px;
  color: #a0a0a8;
}
.status-error { color: #e57373; }

.print-sheet {
  display: grid;
  justify-content: start;
  align-content: start;
  background: white;
  box-shadow: 0 2px 24px rgba(0, 0, 0, 0.4);
}

.print-cell {
  width: 2.5in;
  height: 3.5in;
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

@media print {
  .print-page {
    padding: 0;
    min-height: 0;
  }
  .print-sheet {
    box-shadow: none;
  }
  .print-cell :deep(.card) {
    box-shadow: none;
  }
}
</style>
