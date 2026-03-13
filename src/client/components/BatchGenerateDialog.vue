<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { api } from "../lib/client.js";
import { generateCleanImage } from "../composables/usePokeproxy.js";
import { useToast } from "../composables/useToast.js";
import type { DeckCard } from "../../shared/types/deck.js";

const props = defineProps<{
  cards: DeckCard[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const toast = useToast();

type BatchMode = "missing" | "stale" | "all";

interface GenInfo {
  hasClean: boolean;
  hasComposite: boolean;
  hasSvg: boolean;
  skip?: boolean;
  isStale?: boolean;
  staleSummary?: string;
}

const loading = ref(true);
const submitting = ref(false);
const genInfo = ref<Record<string, GenInfo>>({});

// Unique card IDs from the deck
const cardIds = computed(() => [...new Set(props.cards.map((dc) => dc.card.id))]);

onMounted(async () => {
  try {
    genInfo.value = await api.pokeproxyBatchGenInfo(cardIds.value);
  } catch {
    toast.error("Failed to load generation info");
  } finally {
    loading.value = false;
  }
});

const skippedCount = computed(() =>
  cardIds.value.filter((id) => genInfo.value[id]?.skip).length
);

const nonSkipped = computed(() =>
  cardIds.value.filter((id) => !genInfo.value[id]?.skip)
);

const missingIds = computed(() =>
  nonSkipped.value.filter((id) => {
    const info = genInfo.value[id];
    return info && !info.hasClean && !info.hasComposite;
  })
);

const staleIds = computed(() =>
  nonSkipped.value.filter((id) => genInfo.value[id]?.isStale)
);

async function submit(mode: BatchMode) {
  submitting.value = true;
  let ids: string[];
  let force = false;

  switch (mode) {
    case "missing":
      ids = missingIds.value;
      break;
    case "stale":
      ids = staleIds.value;
      force = true;
      break;
    case "all":
      ids = nonSkipped.value;
      force = true;
      break;
  }

  let queued = 0;
  for (const cardId of ids) {
    try {
      await generateCleanImage(cardId, force);
      queued++;
    } catch {}
  }

  toast.info(`${queued} card${queued !== 1 ? "s" : ""} queued for generation`);
  emit("close");
}
</script>

<template>
  <div class="dialog-overlay" @click.self="emit('close')">
    <div class="dialog batch-gen-dialog">
      <h3>Generate Proxies</h3>

      <div v-if="loading" class="batch-gen-loading">Loading card status...</div>

      <template v-else>
        <div class="batch-gen-options">
          <button
            class="batch-gen-option"
            :disabled="missingIds.length === 0 || submitting"
            @click="submit('missing')"
          >
            <span class="batch-gen-label">Generate Missing</span>
            <span class="batch-gen-count">{{ missingIds.length }} cards</span>
            <span class="batch-gen-desc">Cards without generated artwork</span>
          </button>

          <button
            class="batch-gen-option"
            :disabled="staleIds.length === 0 || submitting"
            @click="submit('stale')"
          >
            <span class="batch-gen-label">Regenerate Stale</span>
            <span class="batch-gen-count">{{ staleIds.length }} cards</span>
            <span class="batch-gen-desc">Cards whose prompt or rule has changed</span>
          </button>

          <button
            class="batch-gen-option"
            :disabled="nonSkipped.length === 0 || submitting"
            @click="submit('all')"
          >
            <span class="batch-gen-label">Force Regenerate All</span>
            <span class="batch-gen-count">{{ nonSkipped.length }} cards</span>
            <span class="batch-gen-desc">Re-generate every card in this deck</span>
          </button>
        </div>

        <p v-if="skippedCount > 0" class="batch-gen-skip-note">
          {{ skippedCount }} card{{ skippedCount !== 1 ? "s" : "" }} skipped (basic energy)
        </p>

        <div class="dialog-actions">
          <button @click="emit('close')" :disabled="submitting">Cancel</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.batch-gen-dialog {
  width: 420px;
}

.batch-gen-loading {
  padding: 2rem 0;
  text-align: center;
  color: var(--color-muted, #9ca3af);
}

.batch-gen-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.batch-gen-option {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--color-surface, #1a1a2e);
  border: 1px solid var(--color-border, #0f3460);
  border-radius: 6px;
  color: var(--color-text, #e0e0e0);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s;
}

.batch-gen-option:hover:not(:disabled) {
  border-color: var(--color-accent, #e94560);
}

.batch-gen-option:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.batch-gen-label {
  font-weight: 600;
  font-size: 0.95rem;
}

.batch-gen-count {
  font-size: 0.8rem;
  color: var(--color-muted, #9ca3af);
  margin-left: auto;
}

.batch-gen-desc {
  width: 100%;
  font-size: 0.8rem;
  color: var(--color-muted, #9ca3af);
}

.batch-gen-skip-note {
  font-size: 0.8rem;
  color: var(--color-muted, #9ca3af);
  margin: 0 0 0.5rem;
}
</style>
