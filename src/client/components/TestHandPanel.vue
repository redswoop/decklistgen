<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from "vue";
import { useHandTester } from "../composables/useHandTester.js";
import { runMonteCarlo, type SimResult } from "../../shared/utils/hand-sim.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import type { Card } from "../../shared/types/card.js";

const TURNS = 5;
const ITERATIONS = 10000;

const {
  hand, rest, turn, mulliganCount, wasMulligan, playOrder,
  deckCards, deckSize, isEmpty, isComplete, handDrawn,
  newHand, mulligan, drawNext, setOrder, HAND_SIZE,
} = useHandTester();

// --- Stats dashboard (debounced so live count-tuning doesn't jank) ---
const stats = ref<SimResult | null>(null);
let debounce: ReturnType<typeof setTimeout> | null = null;

function recompute() {
  if (deckSize.value === 0) {
    stats.value = null;
    return;
  }
  stats.value = runMonteCarlo({
    deck: deckCards.value,
    iterations: ITERATIONS,
    turns: TURNS,
    order: playOrder.value,
  });
}

watch([deckCards, playOrder], () => {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(recompute, 150);
});

onMounted(() => {
  recompute();
  if (!handDrawn.value && !isEmpty.value) newHand();
  window.addEventListener("keydown", onZoomKey);
});

onUnmounted(() => {
  if (debounce) clearTimeout(debounce);
  window.removeEventListener("keydown", onZoomKey);
});

// --- Display helpers ---
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const imgFor = (card: Card) => cardImageUrl(card.imageBase, "low");
const zoomImgFor = (card: Card) => cardImageUrl(card.imageBase, "high");

// --- Click-to-zoom overlay ---
const zoomIndex = ref<number | null>(null);
const zoomCard = computed(() =>
  zoomIndex.value !== null ? hand.value[zoomIndex.value] ?? null : null,
);

function openZoom(i: number) {
  zoomIndex.value = i;
}
function closeZoom() {
  zoomIndex.value = null;
}
function zoomStep(delta: number) {
  if (zoomIndex.value === null || hand.value.length === 0) return;
  const n = hand.value.length;
  zoomIndex.value = (zoomIndex.value + delta + n) % n;
}

function onZoomKey(e: KeyboardEvent) {
  if (zoomIndex.value === null) return;
  if (e.key === "Escape") closeZoom();
  else if (e.key === "ArrowRight") zoomStep(1);
  else if (e.key === "ArrowLeft") zoomStep(-1);
}

const turnHeaders = computed(() => Array.from({ length: TURNS }, (_, i) => i + 1));
const topByCard = computed(() => (stats.value ? stats.value.byCard.slice(0, 14) : []));
const categories = computed(() =>
  stats.value ? Object.entries(stats.value.byCategory) : [],
);

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

      <!-- Going first vs second -->
      <div class="thp-order" role="group" aria-label="Play order">
        <button
          :class="['thp-seg', { active: playOrder === 'first' }]"
          @click="setOrder('first')"
        >Going 1st</button>
        <button
          :class="['thp-seg', { active: playOrder === 'second' }]"
          @click="setOrder('second')"
        >Going 2nd</button>
      </div>

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

    <!-- Interactive hand -->
    <section v-if="handDrawn" class="thp-hand-section">
      <div class="thp-hand-meta">
        <span class="thp-turn">Turn {{ turn }}</span>
        <span class="thp-handcount">{{ hand.length }} cards</span>
        <span v-if="mulliganCount > 0" class="thp-mullcount">{{ mulliganCount }} mulligan{{ mulliganCount === 1 ? '' : 's' }}</span>
        <span v-if="wasMulligan" class="thp-mulligan-flag">MULLIGAN — no Basic Pokémon</span>
      </div>
      <div class="thp-hand">
        <button
          v-for="(card, i) in hand"
          :key="i"
          class="thp-card"
          :title="`${card.name} — click to zoom`"
          @click="openZoom(i)"
        >
          <img v-if="card.imageBase" :src="imgFor(card)" :alt="card.name" loading="lazy" />
          <span v-else class="thp-card-fallback">{{ card.name }}</span>
          <span class="thp-card-zoom" aria-hidden="true">⤢</span>
        </button>
      </div>
    </section>

    <!-- Stats dashboard -->
    <section v-if="stats" class="thp-stats">
      <div class="thp-kpis">
        <div class="thp-kpi">
          <span class="thp-kpi-val">{{ pct(stats.oddsBasic) }}</span>
          <span class="thp-kpi-label">Open with ≥1 Basic</span>
        </div>
        <div class="thp-kpi">
          <span class="thp-kpi-val">{{ pct(stats.mulliganRate) }}</span>
          <span class="thp-kpi-label">Mulligan rate</span>
        </div>
        <div class="thp-kpi">
          <span class="thp-kpi-val">{{ pct(stats.oddsBasicAndSupporter) }}</span>
          <span class="thp-kpi-label">Open Basic + Supporter</span>
        </div>
        <div class="thp-kpi">
          <span class="thp-kpi-val">{{ pct(stats.noSupporterOrItemRate) }}</span>
          <span class="thp-kpi-label" title="Kept hands with a Basic but no Supporter and no Item. Ignores Stadium/Tool and attacker viability.">No Supporter or Item</span>
        </div>
      </div>

      <h3 class="thp-subhead">Odds of seeing by turn ({{ playOrder === 'second' ? 'going 2nd' : 'going 1st' }})</h3>
      <table class="thp-table">
        <thead>
          <tr>
            <th class="thp-th-name">Card</th>
            <th class="thp-th-n">#</th>
            <th v-for="t in turnHeaders" :key="t">T{{ t }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(cat, label) in Object.fromEntries(categories)" :key="'cat-' + label" class="thp-cat-row">
            <td class="thp-td-name">{{ label }}</td>
            <td class="thp-td-n"></td>
            <td v-for="(p, i) in cat" :key="i">{{ pct(p) }}</td>
          </tr>
          <tr v-for="c in topByCard" :key="c.cardId">
            <td class="thp-td-name" :title="c.name">{{ c.name }}</td>
            <td class="thp-td-n">{{ c.copies }}</td>
            <td v-for="(p, i) in c.byTurn" :key="i">{{ pct(p) }}</td>
          </tr>
        </tbody>
      </table>
      <p class="thp-fineprint">
        By-turn odds are exact (hypergeometric) from a single shuffle. Mulligan &amp; opening-hand
        rates are simulated over {{ stats.iterations.toLocaleString() }} hands.
      </p>
    </section>

    <!-- Click-to-zoom overlay -->
    <Teleport to="body">
      <div v-if="zoomCard" class="thp-zoom-backdrop" @click="closeZoom">
        <button class="thp-zoom-nav prev" title="Previous card (←)" @click.stop="zoomStep(-1)">‹</button>
        <div class="thp-zoom-stage" @click.stop>
          <img
            v-if="zoomCard.imageBase"
            :src="zoomImgFor(zoomCard)"
            :alt="zoomCard.name"
            class="thp-zoom-img"
          />
          <div v-else class="thp-zoom-fallback">{{ zoomCard.name }}</div>
          <div class="thp-zoom-caption">
            {{ zoomCard.name }}
            <span class="thp-zoom-pos">{{ (zoomIndex ?? 0) + 1 }} / {{ hand.length }}</span>
          </div>
        </div>
        <button class="thp-zoom-nav next" title="Next card (→)" @click.stop="zoomStep(1)">›</button>
        <button class="thp-zoom-close" title="Close (Esc)" @click.stop="closeZoom">×</button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.thp {
  flex: 1;
  min-height: 0;
  padding: 1rem 1.25rem;
  overflow-y: auto;
  color: #e0e0e0;
}

.thp-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  margin-bottom: 0.75rem;
}
.thp-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin-right: auto;
}

.thp-order {
  display: inline-flex;
  border: 1px solid #0f3460;
  border-radius: 6px;
  overflow: hidden;
}
.thp-seg {
  padding: 0.4rem 0.8rem;
  background: #16213e;
  color: #b0b0c0;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
}
.thp-seg.active {
  background: #e94560;
  color: #fff;
}

.thp-controls {
  display: flex;
  gap: 0.5rem;
}
.thp-btn {
  padding: 0.45rem 0.9rem;
  background: #0f3460;
  color: #e0e0e0;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: filter 0.15s;
}
.thp-btn.primary {
  background: #e94560;
  color: #fff;
}
.thp-btn:hover:not(:disabled) {
  filter: brightness(1.15);
}
.thp-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.thp-note {
  font-size: 0.85rem;
  color: #b0b0c0;
  margin-bottom: 0.5rem;
}
.thp-note.warn { color: #d29922; }
.thp-note.danger { color: #e94560; }

.thp-hand-section {
  margin: 0.5rem 0 1.25rem;
}
.thp-hand-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
  color: #b0b0c0;
}
.thp-turn { font-weight: 600; color: #e0e0e0; }
.thp-mulligan-flag {
  color: #fff;
  background: #e94560;
  padding: 0.1rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
}
.thp-hand {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.thp-card {
  position: relative;
  width: 96px;
  aspect-ratio: 2.5 / 3.5;
  border-radius: 6px;
  overflow: hidden;
  background: #16213e;
  border: 1px solid #0f3460;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-in;
  transition: transform 0.12s, border-color 0.12s;
}
.thp-card:hover {
  transform: translateY(-3px);
  border-color: #e94560;
}
.thp-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.thp-card-zoom {
  position: absolute;
  top: 3px;
  right: 4px;
  font-size: 0.7rem;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 4px;
  background: rgba(15, 52, 96, 0.85);
  color: #fff;
  opacity: 0;
  transition: opacity 0.12s;
}
.thp-card:hover .thp-card-zoom {
  opacity: 1;
}

/* Zoom overlay */
.thp-zoom-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}
.thp-zoom-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  max-height: 92vh;
}
.thp-zoom-img {
  max-height: 82vh;
  max-width: 80vw;
  border-radius: 14px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
}
.thp-zoom-fallback {
  width: 320px;
  aspect-ratio: 2.5 / 3.5;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #16213e;
  border: 1px solid #0f3460;
  border-radius: 14px;
  color: #b0b0c0;
  padding: 1rem;
  text-align: center;
}
.thp-zoom-caption {
  color: #fff;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.thp-zoom-pos {
  color: #b0b0c0;
  font-size: 0.82rem;
}
.thp-zoom-nav,
.thp-zoom-close {
  background: rgba(22, 33, 62, 0.9);
  color: #fff;
  border: 1px solid #0f3460;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.thp-zoom-nav {
  width: 48px;
  height: 48px;
  font-size: 2rem;
}
.thp-zoom-nav:hover,
.thp-zoom-close:hover {
  background: #e94560;
}
.thp-zoom-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 40px;
  height: 40px;
  font-size: 1.5rem;
}
.thp-card-fallback {
  font-size: 0.7rem;
  text-align: center;
  padding: 0.25rem;
  color: #b0b0c0;
}

.thp-stats { margin-top: 0.5rem; }
.thp-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.6rem;
  margin-bottom: 1rem;
}
.thp-kpi {
  background: #16213e;
  border: 1px solid #0f3460;
  border-radius: 8px;
  padding: 0.7rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.thp-kpi-val {
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff;
}
.thp-kpi-label {
  font-size: 0.78rem;
  color: #b0b0c0;
}

.thp-subhead {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0.5rem 0;
}
.thp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}
.thp-table th,
.thp-table td {
  padding: 0.3rem 0.5rem;
  text-align: right;
  border-bottom: 1px solid #0f3460;
  white-space: nowrap;
}
.thp-th-name, .thp-td-name {
  text-align: left;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.thp-th-n, .thp-td-n { text-align: center; color: #b0b0c0; }
.thp-cat-row {
  color: #f0c674;
  font-weight: 600;
}
.thp-cat-row td { border-bottom: 1px solid #20407a; }
.thp-fineprint {
  margin-top: 0.6rem;
  font-size: 0.72rem;
  color: #8a8aa0;
}
</style>
