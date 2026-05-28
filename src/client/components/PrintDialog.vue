<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import { api } from "../lib/client.js";
import { gridForPaper } from "../../shared/utils/print-grid.js";

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
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
  } catch {}
});

const cardsPerSheet = computed(() => gridForPaper(paper.value, orientation.value).cardsPerSheet);

function handlePrint() {
  const params: Record<string, string> = {};

  if (quantityMode.value === "one-each") {
    params.qty = "one-each";
  }
  if (artwork.value === "original") {
    params.art = "original";
  }
  if (paper.value !== "letter") {
    params.paper = paper.value;
  }
  if (orientation.value !== "portrait") {
    params.orientation = orientation.value;
  }
  if (!includeBasicEnergy.value) {
    params.noBasicEnergy = "1";
  }

  const excluded: string[] = [];
  if (!includePokemon.value) excluded.push("pokemon");
  if (!includeSupporters.value) excluded.push("supporters");
  if (!includeItems.value) excluded.push("items");
  if (!includeTools.value) excluded.push("tools");
  if (!includeStadiums.value) excluded.push("stadiums");
  if (excluded.length) {
    params.exclude = excluded.join(",");
  }

  window.open(api.deckPrintUrl(props.deckId, params), "_blank");
}
</script>

<template>
  <div class="dialog-overlay" @click="emit('close')">
    <div class="dialog print-dialog" @click.stop>
      <h3>Print Options</h3>

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
      </div>

      <div class="dialog-actions">
        <button class="btn-secondary" @click="emit('close')">Cancel</button>
        <button class="btn-primary" @click="handlePrint">Print</button>
      </div>
    </div>
  </div>
</template>
