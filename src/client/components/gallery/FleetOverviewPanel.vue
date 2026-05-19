<script setup lang="ts">
/** Empty-state inspector content: fleet-level stats and a "needs attention"
 *  list. Shown when no card is selected. */
import { computed } from "vue";

interface GalleryCard {
  cardId: string;
  name: string;
  label: string;
  hasClean: boolean;
  hasComposite: boolean;
  hasSvg: boolean;
  hasSource: boolean;
  cleanMeta: Record<string, unknown> | null;
}

const props = defineProps<{
  cards: GalleryCard[];
}>();

const emit = defineEmits<{
  select: [cardId: string];
}>();

const total = computed(() => props.cards.length);
const withClean = computed(
  () => props.cards.filter((c) => c.hasClean || c.hasComposite).length,
);
const missing = computed(() => total.value - withClean.value);
const withSvg = computed(() => props.cards.filter((c) => c.hasSvg).length);
const withSource = computed(() => props.cards.filter((c) => c.hasSource).length);

const latestClean = computed(() => {
  let latest: string | null = null;
  for (const c of props.cards) {
    const ts = c.cleanMeta?.timestamp;
    if (typeof ts === "string" && (!latest || ts > latest)) latest = ts;
  }
  return latest;
});

const needsAttention = computed(() =>
  props.cards
    .filter((c) => !c.hasClean && !c.hasComposite)
    .slice(0, 5),
);
</script>

<template>
  <aside class="overview">
    <div class="overview-head">Fleet overview</div>
    <p class="overview-sub">Click a card to inspect it.</p>

    <div class="overview-stats">
      <div class="overview-stat">
        <div class="overview-stat-val">{{ total }}</div>
        <div class="overview-stat-lbl">cards in set</div>
      </div>
      <div class="overview-stat">
        <div class="overview-stat-val">{{ withClean }}</div>
        <div class="overview-stat-lbl">with art</div>
      </div>
      <div class="overview-stat" :class="missing > 0 && 'overview-stat-warn'">
        <div class="overview-stat-val">{{ missing }}</div>
        <div class="overview-stat-lbl">missing</div>
      </div>
      <div class="overview-stat">
        <div class="overview-stat-val">{{ withSvg }}</div>
        <div class="overview-stat-lbl">SVG cached</div>
      </div>
      <div class="overview-stat">
        <div class="overview-stat-val">{{ withSource }}</div>
        <div class="overview-stat-lbl">source PNG</div>
      </div>
    </div>

    <div v-if="latestClean" class="overview-latest">
      Latest render: <span class="overview-mono">{{ latestClean }}</span>
    </div>

    <div v-if="needsAttention.length" class="overview-attention">
      <div class="overview-section-title">Needs attention</div>
      <ul>
        <li
          v-for="c in needsAttention"
          :key="c.cardId"
          @click="emit('select', c.cardId)"
        >
          <span class="overview-att-id">{{ c.cardId }}</span>
          <span class="overview-att-name">{{ c.name }}</span>
        </li>
      </ul>
      <p class="overview-hint">
        Use <strong>Generate Missing</strong> in the toolbar to queue ComfyUI for all of these at once.
      </p>
    </div>
  </aside>
</template>

<style scoped>
.overview {
  background: #131826;
  border-left: 1px solid #2a2a40;
  padding: 16px 18px;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-sizing: border-box;
}

.overview-head {
  font-size: 11px;
  font-weight: 700;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.overview-sub { color: #888; font-size: 12px; margin: 0; }

.overview-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.overview-stat {
  background: #181d2a;
  padding: 10px 12px;
  border-radius: 6px;
}
.overview-stat-val { font-size: 22px; font-weight: 700; color: #fff; }
.overview-stat-lbl { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
.overview-stat-warn .overview-stat-val { color: #f6ad55; }

.overview-latest {
  font-size: 11px;
  color: #888;
}
.overview-mono { font-family: monospace; color: #aaa; }

.overview-attention {
  background: #181d2a;
  padding: 10px 12px;
  border-radius: 6px;
  border-left: 3px solid #f6ad55;
}
.overview-section-title {
  font-size: 10px;
  font-weight: 700;
  color: #f6ad55;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}
.overview-attention ul {
  list-style: none;
  padding: 0;
  margin: 0 0 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.overview-attention li {
  display: flex;
  gap: 8px;
  align-items: baseline;
  cursor: pointer;
  padding: 3px 4px;
  border-radius: 3px;
  font-size: 12px;
}
.overview-attention li:hover { background: #1a2540; }
.overview-att-id { font-family: monospace; color: #5a8cd6; min-width: 90px; }
.overview-att-name { color: #ddd; }
.overview-hint { font-size: 11px; color: #888; margin: 0; }
</style>
