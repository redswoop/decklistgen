<script setup lang="ts">
/** Modal picker for swapping a reference card slot with a different card.
 *
 *  Searches via the existing `/api/cards?nameSearch=…` endpoint. Limits to
 *  60 hits so the dropdown stays scannable. Emits `pick` (replacement chosen)
 *  or `clear` (restore the slot to its TEST_CARDS default).
 */
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { api } from "../../lib/client.js";
import type { Card } from "../../../shared/types/card.js";

const props = defineProps<{
  /** Slot label (e.g. "PokemonBasic") — shown in the picker header. */
  slotLabel: string;
  /** The original TEST_CARDS card id this slot occupies. */
  slotKey: string;
  /** The currently-rendered card id (override target, or slotKey when no
   *  override is active). Highlighted in the results list. */
  currentCardId: string;
  /** Whether an override is currently in effect — controls the Clear button. */
  hasOverride: boolean;
}>();

const emit = defineEmits<{
  close: [];
  pick: [cardId: string];
  clear: [];
}>();

const query = ref("");
const results = ref<Card[]>([]);
const loading = ref(false);
const error = ref("");

let searchToken = 0;

watch(query, async (q) => {
  const trimmed = q.trim();
  if (trimmed.length < 2) {
    results.value = [];
    error.value = "";
    return;
  }
  const myToken = ++searchToken;
  loading.value = true;
  error.value = "";
  try {
    const resp = await api.getCards({ nameSearch: trimmed }, 1, 60);
    if (myToken !== searchToken) return;
    results.value = resp.cards;
  } catch (e) {
    if (myToken !== searchToken) return;
    error.value = e instanceof Error ? e.message : String(e);
    results.value = [];
  } finally {
    if (myToken === searchToken) loading.value = false;
  }
});

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    emit("close");
    e.preventDefault();
  }
}
onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));

const sortedResults = computed(() => {
  // Push the currently-selected card to the top so the user can see what
  // they're replacing without scrolling.
  const cur = results.value.find((c) => c.id === props.currentCardId);
  if (!cur) return results.value;
  return [cur, ...results.value.filter((c) => c.id !== props.currentCardId)];
});
</script>

<template>
  <Teleport to="body">
    <div class="picker-overlay" @click.self="emit('close')">
      <div class="picker-modal">
        <div class="picker-head">
          <div class="picker-head-text">
            <div class="picker-eyebrow">Swap slot</div>
            <div class="picker-slot">{{ slotLabel }}</div>
            <div class="picker-current">currently: {{ currentCardId }}</div>
          </div>
          <button class="picker-close" title="Close" @click="emit('close')">&times;</button>
        </div>

        <input
          v-model="query"
          class="picker-input"
          type="text"
          placeholder="Search card name…"
          autofocus
        />

        <div class="picker-body">
          <div v-if="loading" class="picker-msg">Searching…</div>
          <div v-else-if="error" class="picker-msg picker-err">Search failed: {{ error }}</div>
          <div v-else-if="query.trim().length < 2" class="picker-msg">
            Type at least 2 characters to search.
          </div>
          <div v-else-if="sortedResults.length === 0" class="picker-msg">
            No matches for “{{ query.trim() }}”.
          </div>
          <ul v-else class="picker-results">
            <li
              v-for="card in sortedResults"
              :key="card.id"
              :class="['picker-result', card.id === currentCardId && 'picker-result-current']"
              @click="emit('pick', card.id)"
            >
              <div class="picker-result-main">
                <span class="picker-result-name">{{ card.name }}</span>
                <span class="picker-result-id">{{ card.id }}</span>
              </div>
              <div class="picker-result-meta">
                {{ card.setName }} · {{ card.category }}{{ card.stage ? ` · ${card.stage}` : "" }}
              </div>
            </li>
          </ul>
        </div>

        <div class="picker-actions">
          <button
            type="button"
            class="picker-clear"
            :disabled="!hasOverride"
            :title="hasOverride ? 'Restore this slot to its default reference card' : 'No override set'"
            @click="emit('clear')"
          >Reset to default</button>
          <button type="button" class="picker-cancel" @click="emit('close')">Cancel</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.picker-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 1100;
  display: flex; align-items: center; justify-content: center;
  padding: 32px;
}
.picker-modal {
  background: #131826;
  border: 1px solid #2a2a40;
  border-radius: 10px;
  width: min(560px, 100%);
  max-height: calc(100vh - 64px);
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
}
.picker-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 14px 18px 10px;
  border-bottom: 1px solid #1f2436;
}
.picker-head-text { min-width: 0; }
.picker-eyebrow {
  font-size: 10px; font-weight: 700; color: #f39c12;
  text-transform: uppercase; letter-spacing: 0.08em;
}
.picker-slot { font-size: 16px; font-weight: 700; color: #fff; margin-top: 2px; }
.picker-current { font-size: 11px; color: #777; font-family: monospace; margin-top: 2px; }
.picker-close {
  background: none; border: none; color: #888; font-size: 22px;
  line-height: 1; padding: 0 4px; cursor: pointer;
}
.picker-close:hover { color: #fff; }
.picker-input {
  margin: 12px 18px 8px;
  background: #0d1117; border: 1px solid #2d3748;
  color: #e0e0e0; border-radius: 6px;
  padding: 8px 10px; font-size: 13px; outline: none;
}
.picker-input:focus { border-color: #f39c12; }
.picker-body { flex: 1; overflow-y: auto; padding: 0 6px 8px; }
.picker-msg { padding: 24px 18px; color: #666; font-size: 12px; text-align: center; }
.picker-err { color: #fc8181; }
.picker-results { list-style: none; margin: 0; padding: 0; }
.picker-result {
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  margin: 1px 6px;
}
.picker-result:hover { background: #1d2335; }
.picker-result-current {
  background: #2d2a14;
  outline: 1px solid #f39c12;
}
.picker-result-current:hover { background: #3a3618; }
.picker-result-main { display: flex; justify-content: space-between; gap: 8px; }
.picker-result-name { color: #fff; font-size: 13px; font-weight: 600; }
.picker-result-id { color: #888; font-family: monospace; font-size: 11px; }
.picker-result-meta { color: #888; font-size: 11px; margin-top: 2px; }
.picker-actions {
  display: flex; justify-content: space-between; gap: 8px;
  padding: 10px 18px 14px;
  border-top: 1px solid #1f2436;
}
.picker-clear, .picker-cancel {
  background: #1f2436; color: #aaa;
  border: 1px solid #2d3748; border-radius: 6px;
  padding: 6px 14px; font-size: 12px; font-weight: 600;
  cursor: pointer;
}
.picker-clear:hover:not(:disabled) { background: #553c14; color: #f39c12; }
.picker-clear:disabled { opacity: 0.4; cursor: not-allowed; }
.picker-cancel:hover { background: #2a3247; color: #fff; }
</style>
