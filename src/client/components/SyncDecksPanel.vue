<script setup lang="ts">
import { ref, computed } from "vue";
import type { DeckSummary } from "../../shared/types/deck.js";

type Phase = "connect" | "pick" | "result";
type Strategy = "skip" | "overwrite" | "duplicate";

interface ImportResult {
  imported: string[];
  skipped: string[];
  overwritten: string[];
  errors: { deckId: string; message: string }[];
}

const phase = ref<Phase>("connect");

const url = ref("");
const email = ref("");
const password = ref("");

const connecting = ref(false);
const connectError = ref<string | null>(null);

const remoteDecks = ref<DeckSummary[]>([]);
const selected = ref<Set<string>>(new Set());
const strategy = ref<Strategy>("skip");
const importing = ref(false);
const importError = ref<string | null>(null);
const result = ref<ImportResult | null>(null);

const allSelected = computed(() =>
  remoteDecks.value.length > 0 && remoteDecks.value.every((d) => selected.value.has(d.id))
);

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = await res.json() as { error?: string };
      if (err?.error) message = err.error;
    } catch {}
    throw new Error(message);
  }
  return await res.json() as T;
}

async function handleConnect() {
  if (!url.value.trim() || !email.value.trim() || !password.value) return;
  connecting.value = true;
  connectError.value = null;
  try {
    const data = await postJson<{ decks: DeckSummary[]; url: string }>("/api/admin/sync/list", {
      url: url.value,
      email: email.value,
      password: password.value,
    });
    remoteDecks.value = data.decks;
    url.value = data.url;
    selected.value = new Set();
    phase.value = "pick";
  } catch (e) {
    connectError.value = e instanceof Error ? e.message : String(e);
  }
  connecting.value = false;
}

function toggle(id: string) {
  const next = new Set(selected.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selected.value = next;
}

function selectAll() {
  selected.value = new Set(remoteDecks.value.map((d) => d.id));
}

function selectNone() {
  selected.value = new Set();
}

async function handleImport() {
  if (selected.value.size === 0) return;
  importing.value = true;
  importError.value = null;
  try {
    const data = await postJson<ImportResult>("/api/admin/sync/import", {
      url: url.value,
      email: email.value,
      password: password.value,
      deckIds: [...selected.value],
      strategy: strategy.value,
    });
    result.value = data;
    phase.value = "result";
  } catch (e) {
    importError.value = e instanceof Error ? e.message : String(e);
  }
  importing.value = false;
}

function backToConnect() {
  phase.value = "connect";
  password.value = "";
  remoteDecks.value = [];
  selected.value = new Set();
}

function syncMore() {
  phase.value = "pick";
  result.value = null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function deckName(id: string): string {
  return remoteDecks.value.find((d) => d.id === id)?.name ?? id;
}
</script>

<template>
  <div class="sync-panel">
    <!-- CONNECT -->
    <div v-if="phase === 'connect'" class="sync-section">
      <h3 class="section-title">Connect to a remote server</h3>
      <p class="hint">
        Log in to another DecklistGen instance with your credentials there. The password is
        used once to establish a session and is never stored.
      </p>
      <div class="form-stack">
        <label class="field">
          <span class="field-label">Server URL</span>
          <input
            v-model="url"
            type="text"
            placeholder="https://decklistgen.example.com"
            class="form-input"
            autocomplete="url"
            @keydown.enter="handleConnect"
          />
        </label>
        <label class="field">
          <span class="field-label">Email</span>
          <input
            v-model="email"
            type="email"
            placeholder="you@example.com"
            class="form-input"
            autocomplete="username"
            @keydown.enter="handleConnect"
          />
        </label>
        <label class="field">
          <span class="field-label">Password</span>
          <input
            v-model="password"
            type="password"
            placeholder="password on remote server"
            class="form-input"
            autocomplete="current-password"
            @keydown.enter="handleConnect"
          />
        </label>
        <button
          class="form-submit"
          :disabled="connecting || !url.trim() || !email.trim() || !password"
          @click="handleConnect"
        >{{ connecting ? "Connecting..." : "Connect" }}</button>
        <div v-if="connectError" class="form-error">{{ connectError }}</div>
      </div>
    </div>

    <!-- PICK -->
    <div v-else-if="phase === 'pick'" class="sync-section">
      <div class="pick-header">
        <div>
          <h3 class="section-title">Pick decks to import</h3>
          <p class="hint subtle">From <code class="src-url">{{ url }}</code></p>
        </div>
        <button class="link-btn" @click="backToConnect">&larr; Back</button>
      </div>

      <div v-if="remoteDecks.length === 0" class="empty-state">
        No decks found on the remote server.
      </div>

      <template v-else>
        <div class="select-controls">
          <button class="link-btn" @click="selectAll" :disabled="allSelected">Select all</button>
          <span class="dot">·</span>
          <button class="link-btn" @click="selectNone" :disabled="selected.size === 0">Select none</button>
          <span class="count">{{ selected.size }} of {{ remoteDecks.length }} selected</span>
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
              v-for="deck in remoteDecks"
              :key="deck.id"
              :class="{ 'row-selected': selected.has(deck.id) }"
              @click="toggle(deck.id)"
            >
              <td class="col-check">
                <input
                  type="checkbox"
                  :checked="selected.has(deck.id)"
                  @click.stop="toggle(deck.id)"
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
            @click="handleImport"
          >{{ importing ? "Importing..." : `Import ${selected.size} selected` }}</button>
          <div v-if="importError" class="form-error">{{ importError }}</div>
        </div>
      </template>
    </div>

    <!-- RESULT -->
    <div v-else-if="phase === 'result' && result" class="sync-section">
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
        <button class="form-submit" @click="syncMore">Pick more decks</button>
        <button class="link-btn" @click="backToConnect">Connect to a different server</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sync-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #e0e0e0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 6px 0;
}

.hint {
  color: #7f8fa6;
  font-size: 12px;
  margin: 0 0 14px 0;
  line-height: 1.5;
}

.hint.subtle {
  margin: 2px 0 0 0;
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 480px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 11px;
  color: #7f8fa6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.form-input {
  padding: 8px 10px;
  background: #1a1a2e;
  border: 1px solid #0f3460;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 13px;
  outline: none;
}

.form-input:focus {
  border-color: #e94560;
}

.form-submit {
  align-self: flex-start;
  padding: 8px 18px;
  background: #e94560;
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.form-submit:hover:not(:disabled) {
  background: #d13553;
}

.form-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-error {
  margin-top: 4px;
  background: rgba(233, 69, 96, 0.15);
  color: #e94560;
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 12px;
}

.pick-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 12px;
}

.src-url {
  font-family: monospace;
  font-size: 11px;
  color: #7fb3d3;
  background: #1a1a2e;
  padding: 2px 6px;
  border-radius: 3px;
}

.link-btn {
  background: none;
  border: none;
  color: #7fb3d3;
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 3px;
}

.link-btn:hover:not(:disabled) {
  background: rgba(127, 179, 211, 0.1);
}

.link-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.select-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #7f8fa6;
  margin-bottom: 10px;
}

.dot {
  color: #0f3460;
}

.count {
  margin-left: auto;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.admin-table th {
  text-align: left;
  padding: 6px 10px;
  color: #7f8fa6;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  border-bottom: 1px solid #0f3460;
}

.admin-table td {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(15, 52, 96, 0.4);
  vertical-align: middle;
}

.admin-table tbody tr {
  cursor: pointer;
  transition: background 0.1s;
}

.admin-table tbody tr:hover {
  background: rgba(15, 52, 96, 0.4);
}

.admin-table tbody tr.row-selected {
  background: rgba(233, 69, 96, 0.12);
}

.col-check {
  width: 32px;
}

.col-check input {
  accent-color: #e94560;
  cursor: pointer;
}

.user-name {
  color: #e0e0e0;
  font-weight: 500;
}

.date-cell {
  color: #7f8fa6;
  white-space: nowrap;
}

.strategy-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  margin-top: 8px;
  border-top: 1px solid rgba(15, 52, 96, 0.6);
}

.radio {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #e0e0e0;
  font-size: 12px;
  cursor: pointer;
}

.radio input[type="radio"] {
  accent-color: #e94560;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.empty-state {
  color: #7f8fa6;
  font-size: 13px;
  text-align: center;
  padding: 24px;
}

.result-stats {
  list-style: none;
  padding: 0;
  margin: 0 0 16px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 13px;
  color: #e0e0e0;
}

.result-stats strong {
  color: #e94560;
  font-size: 16px;
  margin-right: 4px;
}

.error-list {
  background: rgba(233, 69, 96, 0.08);
  border: 1px solid rgba(233, 69, 96, 0.3);
  border-radius: 4px;
  padding: 10px 14px;
  margin-bottom: 16px;
}

.error-title {
  font-size: 11px;
  font-weight: 600;
  color: #e94560;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 6px 0;
}

.error-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 12px;
  color: #e0e0e0;
}

.error-list li {
  padding: 3px 0;
}
</style>
