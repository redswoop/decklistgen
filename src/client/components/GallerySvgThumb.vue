<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { getSvg } from "../composables/useGallerySvgCache.js";

type BadgeVariant = "standard" | "fullart" | "clean" | "expanded" | "missing" | "reference";
interface Badge { text: string; variant: BadgeVariant }

const props = withDefaults(defineProps<{
  cardId: string;
  /** Bumped by the parent (e.g. after a font-size save) to force a re-fetch. */
  cacheBust: number;
  /** Pixel width of the SVG box. Height is 96/68 of width (card aspect). */
  width?: number;
  label?: string;
  name?: string;
  /** Optional metadata line under the name (e.g. "Pokemon | Basic | HP 60"). */
  metaLine?: string;
  /** Optional badge pills (cards tab shows CLEANED / FULLART / etc). */
  badges?: Badge[];
  /** Show a generating spinner overlay even if the SVG has loaded. */
  loading?: boolean;
  /** Render at true 2.5x3.5 card aspect (width × 1.4) instead of the slightly
   *  fudged 1.412 (96/68) used by the default editing-size thumbnails. Used by
   *  the Gallery's print-preview mode where the on-screen card must align with
   *  a real card held against the monitor. */
  physical?: boolean;
  /** "full" (default) shows label, name, id, badges, metaLine.
   *  "compact" shows only label + name above the card; everything else is
   *  hidden so the chrome doesn't dwarf a print-size thumbnail. */
  chrome?: "full" | "compact";
  /** Highlight the thumb as the currently-inspected card. */
  selected?: boolean;
  /** Show a hover "swap" icon. Used for reference slots only — the parent
   *  decides whether this thumb is eligible. */
  swappable?: boolean;
  /** True when the slot currently has an override active — controls the
   *  swap-icon styling so users can see at a glance which slots they've
   *  customised. */
  hasOverride?: boolean;
}>(), {
  width: 230,
  label: "",
  name: "",
  metaLine: "",
  badges: () => [],
  loading: false,
  physical: false,
  chrome: "full",
  selected: false,
  swappable: false,
  hasOverride: false,
});

defineEmits<{ click: []; dblclick: []; swap: [] }>();

const svgHtml = ref<string>("");

const frameHeight = computed(() =>
  Math.round(props.width * (props.physical ? 1.4 : 1.412)),
);

watch(
  () => [props.cardId, props.cacheBust] as const,
  async ([cardId, bust]) => {
    svgHtml.value = "";
    const html = await getSvg(cardId, bust);
    // Stale-response guard: only commit if the props haven't changed since.
    if (props.cardId === cardId && props.cacheBust === bust) {
      svgHtml.value = html;
    }
  },
  { immediate: true },
);
</script>

<template>
  <div
    :class="[
      'svg-thumb',
      chrome === 'compact' && 'svg-thumb-compact',
      selected && 'svg-thumb-selected',
    ]"
    :style="{ width: `${width}px` }"
    @click="$emit('click')"
    @dblclick="$emit('dblclick')"
  >
    <div v-if="label" class="svg-thumb-label">{{ label }}</div>
    <div v-if="name" class="svg-thumb-name">{{ name }}</div>
    <div v-if="chrome === 'full' && cardId" class="svg-thumb-id">{{ cardId }}</div>
    <div v-if="chrome === 'full' && badges.length" class="svg-thumb-badges">
      <span
        v-for="b in badges"
        :key="b.text"
        :class="['svg-thumb-badge', `svg-thumb-badge-${b.variant}`]"
      >{{ b.text }}</span>
    </div>
    <div v-if="chrome === 'full' && metaLine" class="svg-thumb-meta">{{ metaLine }}</div>
    <div
      class="svg-thumb-frame"
      :style="{ width: `${width}px`, height: `${frameHeight}px` }"
    >
      <div
        v-if="svgHtml"
        class="svg-thumb-svg"
        v-html="svgHtml"
      />
      <div v-else class="svg-thumb-placeholder">Loading SVG…</div>
      <div v-if="loading" class="svg-thumb-overlay">
        <div class="svg-thumb-spinner" />
      </div>
      <button
        v-if="swappable"
        type="button"
        :class="['svg-thumb-swap', hasOverride && 'svg-thumb-swap-active']"
        :title="hasOverride ? 'Swap (override active)' : 'Swap card in this slot'"
        @click.stop="$emit('swap')"
      >⇄</button>
    </div>
  </div>
</template>

<style scoped>
.svg-thumb {
  background: #16213e;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  box-sizing: content-box;
  /* Skip paint+layout for off-screen thumbs. The embedded base64 card art
   * gets re-rasterized on every size change (e.g. flipping to print-size
   * mode), so painting all 50 cards at once tanks framerate. content-visibility
   * defers everything outside the viewport. */
  content-visibility: auto;
  contain-intrinsic-size: auto 230px 326px;
}

/* Compact chrome (used by Gallery print-preview). Tighter padding and smaller
 * labels keep the on-screen card aligned with a physical card held against
 * the monitor — the SVG portion is what should match real card dimensions. */
.svg-thumb-compact {
  padding: 4px 4px 6px 4px;
  border-radius: 6px;
}
.svg-thumb-compact .svg-thumb-label {
  font-size: 10px;
  margin-bottom: 0;
}
.svg-thumb-compact .svg-thumb-name {
  font-size: 11px;
  margin-bottom: 3px;
  line-height: 1.2;
}

.svg-thumb:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.svg-thumb-label {
  font-weight: 700;
  font-size: 13px;
  color: #f39c12;
  margin-bottom: 2px;
}

.svg-thumb-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  text-align: center;
}

.svg-thumb-id {
  font-size: 11px;
  color: #666;
  margin-bottom: 4px;
}

.svg-thumb-badges {
  display: flex;
  gap: 5px;
  margin-bottom: 4px;
}

.svg-thumb-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.svg-thumb-badge-standard { background: #2d3748; color: #a0aec0; }
.svg-thumb-badge-fullart  { background: #553c9a; color: #d6bcfa; }
.svg-thumb-badge-clean    { background: #276749; color: #9ae6b4; }
.svg-thumb-badge-expanded { background: #2b6cb0; color: #bee3f8; }
.svg-thumb-badge-missing  { background: #742a2a; color: #fed7d7; }
.svg-thumb-badge-reference{ background: #1a2540; color: #5a8cd6; border: 1px solid #2d4a7a; }

.svg-thumb-selected {
  outline: 2px solid #f39c12;
  outline-offset: 1px;
}

.svg-thumb-meta {
  font-size: 11px;
  color: #888;
  text-align: center;
  margin-bottom: 6px;
  line-height: 1.4;
}

.svg-thumb-frame {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  overflow: hidden;
}

.svg-thumb-svg {
  width: 100%;
  height: 100%;
}

.svg-thumb-svg :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.svg-thumb-placeholder {
  color: #555;
  font-size: 13px;
}

.svg-thumb-overlay {
  position: absolute;
  inset: 0;
  background: rgba(13, 17, 23, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
}

.svg-thumb-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #444;
  border-top-color: #f39c12;
  border-radius: 50%;
  animation: svg-thumb-spin 0.8s linear infinite;
}

@keyframes svg-thumb-spin {
  to { transform: rotate(360deg); }
}

.svg-thumb-swap {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px; height: 24px;
  border-radius: 50%;
  background: rgba(15, 20, 30, 0.82);
  border: 1px solid rgba(243, 156, 18, 0.6);
  color: #f39c12;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s, transform 0.12s, background 0.12s;
}
.svg-thumb:hover .svg-thumb-swap { opacity: 1; }
.svg-thumb-swap:hover {
  background: #f39c12;
  color: #1a1a2e;
  transform: scale(1.08);
}
/* Active override → keep visible so users can spot customised slots without
 * hovering over every card. */
.svg-thumb-swap-active {
  opacity: 1;
  background: #553c14;
  border-color: #f39c12;
}
</style>
