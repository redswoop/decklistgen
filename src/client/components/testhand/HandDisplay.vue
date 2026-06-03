<script setup lang="ts">
// The interactive opening hand: a row of clickable card tiles plus the turn /
// count / mulligan meta line. Clicking a tile asks the parent to zoom it.
// Styling: global .thp-* rules in styles/testhand.css.
import type { Card } from "../../../shared/types/card.js";
import { imgFor } from "../../lib/hand-display.js";

defineProps<{
  hand: Card[];
  turn: number;
  mulliganCount: number;
  wasMulligan: boolean;
}>();

const emit = defineEmits<{ zoom: [index: number] }>();
</script>

<template>
  <section class="thp-hand-section">
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
        @click="emit('zoom', i)"
      >
        <img v-if="card.imageBase" :src="imgFor(card)" :alt="card.name" loading="lazy" />
        <span v-else class="thp-card-fallback">{{ card.name }}</span>
        <span class="thp-card-zoom" aria-hidden="true">⤢</span>
      </button>
    </div>
  </section>
</template>
