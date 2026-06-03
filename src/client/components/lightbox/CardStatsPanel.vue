<script setup lang="ts">
// Lightbox card stats: stage/evolve line, flavor text, abilities, attacks,
// trainer/energy effect, and weakness/resistance/retreat. Presentational; reads
// the current card + its detail. Styling uses the global .lb-* rules.
import type { Card, CardDetail } from "../../../shared/types/card.js";

defineProps<{
  card: Card;
  detail: CardDetail | undefined;
}>();

const ENERGY_COLORS: Record<string, string> = {
  Grass: "#439837", Fire: "#e4613e", Water: "#3099e1",
  Lightning: "#dfbc28", Psychic: "#e96c8c", Fighting: "#e49021",
  Darkness: "#4f4747", Metal: "#74b0cb", Fairy: "#e18ce1",
  Dragon: "#576fbc", Colorless: "#828282",
};

function energyColor(type: string): string {
  return ENERGY_COLORS[type] ?? "#828282";
}
</script>

<template>
  <!-- Card metadata -->
  <div v-if="card.category === 'Pokemon'" class="lb-card-meta-block">
    <div class="lb-stage-line">
      <span>{{ card.stage ?? 'Basic' }}</span>
      <template v-if="detail?.evolveFrom">
        <span class="meta-sep"> · </span>
        <span class="lb-evolve">Evolves from {{ detail.evolveFrom }}</span>
      </template>
      <template v-if="card.energyTypes?.length">
        <span class="meta-sep"> · </span>
        <span v-for="t in card.energyTypes" :key="t"
          class="lb-energy-dot"
          :style="{ background: energyColor(t) }"
          :title="t"
        ></span>
      </template>
    </div>
  </div>

  <!-- Description (flavor text) -->
  <p v-if="detail?.description" class="lb-description">
    {{ detail.description }}
  </p>

  <!-- Abilities -->
  <div v-if="detail?.abilities?.length" class="lb-section">
    <div v-for="ab in detail.abilities" :key="ab.name" class="lb-ability">
      <div class="lb-ability-header">
        <span class="lb-ability-type">{{ ab.type }}</span>
        <span class="lb-ability-name">{{ ab.name }}</span>
      </div>
      <p class="lb-effect-text">{{ ab.effect }}</p>
    </div>
  </div>

  <!-- Attacks -->
  <div v-if="detail?.attacks?.length" class="lb-section">
    <div v-for="atk in detail.attacks" :key="atk.name" class="lb-attack">
      <div class="lb-attack-header">
        <span class="lb-attack-cost">
          <span
            v-for="(c, ci) in atk.cost"
            :key="ci"
            class="lb-energy-dot"
            :style="{ background: energyColor(c) }"
            :title="c"
          ></span>
        </span>
        <span class="lb-attack-name">{{ atk.name }}</span>
        <span v-if="atk.damage" class="lb-attack-damage">{{ atk.damage }}</span>
      </div>
      <p v-if="atk.effect" class="lb-effect-text">{{ atk.effect }}</p>
    </div>
  </div>

  <!-- Trainer / Energy effect -->
  <div v-if="!detail?.attacks?.length && !detail?.abilities?.length && card.category !== 'Pokemon'" class="lb-section">
    <p v-if="detail?.description" class="lb-effect-text">{{ detail.description }}</p>
  </div>

  <!-- Weakness / Resistance / Retreat -->
  <div v-if="detail && card.category === 'Pokemon'" class="lb-wrr">
    <div v-if="detail.weaknesses?.length" class="lb-wrr-item">
      <span class="lb-wrr-label">Weakness</span>
      <span v-for="w in detail.weaknesses" :key="w.type" class="lb-wrr-value">
        <span class="lb-energy-dot sm" :style="{ background: energyColor(w.type) }" :title="w.type"></span>
        {{ w.value }}
      </span>
    </div>
    <div v-if="detail.resistances?.length" class="lb-wrr-item">
      <span class="lb-wrr-label">Resistance</span>
      <span v-for="r in detail.resistances" :key="r.type" class="lb-wrr-value">
        <span class="lb-energy-dot sm" :style="{ background: energyColor(r.type) }" :title="r.type"></span>
        {{ r.value }}
      </span>
    </div>
    <div v-if="card.retreat !== undefined" class="lb-wrr-item">
      <span class="lb-wrr-label">Retreat</span>
      <span class="lb-wrr-value">
        <span v-for="i in card.retreat" :key="i" class="lb-energy-dot sm" :style="{ background: energyColor('Colorless') }"></span>
        <span v-if="card.retreat === 0" class="lb-wrr-none">None</span>
      </span>
    </div>
  </div>
</template>
