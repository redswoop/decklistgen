<script setup lang="ts">
/**
 * Jumbo print pair-picker. Opened from the lightbox's "Print Jumbo" button.
 * Card 1 is the card you're viewing; Card 2 is optional — search ANY card (not
 * just the deck) or pick a recent one. With two cards it prints 2-up landscape;
 * with one it prints 1-up portrait. Each card carries its own version (Original /
 * Cleaned / Proxy) which rides along to the print sheet as a per-card `art` list.
 *
 * Thin controller: the slots are JumboCardSlot, the search is PrintCardSearch +
 * usePrintCardSearch, and the URL grammar is buildJumboPrintUrl (print-params).
 */
import { ref, computed, watch } from "vue";
import type { Card } from "../../shared/types/card.js";
import type { ArtMode } from "../../shared/utils/print-params.js";
import { buildJumboPrintUrl } from "../../shared/utils/print-params.js";
import { usePokeproxyBatch } from "../composables/usePokeproxy.js";
import { usePrintCardSearch } from "../composables/usePrintCardSearch.js";
import JumboCardSlot from "./print/JumboCardSlot.vue";
import PrintCardSearch from "./print/PrintCardSearch.vue";

const props = defineProps<{
  currentCard: Card;
  version: ArtMode;
  /** Cards already in view (browse/deck list) offered as quick "recent" picks. */
  recentCards: Card[];
}>();

const emit = defineEmits<{ close: [] }>();

const secondCard = ref<Card | null>(null);
const layout = ref<"two-up" | "one-up">("one-up");

// Per-card print version. Card 1 inherits the lightbox's selection; card 2
// defaults to the same and is editable independently.
const version1 = ref<ArtMode>(props.version);
const version2 = ref<ArtMode>(props.version);

// Picking a second card implies pairing; clearing falls back to single-card
// portrait. The user can still override the radio after.
watch(secondCard, (v) => {
  layout.value = v ? "two-up" : "one-up";
});

const currentId = computed(() => props.currentCard.id);
const { query, results, searching } = usePrintCardSearch(currentId);

// Recent quick-picks: the in-view cards minus the current one (and the chosen
// second card, so it doesn't appear twice). Capped to keep the dialog compact.
const recentPicks = computed(() =>
  props.recentCards
    .filter((c) => c.id !== props.currentCard.id && c.id !== secondCard.value?.id)
    .slice(0, 8),
);

// Batch-fetch pokeproxy status for every card whose preview we might render, so
// the Cleaned/Proxy previews resolve to real cleaned art instead of a fallback.
const statusIds = computed(() => {
  const ids = new Set<string>([props.currentCard.id]);
  if (secondCard.value) ids.add(secondCard.value.id);
  for (const c of results.value) ids.add(c.id);
  for (const c of recentPicks.value) ids.add(c.id);
  return [...ids];
});
usePokeproxyBatch(statusIds);

function pickSecond(card: Card) {
  secondCard.value = secondCard.value?.id === card.id ? null : card;
}

function clearSecond() {
  secondCard.value = null;
}

function handlePrint() {
  const ids = [props.currentCard.id];
  const arts: ArtMode[] = [version1.value];
  if (secondCard.value) {
    ids.push(secondCard.value.id);
    arts.push(version2.value);
  }
  window.open(buildJumboPrintUrl({ ids, arts, layout: layout.value }), "_blank");
  emit("close");
}
</script>

<template>
  <div class="dialog-overlay" @click="emit('close')">
    <div class="dialog jumbo-dialog" @click.stop>
      <h3>Print Jumbo</h3>
      <p class="jumbo-sub">
        Oversized promo size, 132 × 185 mm. Add a second card to print two
        side-by-side on one landscape sheet. Each card prints in its own version.
      </p>

      <div class="jumbo-slots">
        <JumboCardSlot
          :card="currentCard"
          v-model:version="version1"
          label="Card 1"
          sublabel="(current)"
        />
        <JumboCardSlot
          :card="secondCard"
          v-model:version="version2"
          label="Card 2"
          sublabel="(optional)"
          clearable
          @clear="clearSecond"
        />
      </div>

      <PrintCardSearch
        v-if="!secondCard"
        v-model:query="query"
        :searching="searching"
        :results="results"
        :recent-picks="recentPicks"
        @pick="pickSecond"
      />

      <div class="jumbo-section-label">Layout</div>
      <div class="jumbo-radio-group">
        <label class="jumbo-radio">
          <input type="radio" v-model="layout" value="two-up" :disabled="!secondCard" />
          Two per page (landscape)
        </label>
        <label class="jumbo-radio">
          <input type="radio" v-model="layout" value="one-up" />
          One per page (portrait)
        </label>
      </div>

      <div class="dialog-actions">
        <button class="btn-secondary" @click="emit('close')">Cancel</button>
        <button class="btn-primary" @click="handlePrint">Print</button>
      </div>
    </div>
  </div>
</template>
