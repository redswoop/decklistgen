<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { api } from "../lib/client.js";
import { useDecks } from "../composables/useDecks.js";
import { useDecklist } from "../composables/useDecklist.js";
import { getTopRarityVariants } from "../../shared/utils/rarity-rank.js";
import type { BeautifyMode, BeautifyPreview } from "../../shared/types/beautify.js";
import type { DeckCard } from "../../shared/types/deck.js";
import type { Card } from "../../shared/types/card.js";
import { deduplicateByArt } from "../../shared/utils/variant-allocation.js";

const props = defineProps<{
  deckId: string | null;
  deckName: string;
  deckCards?: DeckCard[];
}>();

const emit = defineEmits<{
  close: [];
  updated: [];
}>();

const { beautifyDeck } = useDecks();
const { replaceByName } = useDecklist();

const mode = ref<BeautifyMode>("best");
const excludeRarities = ref<Set<string>>(new Set());
const excludePrintUnfriendly = ref(true);
const availableRarities = ref<string[]>([]);
const loading = ref(false);
const status = ref("");

// Manual mode state
const candidates = ref<BeautifyPreview[]>([]);
const showCandidates = ref(false);
const selectedVariants = ref<Map<string, Card>>(new Map());

onMounted(async () => {
  try {
    const opts = await api.getFilterOptions();
    availableRarities.value = opts.rarities;
  } catch {}
});

function toggleRarity(rarity: string) {
  const s = new Set(excludeRarities.value);
  if (s.has(rarity)) {
    s.delete(rarity);
  } else {
    s.add(rarity);
  }
  excludeRarities.value = s;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function handleAction() {
  loading.value = true;
  status.value = "";

  try {
    if (props.deckId) {
      // Saved deck flow — server-side
      const result = await beautifyDeck({
        id: props.deckId,
        options: {
          mode: mode.value,
          excludeRarities: [...excludeRarities.value],
          excludePrintUnfriendly: excludePrintUnfriendly.value,
        },
      });

      if (result.candidates) {
        candidates.value = result.candidates;
        showCandidates.value = true;
        // Pre-select first variant for each
        const sel = new Map<string, Card>();
        for (const c of result.candidates) {
          if (c.variants.length > 0) {
            sel.set(c.name, c.variants[0]);
          }
        }
        selectedVariants.value = sel;
      } else {
        emit("updated");
        emit("close");
      }
    } else {
      // Working deck flow — client-side
      await beautifyWorkingDeck();
    }
  } catch (e) {
    status.value = "Beautify failed";
    console.error(e);
  } finally {
    loading.value = false;
  }
}

async function beautifyWorkingDeck() {
  if (!props.deckCards) return;
  const excludeSet = new Set([...excludeRarities.value].map((r) => r.toLowerCase()));

  // Group by name
  const byName = new Map<string, { totalCount: number; cardId: string }>();
  for (const dc of props.deckCards) {
    const existing = byName.get(dc.card.name);
    if (existing) {
      existing.totalCount += dc.count;
    } else {
      byName.set(dc.card.name, { totalCount: dc.count, cardId: dc.card.id });
    }
  }

  for (const [name, { totalCount, cardId }] of byName) {
    try {
      const { variants: allVariants } = await api.getVariants(cardId);
      let variants = allVariants;
      if (excludePrintUnfriendly.value) {
        variants = variants.filter((v) => !v.isPrintUnfriendly);
      }
      variants = variants.filter(
        (v) => !excludeSet.has(v.rarity.toLowerCase())
      );

      // Deduplicate same-art printings — one representative per unique artwork
      variants = deduplicateByArt(variants);

      if (variants.length === 0) continue;

      if (mode.value === "best") {
        variants = getTopRarityVariants(variants);
      } else {
        variants = shuffle(variants);
      }

      // Spread round-robin
      const entries: { card: Card; count: number }[] = [];
      const perVariant = Math.floor(totalCount / variants.length);
      let remainder = totalCount % variants.length;
      for (const v of variants) {
        const count = perVariant + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
        if (count > 0) entries.push({ card: v, count });
      }

      replaceByName(name, entries);
    } catch {
      // Skip this card on error
    }
  }

  emit("updated");
  emit("close");
}

async function applyManualSelections() {
  if (!props.deckId) return;
  // TODO: Build updated card list from manual selections and call updateDeck
  // For now, just close
  emit("close");
}

const actionLabel = computed(() => {
  if (loading.value) return "Working...";
  if (mode.value === "manual") return "Preview";
  return "Beautify";
});
</script>

<template>
  <div class="dialog-overlay" @click="emit('close')">
    <div class="dialog beautify-dialog" @click.stop>
      <h3>Beautify — {{ deckName }}</h3>

      <!-- Mode selector -->
      <div class="beautify-section-label">Mode</div>
      <div class="beautify-modes">
        <button
          :class="['beautify-mode-btn', { active: mode === 'random' }]"
          @click="mode = 'random'"
        >Random</button>
        <button
          :class="['beautify-mode-btn', { active: mode === 'best' }]"
          @click="mode = 'best'"
        >Best</button>
        <button
          :class="['beautify-mode-btn', { active: mode === 'manual' }]"
          @click="mode = 'manual'"
        >Manual</button>
      </div>

      <!-- Print-unfriendly toggle -->
      <label class="beautify-toggle">
        <input type="checkbox" v-model="excludePrintUnfriendly" />
        Skip gold / rainbow cards (bad for print)
      </label>

      <!-- Rarity filters -->
      <div class="beautify-section-label">Exclude Rarities</div>
      <div class="beautify-rarity-filters">
        <span
          v-for="r in availableRarities"
          :key="r"
          :class="['beautify-chip', { excluded: excludeRarities.has(r) }]"
          @click="toggleRarity(r)"
        >{{ r }}</span>
      </div>

      <!-- Manual mode candidates -->
      <div v-if="showCandidates && candidates.length" class="beautify-candidates">
        <div v-for="c in candidates" :key="c.name" class="beautify-candidate-row">
          <span class="beautify-candidate-name">{{ c.name }}</span>
          <span class="beautify-candidate-count">
            x{{ c.currentCards.reduce((s, e) => s + e.count, 0) }}
          </span>
          <div class="beautify-candidate-variants">
            <div
              v-for="v in c.variants"
              :key="v.id"
              :class="['beautify-variant-thumb', { selected: selectedVariants.get(c.name)?.id === v.id }]"
              :title="`${v.setCode} #${v.localId} — ${v.rarity}`"
              @click="selectedVariants.set(c.name, v)"
            >
              <img v-if="v.imageBase" :src="v.imageBase + '/low.png'" :alt="v.name" />
            </div>
          </div>
        </div>
      </div>

      <div v-if="status" class="beautify-status">{{ status }}</div>

      <!-- Action buttons -->
      <div class="beautify-action-row">
        <button class="beautify-action-btn secondary" @click="emit('close')">Cancel</button>
        <button
          v-if="showCandidates"
          class="beautify-action-btn primary"
          :disabled="loading"
          @click="applyManualSelections"
        >Apply</button>
        <button
          v-else
          class="beautify-action-btn primary"
          :disabled="loading"
          @click="handleAction"
        >{{ actionLabel }}</button>
      </div>
    </div>
  </div>
</template>
