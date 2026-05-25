<script setup lang="ts">
import type { LabCard } from "../types";
import NameCluster  from "./parts/NameCluster.vue";
import HpCluster    from "./parts/HpCluster.vue";
import ContentPanel from "./parts/ContentPanel.vue";
import FooterRow    from "./parts/FooterRow.vue";

defineProps<{
  card: LabCard;
}>();
</script>

<template>
  <article
    class="card"
    :style="{ '--art': `url('${card.artUrl}')` }"
  >
    <div class="art" aria-hidden="true" />

    <div class="name-anchor">
      <NameCluster
        :name="card.name"
        :suffix="card.suffix"
        :evolves-from="card.evolvesFrom"
      />
    </div>

    <div class="hp-anchor">
      <HpCluster :hp="card.hp" :type="card.type" />
    </div>

    <div class="content-anchor">
      <ContentPanel
        :ability="card.ability"
        :attacks="card.attacks"
      />
    </div>

    <div class="footer-anchor">
      <FooterRow
        :weakness="card.weakness"
        :resistance="card.resistance"
        :retreat="card.retreat"
        :illustrator="card.illustrator"
      />
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
  background: #111;             /* fallback while art loads */
  font-family: var(--font-body);
  color: var(--color-name);
  box-shadow: 0 12px 32px rgb(0 0 0 / 0.4);
}

/*
 * Art is its own layer so the content panel's backdrop-filter can blur
 * it without affecting the rest of the card chrome.
 */
.art {
  position: absolute;
  inset: 0;
  background-image: var(--art);
  background-size: cover;
  background-position: center;
}

/* anchors mirror the JSON anchorX/anchorY 1:1 — these numbers are the contract.
 * Name has no right constraint: the SVG renderer uses wrap=0 (nowrap), so the
 * name overflows toward the HP cluster when long ("Mega Charizard X") rather
 * than wrapping to a second line. */
.name-anchor    { position: absolute; left: 45px;  top: 46px; }
.hp-anchor      { position: absolute; left: 514px; top: 42px; }

/*
 * Content panel is anchored to the bottom only. Height is content-driven:
 * a card with one attack hugs the lower portion of the art; a card with
 * an ability + multiple attacks grows upward from the same baseline.
 */
.content-anchor {
  position: absolute;
  left:   var(--panel-inset-side);
  right:  var(--panel-inset-side);
  bottom: var(--panel-inset-bottom);
}

.footer-anchor {
  position: absolute;
  left:   var(--panel-inset-side);
  right:  var(--panel-inset-side);
  bottom: var(--footer-bottom);
}
</style>
