<script setup lang="ts">
import { computed } from "vue";
import type { NameSuffix } from "../../types";

const props = defineProps<{
  name: string;
  suffix?: NameSuffix;
  evolvesFrom?: string;
}>();

/*
 * Suffix rendering: ex/V/VSTAR have PNG logos shipped from the SVG renderer's
 * asset folder; VMAX has no asset and renders as styled text. If/when a VMAX
 * logo lands at /logos/pokemon-vmax.png, add it to LOGO_FILES below.
 */
const LOGO_FILES: Partial<Record<NameSuffix, string>> = {
  ex:    "/logos/pokemon-ex.png",
  V:     "/logos/pokemon-v.png",
  VSTAR: "/logos/pokemon-vstar.png",
};

const logoSrc = computed(() => props.suffix ? LOGO_FILES[props.suffix] : undefined);
</script>

<template>
  <div class="name-cluster">
    <span v-if="evolvesFrom" class="evolves-from">Evolves from {{ evolvesFrom }}</span>
    <div class="name-row">
      <h1 class="name">{{ name }}</h1>
      <img
        v-if="logoSrc"
        :src="logoSrc"
        :alt="suffix"
        class="suffix-logo"
        :data-suffix="suffix"
      />
      <span
        v-else-if="suffix"
        class="suffix-text"
        :data-suffix="suffix"
      >{{ suffix }}</span>
    </div>
  </div>
</template>

<style scoped>
.name-cluster {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Evolves-from uses the infobar (Frutiger) face and a stroke, matching
 * fontFamily="infobar" + strokeWidth=2.5 on the evolves-from text node in
 * data/templates/pokemon-fullart.json. Sizing comes from $evolvesFrom.fullart. */
.evolves-from {
  font-family: var(--font-infobar);
  font-weight: 700;
  font-size: var(--size-evolves-from);
  color: var(--color-name);
  opacity: var(--opacity-secondary);
  -webkit-text-stroke: var(--width-name-stroke) var(--color-name-stroke);
  text-shadow: var(--shadow-title);
  paint-order: stroke fill;
  line-height: 1;
  white-space: nowrap;
}

/*
 * Inline flow (not flexbox) so suffix logos can vertical-align to the
 * text content area — the strip from the font's ascent line down to its
 * descent line. Flexbox's align-items only speaks in margin-box edges
 * (line-box bottom, which includes descender slack); CSS's `vertical-align`
 * is the primitive that knows about ascent/descent metrics from the font's
 * OS/2 table. The badge feels "part of the text" when it fills that strip.
 *
 * white-space:nowrap mirrors wrap=0 in the SVG renderer — long names
 * overflow rather than break to a second line. The name-anchor has no
 * right constraint so the overflow has somewhere to go.
 */
.name-row {
  white-space: nowrap;
  line-height: 1;
  /*
   * The badge uses vertical-align:text-bottom, which CSS resolves against
   * the *parent's* font metrics — not the sibling text's. Setting the row's
   * own font-size to --size-name makes "text-bottom" mean "descent line of
   * 48px Gill Sans," which is what we want. Without this it'd resolve
   * against an inherited 16px font and the badge would sit too high.
   */
  font-family: var(--font-title);
  font-size:   var(--size-name);
}

.name {
  display: inline-block;       /* sit inline with the suffix logo / text */
  margin: 0;
  font-family: var(--font-title);
  font-size:   var(--size-name);
  font-weight: var(--weight-title);
  line-height: 1;
  color: var(--color-name);
  -webkit-text-stroke: var(--width-name-stroke) var(--color-name-stroke);
  text-shadow: var(--shadow-title);
  paint-order: stroke fill;
}

/*
 * Logo height (var(--size-suffix-logo) = 55px) is calibrated to roughly
 * equal the name font's ascent + descent (1.146× the 48px name size).
 * vertical-align:text-bottom anchors the logo's bottom edge to the text's
 * descent line — since height ≈ ascent+descent, its top edge lands at the
 * ascent line. Result: the badge fills the same vertical strip as the
 * letterforms, no floating, no protrusion.
 *
 * If --size-name changes (e.g. a future name-shrinking pass for long
 * names), bump --size-suffix-logo proportionally to keep the relationship.
 */
.suffix-logo {
  display: inline-block;
  vertical-align: text-bottom;
  height: var(--size-suffix-logo);
  width: auto;
  margin-left: 12px;
  filter: drop-shadow(0 4px 4px rgb(0 0 0 / 0.6));
}

/*
 * Text fallback (VMAX) — styled to read as a logo until we have an asset.
 * Same alignment recipe so it visually anchors like the image badges, but
 * with heavier typographic treatment (italic, tight tracking, thicker
 * stroke) so it carries badge-weight rather than reading as plain text.
 *
 * Size is 0.85× the name (vs. 1.146× for image badges) — sized down a
 * notch because Gill Sans Condensed Bold Italic at 41px already has a
 * lot of presence; matching the name's height would overpower it.
 */
.suffix-text {
  display: inline-block;
  vertical-align: text-bottom;
  margin-left: 12px;
  /*
   * font-weight: 700 (not the title's 900) so this resolves to the
   * non-condensed `Gill Sans Bold.otf` face — wider, more substantial
   * letterforms than the narrow `GillSans Condensed Bold` at 900. Italic
   * is synthetic (no italic OTF in the bundle); fine for display use.
   */
  font-family: var(--font-title);
  font-weight: 700;
  font-style: italic;
  font-size: calc(var(--size-name) * 1.15);     /* 15% bigger than the name */
  letter-spacing: 0;                            /* let italic glyphs breathe */
  line-height: 1;
  padding-right: 4px;                           /* room for italic overhang */
  /*
   * Rainbow gradient text fill — evokes the "rainbow rare" look from real
   * Pokémon TCG cards. `background-clip: text` + `color: transparent`
   * paints the gradient inside each glyph. No -webkit-text-stroke:
   * combined with background-clip:text, the stroke ends up dominating and
   * the gradient turns into "mostly black with hints of color" in
   * Chromium. Outline is faked with stacked 1px text-shadows (which
   * respect the glyph shape from background-clip:text correctly), plus
   * one soft blurred shadow for lift against the card art.
   */
  background: linear-gradient(
    100deg,
    #ff2d8a   0%,
    #ff8c00  16%,
    #ffd700  32%,
    #2ecc71  50%,
    #18b6ff  66%,
    #7c4dff  82%,
    #ff2d8a 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  /* No text-shadow — Chromium has a long-standing bug where text-shadow
   * paints OVER the gradient when text uses background-clip:text +
   * color:transparent. Depth/outline comes via filter:drop-shadow
   * instead, which lives outside the text-shape clip and stays behind. */
  filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.85));
}
</style>
