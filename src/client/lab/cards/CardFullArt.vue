<script setup lang="ts">
import { computed } from "vue";
import type { LabCard, NameSuffix } from "../types";
import NameCluster  from "./parts/NameCluster.vue";
import HpCluster    from "./parts/HpCluster.vue";
import ContentPanel from "./parts/ContentPanel.vue";
import FooterRow    from "./parts/FooterRow.vue";
import StagePill    from "./parts/StagePill.vue";

const props = defineProps<{
  card: LabCard;
}>();

/*
 * Background watermark (the big silver V / VSTAR mark behind the artwork).
 * Mirrors the SVG renderer's `big-logo` element in pokemon-fullart.json:
 *   anchorX=-50, anchorY=-38, height=280, opacity=0.7, clipToCard=1.
 * Only V and VSTAR have a watermark asset; ex and VMAX show nothing.
 */
const BIG_LOGO_FILES: Partial<Record<NameSuffix, string>> = {
  V:     "/logos/pokemon-v-big.png",
  VSTAR: "/logos/pokemon-vstar-big.png",
};

const bigLogoSrc = computed(() => props.card.suffix ? BIG_LOGO_FILES[props.card.suffix] : undefined);
</script>

<template>
  <article class="card">
    <!--
      Art is a real <img>, not a CSS background, so it always prints —
      Chrome's "Background graphics" toggle and downstream printer drivers
      can suppress backgrounds but never an inline image.
    -->
    <img class="art" :src="card.artUrl" alt="" aria-hidden="true" />

    <!--
      Background watermark — large translucent suffix mark painted over the
      artwork, clipped to the card by .card's overflow:hidden. SVG parity:
      pokemon-fullart.json big-logo @ anchorX=-50, anchorY=-38, height=280, opacity=0.7.
    -->
    <img
      v-if="bigLogoSrc"
      :src="bigLogoSrc"
      class="big-logo"
      alt=""
      aria-hidden="true"
    />

    <div class="stage-anchor">
      <StagePill :stage="card.stage" />
    </div>

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
  /*
   * print-color-adjust:exact tells the browser to honor backgrounds,
   * gradients, and box-shadows when printing — without it, Chrome strips
   * them unless the user enables "Background graphics" in the print dialog.
   * Inherited by every descendant (the property is `inherited`), so this
   * one declaration covers EnergyDot gradients, the glass panel tint,
   * the "Ability" pill, etc.
   */
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

/*
 * Art is its own layer so the content panel's backdrop-filter can blur
 * it without affecting the rest of the card chrome. object-fit:cover
 * mirrors what background-size:cover would have done.
 */
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
 * Big-logo watermark — positioned in the 750×1050 canvas to match the SVG
 * renderer. The card's overflow:hidden + border-radius clips the portion
 * that extends past the top-left edge (the renderer's clipToCard=1 mode).
 *
 * SVG-side: anchorX=-50, anchorY=-38 are top-left coordinates; height=280
 * with the asset's native aspect (300×227 → ~370 width) ports 1:1.
 */
.big-logo {
  position: absolute;
  left: -50px;
  top:  -38px;
  height: 280px;
  width:  auto;
  opacity: 0.7;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

/* anchors mirror the JSON anchorX/anchorY 1:1 — these numbers are the contract.
 * Name has no right constraint: the SVG renderer uses wrap=0 (nowrap), so the
 * name overflows toward the HP cluster when long ("Mega Charizard X") rather
 * than wrapping to a second line. */
/*
 * Stage plaque sits in the upper-left, above the name. Inset rather than
 * flush to the corner because printed cards get their corners rounded/cut
 * during finishing — anything flush to (0,0) loses text to the trim.
 * Left aligns with the name (45px) so the title block has one x-baseline.
 */
.stage-anchor   { position: absolute; left: 45px;  top: 8px;  }
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
