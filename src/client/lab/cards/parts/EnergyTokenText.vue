<script setup lang="ts">
import { computed } from "vue";

/*
 * Inline energy-token renderer — the lab's equivalent of
 * expandEnergyTokens() in
 *   src/server/services/pokeproxy/elements/text-element.ts
 *
 * Effect text in TCGdex card data uses the convention `{X}` where X is a
 * single-letter energy code (G/R/W/L/P/F/D/M/Y/N/C). The SVG renderer
 * replaces each token with a colored EssentiarumTCG glyph spliced into
 * the surrounding text run. We do the same here: split the string on the
 * regex, render text runs as plain spans, and render each {X} as a
 * colored EssentiarumTCG character.
 *
 * Glyph sizing mirrors the SVG: glyphSize = round(fontSize * 0.9). We
 * read the parent's computed font-size off the DOM at mount time… no,
 * actually we don't — CSS handles it directly via `font-size: 0.9em`
 * which inherits the parent's size, matching the .9 ratio. Simpler and
 * stays in sync if the parent font-size changes.
 *
 * Dragon (N) is special in the SVG renderer because the EssentiarumTCG
 * 'N' glyph renders the word "LEGEND" rather than a circle — that path
 * substitutes a filled bullet. We mirror that here.
 */

const props = defineProps<{
  text: string;
}>();

type Part =
  | { kind: "text"; value: string }
  | { kind: "energy"; code: string };

const ENERGY_CODE = /\{([A-Z])\}/g;

/** Map single-letter code to the matching --color-type-<Name> variable. */
const CODE_TO_TYPE: Record<string, string> = {
  G: "Grass", R: "Fire", W: "Water", L: "Lightning", P: "Psychic",
  F: "Fighting", D: "Darkness", M: "Metal", Y: "Fairy",
  N: "Dragon", C: "Colorless",
};

const parts = computed<Part[]>(() => {
  const out: Part[] = [];
  let lastIdx = 0;
  ENERGY_CODE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ENERGY_CODE.exec(props.text)) !== null) {
    if (m.index > lastIdx) {
      out.push({ kind: "text", value: props.text.slice(lastIdx, m.index) });
    }
    out.push({ kind: "energy", code: m[1] });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < props.text.length) {
    out.push({ kind: "text", value: props.text.slice(lastIdx) });
  }
  return out;
});
</script>

<template><span class="energy-text"><template v-for="(p, i) in parts" :key="i"><span
        v-if="p.kind === 'text'"
        class="run"
      >{{ p.value }}</span><span
        v-else-if="p.code === 'N'"
        class="energy-glyph dragon"
        :style="{ color: `var(--color-type-${CODE_TO_TYPE[p.code]})` }"
        :title="CODE_TO_TYPE[p.code] || p.code"
      >●</span><span
        v-else
        class="energy-glyph"
        :style="{ color: `var(--color-type-${CODE_TO_TYPE[p.code] ?? 'Colorless'})` }"
        :title="CODE_TO_TYPE[p.code] || p.code"
      >{{ p.code }}</span></template></span></template>

<style scoped>
/*
 * Span the inline glyph at 0.9em of the surrounding text — matches the
 * SVG renderer's glyphSize = round(fontSize * 0.9).
 *
 * No stroke/shadow on the inline glyph: the SVG renderer's tspan also
 * skips per-glyph stroke and lets the parent text-shadow carry through
 * via fill-only. paint-order is irrelevant since there's no stroke.
 */
.energy-text {
  display: inline;
}

.run {
  display: inline;
}

.energy-glyph {
  font-family: "EssentiarumTCG", sans-serif;
  font-size: 0.9em;
  font-weight: 400;
  line-height: 1;
  /* small negative letter-spacing to keep the glyph hugging adjacent text */
  margin: 0 0.05em;
  /* The text inherits the parent's text-shadow / stroke via fill+shadow,
   * so we don't restate them here — keeping the glyph as a pure colored
   * letter is what the SVG renderer produces. */
  -webkit-text-stroke: 0;
  text-shadow: none;
}

/* Dragon (N) substitutes a filled bullet because EssentiarumTCG's 'N'
 * glyph renders the word "LEGEND". Mirror src/server/services/pokeproxy/
 * elements/text-element.ts behavior. */
.energy-glyph.dragon {
  font-family: inherit;
  font-size: 1em;
}
</style>
