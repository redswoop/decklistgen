<script setup lang="ts">
// Pick phase: choose which remote decks to import and the on-conflict strategy.
// Selection state is owned by the composable and passed in; this leaf is
// presentational and emits intent. Styling: namespaced .sync-panel in sync.css.
import type { DeckSummary } from "../../../shared/types/deck.js";
import type { SyncStrategy } from "../../composables/useSyncDecks.js";
import { formatDate } from "../../lib/date-format.js";

defineProps<{
  url: string;
  decks: DeckSummary[];
  selected: Set<string>;
  allSelected: boolean;
  importing: boolean;
  importError: string | null;
}>();

const strategy = defineModel<SyncStrategy>("strategy", { required: true });

const emit = defineEmits<{
  back: [];
  toggle: [id: string];
  selectAll: [];
  selectNone: [];
  import: [];
}>();
</script>

<template>
  <div class="sync-section">
    <div class="pick-header">
      <div>
        <h3 class="section-title">Pick decks to import</h3>
        <p class="hint subtle">From <code class="src-url">{{ url }}</code></p>
      </div>
      <button class="link-btn" @click="emit('back')">&larr; Back</button>
    </div>

    <div v-if="decks.length === 0" class="empty-state">
      No decks found on the remote server.
    </div>

    <template v-else>
      <div class="select-controls">
        <button class="link-btn" @click="emit('selectAll')" :disabled="allSelected">Select all</button>
        <span class="dot">·</span>
        <button class="link-btn" @click="emit('selectNone')" :disabled="selected.size === 0">Select none</button>
        <span class="count">{{ selected.size }} of {{ decks.length }} selected</span>
      </div>

      <table class="admin-table">
        <thead>
          <tr>
            <th class="col-check"></th>
            <th>Name</th>
            <th>Cards</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="deck in decks"
            :key="deck.id"
            :class="{ 'row-selected': selected.has(deck.id) }"
            @click="emit('toggle', deck.id)"
          >
            <td class="col-check">
              <input
                type="checkbox"
                :checked="selected.has(deck.id)"
                @click.stop="emit('toggle', deck.id)"
              />
            </td>
            <td class="user-name">{{ deck.name }}</td>
            <td>{{ deck.cardCount }}</td>
            <td class="date-cell">{{ formatDate(deck.updatedAt) }}</td>
          </tr>
        </tbody>
      </table>

      <div class="strategy-row">
        <span class="field-label">If a deck already exists locally:</span>
        <label class="radio">
          <input type="radio" v-model="strategy" value="skip" /> Skip
        </label>
        <label class="radio">
          <input type="radio" v-model="strategy" value="overwrite" /> Overwrite
        </label>
        <label class="radio">
          <input type="radio" v-model="strategy" value="duplicate" /> Import as new
        </label>
      </div>

      <div class="action-row">
        <button
          class="form-submit"
          :disabled="importing || selected.size === 0"
          :title="selected.size === 0 ? 'Select at least one deck' : ''"
          @click="emit('import')"
        >{{ importing ? "Importing..." : `Import ${selected.size} selected` }}</button>
        <div v-if="importError" class="form-error">{{ importError }}</div>
      </div>
    </template>
  </div>
</template>
