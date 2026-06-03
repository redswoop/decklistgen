<script setup lang="ts">
// Thin controller for the admin deck-sync wizard. All state + the connect/import
// calls live in useSyncDecks; this component just routes the current phase to
// its leaf component. Styles live in styles/sync.css (namespaced .sync-panel).
import { useSyncDecks } from "../composables/useSyncDecks.js";
import SyncConnectForm from "./sync/SyncConnectForm.vue";
import SyncDeckPicker from "./sync/SyncDeckPicker.vue";
import SyncResultSummary from "./sync/SyncResultSummary.vue";

const {
  phase,
  url,
  email,
  password,
  connecting,
  connectError,
  remoteDecks,
  selected,
  strategy,
  importing,
  importError,
  result,
  allSelected,
  handleConnect,
  toggle,
  selectAll,
  selectNone,
  handleImport,
  backToConnect,
  syncMore,
  deckName,
} = useSyncDecks();
</script>

<template>
  <div class="sync-panel">
    <SyncConnectForm
      v-if="phase === 'connect'"
      v-model:url="url"
      v-model:email="email"
      v-model:password="password"
      :connecting="connecting"
      :error="connectError"
      @connect="handleConnect"
    />

    <SyncDeckPicker
      v-else-if="phase === 'pick'"
      :url="url"
      :decks="remoteDecks"
      :selected="selected"
      :all-selected="allSelected"
      :importing="importing"
      :import-error="importError"
      v-model:strategy="strategy"
      @back="backToConnect"
      @toggle="toggle"
      @select-all="selectAll"
      @select-none="selectNone"
      @import="handleImport"
    />

    <SyncResultSummary
      v-else-if="phase === 'result' && result"
      :result="result"
      :deck-name="deckName"
      @sync-more="syncMore"
      @back="backToConnect"
    />
  </div>
</template>
