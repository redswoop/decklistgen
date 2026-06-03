<script setup lang="ts">
// Thin controller for the Test Hand panel. Composes:
//  - useHandTester    : the interactive deck/hand/draw state machine
//  - useTestHandStats : debounced Monte-Carlo dashboard stats
//  - useCardZoom      : click-to-zoom over the current hand
// and lays out the header + notices + HandDisplay + HandStats + zoom overlay.
// Styles live in styles/testhand.css (global, .thp- prefix).
import { computed, onMounted } from "vue";
import { useHandTester } from "../composables/useHandTester.js";
import { useTestHandStats } from "../composables/useTestHandStats.js";
import { useCardZoom } from "../composables/useCardZoom.js";
import PlayOrderSelector from "./testhand/PlayOrderSelector.vue";
import HandDisplay from "./testhand/HandDisplay.vue";
import HandStats from "./testhand/HandStats.vue";
import CardZoomOverlay from "./lightbox/CardZoomOverlay.vue";

const {
  hand, rest, turn, mulliganCount, wasMulligan, playOrder,
  deckCards, deckSize, isEmpty, isComplete, handDrawn,
  newHand, mulligan, drawNext, setOrder,
} = useHandTester();

const { stats, turns } = useTestHandStats(deckCards, playOrder);
const { zoomIndex, zoomCard, openZoom, closeZoom, zoomStep } = useCardZoom(hand);

onMounted(() => {
  if (!handDrawn.value && !isEmpty.value) newHand();
});

const drawNextTitle = computed(() => {
  if (isEmpty.value) return "Add cards to your deck first";
  if (!handDrawn.value) return "Draw an opening hand first";
  if (rest.value.length === 0) return "Deck is empty — no cards left to draw";
  return "Draw a card for the next turn";
});
const deckActionTitle = computed(() =>
  isEmpty.value ? "Add cards to your deck to test a hand" : "",
);
</script>

<template>
  <div class="thp">
    <header class="thp-header">
      <h2 class="thp-title">Test Hand</h2>

      <PlayOrderSelector :order="playOrder" @set="setOrder" />

      <div class="thp-controls">
        <button class="thp-btn primary" :disabled="isEmpty" :title="deckActionTitle" @click="newHand">New Hand</button>
        <button class="thp-btn" :disabled="isEmpty" :title="deckActionTitle" @click="mulligan">Mulligan</button>
        <button class="thp-btn" :disabled="isEmpty || !handDrawn || rest.length === 0" :title="drawNextTitle" @click="drawNext">Draw Next Turn</button>
      </div>
    </header>

    <!-- Notices -->
    <p v-if="isEmpty" class="thp-note">Add cards to your deck to test opening hands.</p>
    <p v-else-if="!isComplete" class="thp-note warn">
      Testing with {{ deckSize }} cards — a legal deck is 60. Numbers reflect the current {{ deckSize }}-card deck.
    </p>
    <p v-if="stats?.infiniteMulligan" class="thp-note danger">
      This deck has no Basic Pokémon — every hand is a mulligan.
    </p>

    <HandDisplay
      v-if="handDrawn"
      :hand="hand"
      :turn="turn"
      :mulligan-count="mulliganCount"
      :was-mulligan="wasMulligan"
      @zoom="openZoom"
    />

    <HandStats v-if="stats" :stats="stats" :play-order="playOrder" :turns="turns" />

    <CardZoomOverlay
      v-if="zoomCard"
      :card="zoomCard"
      :position="(zoomIndex ?? 0) + 1"
      :total="hand.length"
      @close="closeZoom"
      @prev="zoomStep(-1)"
      @next="zoomStep(1)"
    />
  </div>
</template>
