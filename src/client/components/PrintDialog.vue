<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from "vue";
import { gridForPaper } from "../../shared/utils/print-grid.js";
import {
  countPrintCards,
  summarizePrint,
  type PrintCountEntry,
} from "../../shared/utils/print-summary.js";
import { api, ApiError } from "../lib/client.js";

const props = defineProps<{
  deckId: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const STORAGE_KEY = "print-options-v1";

type StoredOptions = {
  quantityMode: "all-dupes" | "one-each";
  artwork: "proxy" | "original";
  paper: "letter" | "super-b";
  orientation: "portrait" | "landscape";
  includePokemon: boolean;
  includeSupporters: boolean;
  includeItems: boolean;
  includeTools: boolean;
  includeStadiums: boolean;
  includeBasicEnergy: boolean;
  includeSpecialEnergy: boolean;
  cropMarks: boolean;
};

function loadStored(): Partial<StoredOptions> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const stored = loadStored();

const quantityMode = ref<"all-dupes" | "one-each">(stored.quantityMode ?? "all-dupes");
const artwork = ref<"proxy" | "original">(stored.artwork ?? "proxy");
const paper = ref<"letter" | "super-b">(stored.paper ?? "letter");
const orientation = ref<"portrait" | "landscape">(stored.orientation ?? "portrait");
const includePokemon = ref(stored.includePokemon ?? true);
const includeSupporters = ref(stored.includeSupporters ?? true);
const includeItems = ref(stored.includeItems ?? true);
const includeTools = ref(stored.includeTools ?? true);
const includeStadiums = ref(stored.includeStadiums ?? true);
const includeBasicEnergy = ref(stored.includeBasicEnergy ?? true);
const includeSpecialEnergy = ref(stored.includeSpecialEnergy ?? true);
const cropMarks = ref(stored.cropMarks ?? true);

watchEffect(() => {
  const opts: StoredOptions = {
    quantityMode: quantityMode.value,
    artwork: artwork.value,
    paper: paper.value,
    orientation: orientation.value,
    includePokemon: includePokemon.value,
    includeSupporters: includeSupporters.value,
    includeItems: includeItems.value,
    includeTools: includeTools.value,
    includeStadiums: includeStadiums.value,
    includeBasicEnergy: includeBasicEnergy.value,
    includeSpecialEnergy: includeSpecialEnergy.value,
    cropMarks: cropMarks.value,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
  } catch {}
});

const cardsPerSheet = computed(() => gridForPaper(paper.value, orientation.value).cardsPerSheet);

// Category toggles → exclusion keys understood by `shouldPrintCard`. Shared by
// the print URL and the live card-count preview so they can't disagree.
const excludeKeys = computed(() => {
  const ex: string[] = [];
  if (!includePokemon.value) ex.push("pokemon");
  if (!includeSupporters.value) ex.push("supporters");
  if (!includeItems.value) ex.push("items");
  if (!includeTools.value) ex.push("tools");
  if (!includeStadiums.value) ex.push("stadiums");
  if (!includeSpecialEnergy.value) ex.push("specialenergy");
  return ex;
});

// Deck cards loaded for the count preview. Energy cards carry their detail so
// special vs basic energy can be told apart (matches PrintSheet's buildEntry).
const deckEntries = ref<PrintCountEntry[]>([]);
const loadingCount = ref(true);

onMounted(async () => {
  try {
    let deck;
    try {
      deck = await api.getDeck(props.deckId);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403 || e.status === 404)) {
        deck = await api.getPublicDeck(props.deckId);
      } else {
        throw e;
      }
    }
    const out: PrintCountEntry[] = [];
    for (const dc of deck.cards) {
      const card = dc.artCard ?? dc.card;
      let detail;
      if (card.category === "Energy") {
        try {
          detail = await api.getCardDetail(card.id);
        } catch {
          detail = undefined;
        }
      }
      out.push({ card, detail, count: dc.count });
    }
    deckEntries.value = out;
  } catch {
    deckEntries.value = [];
  } finally {
    loadingCount.value = false;
  }
});

const printCount = computed(() =>
  countPrintCards(
    deckEntries.value,
    { exclude: new Set(excludeKeys.value), noBasicEnergy: !includeBasicEnergy.value },
    quantityMode.value === "one-each",
  ),
);

const summary = computed(() => summarizePrint(printCount.value, cardsPerSheet.value));

function handlePrint() {
  const params = new URLSearchParams();
  params.set("deckId", props.deckId);
  params.set("auto", "1");

  if (quantityMode.value === "one-each") params.set("qty", "one-each");
  if (artwork.value === "original") params.set("art", "original");
  if (paper.value !== "letter") params.set("paper", paper.value);
  if (orientation.value !== "portrait") params.set("orientation", orientation.value);
  if (!includeBasicEnergy.value) params.set("noBasicEnergy", "1");
  if (!cropMarks.value) params.set("crop", "0");

  const excluded = excludeKeys.value;
  if (excluded.length) params.set("exclude", excluded.join(","));

  window.open(`/print.html?${params.toString()}`, "_blank");
}
</script>

<template>
  <div class="dialog-overlay" @click="emit('close')">
    <div class="dialog print-dialog" @click.stop>
      <h3>Print Options</h3>

      <div v-if="!loadingCount && summary.incomplete" class="print-warn-banner">
        ⚠ Incomplete sheet — last sheet has
        {{ summary.emptySlots }} empty slot{{ summary.emptySlots === 1 ? "" : "s" }}
      </div>

      <div class="print-section-label">Quantity</div>
      <div class="print-radio-group">
        <label class="print-radio">
          <input type="radio" v-model="quantityMode" value="all-dupes" />
          All copies
        </label>
        <label class="print-radio">
          <input type="radio" v-model="quantityMode" value="one-each" />
          1 of each
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
      <div class="print-radio-group">
        <label class="print-radio">
          <input type="radio" v-model="paper" value="letter" />
          Letter (8.5 × 11)
        </label>
        <label class="print-radio">
          <input type="radio" v-model="paper" value="super-b" />
          Super-B (13 × 19)
        </label>
      </div>

      <div class="print-section-label">Orientation <span class="print-section-hint">— {{ cardsPerSheet }} cards/sheet</span></div>
      <div class="print-radio-group">
        <label class="print-radio">
          <input type="radio" v-model="orientation" value="portrait" />
          Portrait
        </label>
        <label class="print-radio">
          <input type="radio" v-model="orientation" value="landscape" />
          Landscape
        </label>
      </div>

      <div class="print-section-label">Cut guides</div>
      <div class="print-checkbox-list">
        <label class="print-checkbox">
          <input type="checkbox" v-model="cropMarks" />
          Crop marks
        </label>
      </div>

      <div class="print-section-label">Include</div>
      <div class="print-checkbox-list">
        <label class="print-checkbox">
          <input type="checkbox" v-model="includePokemon" />
          Pokemon
        </label>
        <label class="print-checkbox">
          <input type="checkbox" v-model="includeSupporters" />
          Supporters
        </label>
        <label class="print-checkbox">
          <input type="checkbox" v-model="includeItems" />
          Items
        </label>
        <label class="print-checkbox">
          <input type="checkbox" v-model="includeTools" />
          Tools
        </label>
        <label class="print-checkbox">
          <input type="checkbox" v-model="includeStadiums" />
          Stadiums
        </label>
        <label class="print-checkbox">
          <input type="checkbox" v-model="includeBasicEnergy" />
          Basic Energy
        </label>
        <label class="print-checkbox">
          <input type="checkbox" v-model="includeSpecialEnergy" />
          Special Energy
        </label>
      </div>

      <div class="print-summary">
        <template v-if="loadingCount">
          <span class="print-summary-muted">Calculating…</span>
        </template>
        <template v-else-if="summary.cardCount === 0">
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
        <button class="btn-primary" @click="handlePrint">Print</button>
      </div>
    </div>
  </div>
</template>
