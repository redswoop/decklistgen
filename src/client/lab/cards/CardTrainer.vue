<script setup lang="ts">
import type { LabTrainerCard } from "../types";
import TrainerHeader   from "./parts/TrainerHeader.vue";
import AbilityBlock    from "./parts/AbilityBlock.vue";
import VStarPowerBlock from "./parts/VStarPowerBlock.vue";
import AttackBlock     from "./parts/AttackBlock.vue";
import EnergyTokenText from "./parts/EnergyTokenText.vue";

defineProps<{
  card: LabTrainerCard;
}>();
</script>

<template>
  <article class="card">
    <img class="art" :src="card.artUrl" alt="" aria-hidden="true" />

    <div class="header-anchor">
      <TrainerHeader :trainer-type="card.trainerType" />
    </div>

    <div class="name-anchor">
      <h1 class="name">{{ card.name }}</h1>
    </div>

    <div class="content-anchor">
      <section class="content-panel">
        <p v-if="card.effect" class="effect">
          <EnergyTokenText :text="card.effect" />
        </p>

        <AbilityBlock v-if="card.ability" :ability="card.ability" />

        <VStarPowerBlock v-if="card.vstarPower" :vstar-power="card.vstarPower" />

        <AttackBlock
          v-for="(atk, i) in (card.attacks ?? [])"
          :key="i"
          :attack="atk"
        />

        <p v-if="card.ruleText" class="rule-text">{{ card.ruleText }}</p>

        <p v-if="card.illustrator" class="illus">Illus. {{ card.illustrator }}</p>
      </section>
    </div>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  width:  calc(var(--card-w) * 1px);
  height: calc(var(--card-h) * 1px);
  border-radius: 28px;
  overflow: hidden;
  background: #111;
  font-family: var(--font-body);
  color: var(--color-name);
  box-shadow: 0 12px 32px rgb(0 0 0 / 0.4);
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

.art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  user-select: none;
  -webkit-user-drag: none;
}

/*
 * Anchors mirror trainer.json:
 *   header-banner @ anchorX=20, anchorY=12, width=710
 *   name-cluster  @ anchorX=45, anchorY=86 (baseline; the name's bottom)
 *   content-block bottom-anchored same as pokemon-fullart
 */
.header-anchor {
  position: absolute;
  left: 20px;
  top:  12px;
}

.name-anchor {
  position: absolute;
  left: 45px;
  top:  78px;
}

.name {
  margin: 0;
  font-family: var(--font-title);
  font-weight: var(--weight-title);
  font-size:   var(--size-trainer-name);
  color: var(--color-name);
  -webkit-text-stroke: var(--width-name-stroke) var(--color-name-stroke);
  text-shadow: var(--shadow-title);
  paint-order: stroke fill;
  line-height: 1;
  white-space: nowrap;
}

.content-anchor {
  position: absolute;
  left:   var(--panel-inset-side);
  right:  var(--panel-inset-side);
  bottom: var(--panel-inset-bottom);
}

.content-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--panel-bg);
  backdrop-filter: blur(var(--panel-blur));
  -webkit-backdrop-filter: blur(var(--panel-blur));
  border-radius: var(--panel-radius);
  padding: var(--panel-padding);
}

@media print {
  .content-panel {
    background: rgb(0 0 0 / 0.62);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

/*
 * The bulk trainer effect text — bigger than pokemon attack-effect, since
 * it carries the whole card. Mirrors $trainerEffect=36 in font-sizes.ts.
 */
.effect {
  margin: 0;
  font-family: var(--font-body);
  font-weight: 700;
  font-size:   var(--size-trainer-effect);
  color: var(--color-attack-text);
  -webkit-text-stroke: var(--width-name-stroke) var(--color-name-stroke);
  text-shadow: var(--shadow-title);
  paint-order: stroke fill;
  line-height: 1.25;
}

/* Faded rule text ("Play only 1 Supporter per turn.") — opacity 0.5 tier */
.rule-text {
  margin: 0;
  font-family: var(--font-body);
  font-weight: 400;
  font-size:   var(--size-rule-text);
  color: var(--color-name);
  opacity: var(--opacity-tertiary);
  line-height: 1.2;
}

.illus {
  margin: 0;
  font-family: var(--font-infobar);
  font-weight: 400;
  font-style: italic;
  font-size: var(--size-footer);
  color: var(--color-name);
  opacity: var(--opacity-tertiary);
}
</style>
