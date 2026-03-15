<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { api } from "../lib/client.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";

interface VariantCard {
  id: string;
  localId: string;
  name: string;
  setCode: string;
  setName: string;
  category: string;
  rarity: string;
  isFullArt: boolean;
  imageBase: string;
  hp: number | null;
  stage: string | null;
}

interface VariantGroup {
  name: string;
  mechanicsHash: string;
  count: number;
  cards: VariantCard[];
}

const emit = defineEmits<{
  previewCard: [card: VariantCard, cards: VariantCard[]];
}>();

const groups = ref<VariantGroup[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const search = ref("");
const expandedIdx = ref<Set<number>>(new Set());

const filtered = computed(() => {
  if (!search.value) return groups.value;
  const q = search.value.toLowerCase();
  return groups.value.filter((g) => g.name.toLowerCase().includes(q));
});

function toggle(idx: number) {
  const s = new Set(expandedIdx.value);
  if (s.has(idx)) s.delete(idx);
  else s.add(idx);
  expandedIdx.value = s;
}

function handleCardClick(card: VariantCard, group: VariantGroup) {
  emit("previewCard", card as any, group.cards as any);
}

onMounted(async () => {
  loading.value = true;
  try {
    groups.value = await api.getVariantGroups();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="variants-view">
    <div class="variants-header">
      <h2>Variant Groups</h2>
      <input
        v-model="search"
        type="text"
        placeholder="Filter by name..."
        class="variants-search"
      />
      <span class="variants-summary">
        {{ filtered.length }}<template v-if="search"> of {{ groups.length }}</template> groups
      </span>
    </div>

    <div v-if="loading" class="variants-loading">Loading variant groups...</div>
    <div v-else-if="error" class="variants-error">Error: {{ error }}</div>

    <div v-else class="variants-list">
      <div
        v-for="(g, gi) in filtered"
        :key="g.name + g.mechanicsHash"
        :class="['vg', { expanded: expandedIdx.has(gi) }]"
      >
        <div class="vg-header" @click="toggle(gi)">
          <span class="vg-count">{{ g.count }}</span>
          <span class="vg-name">{{ g.name }}</span>
          <span class="vg-meta">{{ g.cards[0].category }}<template v-if="g.cards[0].stage"> {{ g.cards[0].stage }}</template></span>
          <span class="vg-hash">{{ g.mechanicsHash }}</span>
          <span class="vg-chevron">{{ expandedIdx.has(gi) ? '\u25B2' : '\u25BC' }}</span>
        </div>
        <div v-if="expandedIdx.has(gi)" class="vg-cards">
          <div
            v-for="c in g.cards"
            :key="c.id"
            :class="['vg-thumb', { fullart: c.isFullArt }]"
            @click="handleCardClick(c, g)"
          >
            <img
              v-if="c.imageBase"
              :src="cardImageUrl(c.imageBase, 'low')"
              loading="lazy"
            />
            <div v-else class="vg-thumb-empty" />
            <span class="vg-thumb-label">{{ c.setCode }} #{{ c.localId }}</span>
            <span class="vg-thumb-rarity">{{ c.rarity }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.variants-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.variants-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.variants-header h2 {
  font-size: 16px;
  margin: 0;
  white-space: nowrap;
}
.variants-search {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text);
  font-size: 13px;
}
.variants-search:focus {
  outline: none;
  border-color: var(--accent);
}
.variants-summary {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}
.variants-loading,
.variants-error {
  padding: 32px;
  text-align: center;
  color: var(--text-muted);
}
.variants-error {
  color: var(--danger);
}
.variants-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 16px;
}
.vg {
  background: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 6px;
  overflow: hidden;
}
.vg-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
}
.vg-header:hover {
  background: var(--bg-hover);
}
.vg-count {
  background: var(--accent);
  color: #000;
  font-weight: 700;
  font-size: 13px;
  min-width: 32px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  flex-shrink: 0;
}
.vg-name {
  font-size: 14px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vg-meta {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}
.vg-hash {
  font-size: 10px;
  color: var(--text-muted);
  font-family: monospace;
  opacity: 0.5;
}
.vg-chevron {
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}
.vg-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 12px 12px;
}
.vg-thumb {
  width: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  border-radius: 6px;
  padding: 2px;
}
.vg-thumb:hover {
  background: var(--bg-hover);
}
.vg-thumb.fullart {
  outline: 2px solid #553c9a;
  outline-offset: -2px;
}
.vg-thumb img {
  width: 76px;
  height: 106px;
  object-fit: cover;
  border-radius: 5px;
  background: var(--bg-tertiary);
}
.vg-thumb-empty {
  width: 76px;
  height: 106px;
  border-radius: 5px;
  background: var(--bg-tertiary);
}
.vg-thumb-label {
  font-size: 10px;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.2;
}
.vg-thumb-rarity {
  font-size: 9px;
  color: var(--text-muted);
  opacity: 0.6;
}
</style>
