<script setup lang="ts">
import { computed } from "vue";
import { useSetupSim, type SetupRow } from "../composables/useSetupSim.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";

const {
  order, deckSize, isEmpty, isComplete,
  warnings, rows, isLoading, setOrder, reroll, TURNS,
} = useSetupSim();

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const pctCI = (x: number) => {
  const v = x * 100;
  return v < 1 ? v.toFixed(1) : v.toFixed(0);
};
const turnHeaders = computed(() => Array.from({ length: TURNS }, (_, i) => i + 1));
const avgLabel = (r: SetupRow) => (r.result.avgSetupTurn > 0 ? `T${r.result.avgSetupTurn.toFixed(1)}` : "—");
const imgFor = (r: SetupRow) =>
  r.line.finalCard.imageBase ? cardImageUrl(r.line.finalCard.imageBase, "low") : "";

function kindLabel(r: SetupRow): string {
  const base = r.line.finalStage === "Stage2" ? "Stage 2" : r.line.finalStage === "Stage1" ? "Stage 1" : "Basic";
  return r.line.isExLine ? `${base} · ex / V` : base;
}

// Group rows by kind, preserving the kind-sorted order from buildEvolutionLines.
const groups = computed(() => {
  const out: Array<{ kind: string; rows: SetupRow[] }> = [];
  for (const r of rows.value) {
    const kind = kindLabel(r);
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.rows.push(r);
    else out.push({ kind, rows: [r] });
  }
  return out;
});
</script>

<template>
  <div class="ssp">
    <header class="ssp-header">
      <h2 class="ssp-title">Setup Simulator</h2>
      <div class="ssp-order" role="group" aria-label="Play order">
        <button :class="['ssp-seg', { active: order === 'first' }]" @click="setOrder('first')">Going 1st</button>
        <button :class="['ssp-seg', { active: order === 'second' }]" @click="setOrder('second')">Going 2nd</button>
      </div>
      <button class="ssp-btn" :disabled="isEmpty" :title="isEmpty ? 'Add cards first' : 'Re-roll with a new random seed'" @click="reroll">Re-roll</button>
    </header>

    <p class="ssp-sub">Odds each line's final stage is in play by turn N ({{ order === 'second' ? 'going 2nd' : 'going 1st' }}).</p>

    <!-- Notices -->
    <p v-if="isEmpty" class="ssp-note">Add cards to your deck to simulate setup speed.</p>
    <p v-else-if="isLoading" class="ssp-note">Loading card data…</p>
    <template v-else>
      <p v-if="!isComplete" class="ssp-note warn">
        Simulating with {{ deckSize }} cards — a legal deck is 60.
      </p>
      <p v-for="(w, i) in warnings" :key="i" class="ssp-note warn">{{ w.detail }}</p>
    </template>

    <!-- All lines, grouped by kind -->
    <table v-if="rows.length" class="ssp-table">
      <thead>
        <tr>
          <th class="ssp-th-name">Pokémon</th>
          <th v-for="t in turnHeaders" :key="t">T{{ t }}</th>
          <th>Avg</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="g in groups" :key="g.kind">
          <tr class="ssp-group"><td :colspan="TURNS + 2">{{ g.kind }}</td></tr>
          <tr v-for="r in g.rows" :key="r.line.id" class="ssp-row">
            <td class="ssp-td-name">
              <img v-if="imgFor(r)" :src="imgFor(r)" :alt="r.line.finalName" class="ssp-thumb" loading="lazy" />
              <span class="ssp-name">{{ r.line.finalName }}</span>
            </td>
            <template v-if="r.result.unsatisfiable">
              <td :colspan="TURNS" class="ssp-cant">can't be set up (missing a piece)</td>
              <td>—</td>
            </template>
            <template v-else>
              <td v-for="(p, i) in r.result.cumulativeSetup" :key="i" :class="{ 'ssp-final': i === TURNS - 1 }">
                {{ pct(p) }}<span class="ssp-ci">±{{ pctCI(r.result.cumulativeCI[i]) }}%</span>
              </td>
              <td class="ssp-avg">
                {{ avgLabel(r) }}<span v-if="r.result.avgSetupTurn > 0" class="ssp-ci">±{{ r.result.avgSetupTurnCI.toFixed(1) }}</span>
              </td>
            </template>
          </tr>
        </template>
      </tbody>
    </table>

    <p v-if="rows.length" class="ssp-fineprint">
      Monte Carlo over {{ rows[0].result.iterations.toLocaleString() }} games per line. A greedy bot draws, searches, and
      evolves (incl. Rare Candy) toward each line as fast as legal — 6 prizes set aside, evolution timing respected. It
      also sets up the deck's draw/search Ability engines (e.g. Bibarel, Genesect, Lunatone+Solrock). ± is the 95%
      confidence interval (sampling error); each line auto-tunes to ±1.5% (up to 12,000 games). Energy costs and opponent
      interaction aren't modeled, and the bot only sets up engine pieces it draws or Poffins, so a few ability-heavy decks
      may still read slightly low.
    </p>
  </div>
</template>

<style scoped>
.ssp {
  flex: 1;
  min-height: 0;
  padding: 1rem 1.25rem;
  overflow-y: auto;
  color: #e0e0e0;
}
.ssp-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  margin-bottom: 0.4rem;
}
.ssp-title { font-size: 1.2rem; font-weight: 600; margin-right: auto; }
.ssp-order { display: inline-flex; border: 1px solid #0f3460; border-radius: 6px; overflow: hidden; }
.ssp-seg { padding: 0.4rem 0.8rem; background: #16213e; color: #b0b0c0; border: none; cursor: pointer; font-size: 0.85rem; }
.ssp-seg.active { background: #e94560; color: #fff; }
.ssp-btn { padding: 0.45rem 0.9rem; background: #0f3460; color: #e0e0e0; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; transition: filter 0.15s; }
.ssp-btn:hover:not(:disabled) { filter: brightness(1.15); }
.ssp-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.ssp-sub { font-size: 0.82rem; color: #b0b0c0; margin-bottom: 0.6rem; }
.ssp-note { font-size: 0.85rem; color: #b0b0c0; margin-bottom: 0.4rem; }
.ssp-note.warn { color: #d29922; }

.ssp-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; max-width: 640px; }
.ssp-table th, .ssp-table td { padding: 0.35rem 0.6rem; text-align: right; border-bottom: 1px solid #0f3460; white-space: nowrap; }
.ssp-th-name, .ssp-td-name { text-align: left; }
.ssp-td-name { display: flex; align-items: center; gap: 0.5rem; }
.ssp-thumb { width: 30px; aspect-ratio: 2.5 / 3.5; object-fit: cover; border-radius: 3px; flex-shrink: 0; }
.ssp-name { overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
.ssp-group td { text-align: left; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; color: #f0c674; background: #16213e; border-bottom: 1px solid #20407a; padding-top: 0.45rem; }
.ssp-final { color: #fff; font-weight: 600; }
.ssp-avg { color: #f0c674; font-weight: 600; }
.ssp-ci { color: #6f7890; font-size: 0.72em; margin-left: 0.25em; }
.ssp-cant { text-align: center; color: #8a8aa0; font-style: italic; }
.ssp-fineprint { margin-top: 0.7rem; font-size: 0.72rem; color: #8a8aa0; max-width: 660px; }
</style>
