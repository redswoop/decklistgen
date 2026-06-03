<script setup lang="ts">
// Monte-Carlo stats dashboard: opening-hand KPIs and a per-card / per-category
// "odds of seeing by turn N" table. Derives its view rows from the SimResult.
// Styling: global .thp-* rules in styles/testhand.css.
import { computed } from "vue";
import type { SimResult, PlayOrder } from "../../../shared/utils/hand-sim.js";
import { pct } from "../../lib/hand-display.js";

const props = defineProps<{
  stats: SimResult;
  playOrder: PlayOrder;
  turns: number;
}>();

const turnHeaders = computed(() => Array.from({ length: props.turns }, (_, i) => i + 1));
const topByCard = computed(() => props.stats.byCard.slice(0, 14));
const categories = computed(() => Object.entries(props.stats.byCategory));
</script>

<template>
  <section class="thp-stats">
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
</template>
