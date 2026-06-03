<script setup lang="ts">
// Result phase: import counts + any per-deck errors. deckName is passed in from
// the composable so error rows can show names rather than ids. Styling:
// namespaced .sync-panel rules in styles/sync.css.
import type { SyncImportResult } from "../../composables/useSyncDecks.js";

defineProps<{
  result: SyncImportResult;
  deckName: (id: string) => string;
}>();

const emit = defineEmits<{
  syncMore: [];
  back: [];
}>();
</script>

<template>
  <div class="sync-section">
    <h3 class="section-title">Sync complete</h3>
    <ul class="result-stats">
      <li><strong>{{ result.imported.length }}</strong> imported</li>
      <li><strong>{{ result.skipped.length }}</strong> skipped (already exist)</li>
      <li><strong>{{ result.overwritten.length }}</strong> overwritten</li>
      <li v-if="result.errors.length"><strong>{{ result.errors.length }}</strong> errors</li>
    </ul>

    <div v-if="result.errors.length" class="error-list">
      <h4 class="error-title">Errors</h4>
      <ul>
        <li v-for="err in result.errors" :key="err.deckId">
          <code class="src-url">{{ deckName(err.deckId) }}</code> — {{ err.message }}
        </li>
      </ul>
    </div>

    <div class="action-row">
      <button class="form-submit" @click="emit('syncMore')">Pick more decks</button>
      <button class="link-btn" @click="emit('back')">Connect to a different server</button>
    </div>
  </div>
</template>
