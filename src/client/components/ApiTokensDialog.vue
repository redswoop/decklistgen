<script setup lang="ts">
// User menu → API Tokens. Mint / list / revoke bearer tokens for the MCP
// endpoint. The plaintext is shown exactly once, right after minting, with the
// two ways to connect (header for Claude Code / Inspector, URL for claude.ai
// custom connectors).
import { ref, computed, onMounted } from "vue";
import { api } from "../lib/client.js";
import type { ApiToken } from "../../shared/types/user.js";
import { formatDate } from "../lib/date-format.js";

const emit = defineEmits<{ close: [] }>();

const tokens = ref<ApiToken[]>([]);
const loading = ref(true);
const label = ref("");
const creating = ref(false);
const error = ref<string | null>(null);
const fresh = ref<(ApiToken & { token: string }) | null>(null);
const copied = ref<string | null>(null);

const origin = typeof window !== "undefined" ? window.location.origin : "";
const mcpUrl = computed(() => `${origin}/api/mcp`);
const tokenUrl = computed(() => (fresh.value ? `${origin}/api/mcp/t/${fresh.value.token}` : ""));
const claudeCodeCmd = computed(() =>
  fresh.value
    ? `claude mcp add --transport http decklistgen ${mcpUrl.value} --header "Authorization: Bearer ${fresh.value.token}"`
    : "",
);

async function load() {
  loading.value = true;
  try {
    tokens.value = (await api.listApiTokens()).tokens;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function mint() {
  const l = label.value.trim();
  if (!l) return;
  creating.value = true;
  error.value = null;
  try {
    fresh.value = await api.createApiToken(l);
    label.value = "";
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    creating.value = false;
  }
}

async function revoke(t: ApiToken) {
  if (!confirm(`Revoke "${t.label}"? Anything using it will stop working immediately.`)) return;
  try {
    await api.revokeApiToken(t.id);
    if (fresh.value?.id === t.id) fresh.value = null;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

async function copy(text: string, key: string) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = key;
    setTimeout(() => { if (copied.value === key) copied.value = null; }, 1500);
  } catch {
    error.value = "Clipboard unavailable — select and copy manually.";
  }
}

onMounted(load);
</script>

<template>
  <div class="dialog-overlay" @click="emit('close')">
    <div class="dialog api-tokens-dialog" @click.stop>
      <h3>API Tokens</h3>
      <p class="api-tokens-sub">
        Bearer tokens let MCP clients (Claude Code, claude.ai connectors, scripts) act as you:
        list and edit your decks, run the simulators, queue artwork.
      </p>

      <form class="api-tokens-create" @submit.prevent="mint">
        <input
          v-model="label"
          type="text"
          class="api-tokens-input"
          placeholder="Label, e.g. laptop claude code"
          maxlength="80"
          autofocus
        />
        <button type="submit" class="btn-primary" :disabled="!label.trim() || creating" :title="label.trim() ? 'Mint a new token' : 'Enter a label first'">
          {{ creating ? "Minting…" : "Mint token" }}
        </button>
      </form>

      <div v-if="fresh" class="api-tokens-fresh">
        <div class="api-tokens-fresh-head">New token “{{ fresh.label }}” — copy it now, it won't be shown again.</div>
        <div class="api-tokens-row">
          <code class="api-tokens-code">{{ fresh.token }}</code>
          <button class="btn-secondary" @click="copy(fresh.token, 'token')">{{ copied === 'token' ? 'Copied' : 'Copy' }}</button>
        </div>
        <div class="api-tokens-howto">
          <div class="api-tokens-howto-label">Claude Code</div>
          <div class="api-tokens-row">
            <code class="api-tokens-code">{{ claudeCodeCmd }}</code>
            <button class="btn-secondary" @click="copy(claudeCodeCmd, 'cmd')">{{ copied === 'cmd' ? 'Copied' : 'Copy' }}</button>
          </div>
          <div class="api-tokens-howto-label">URL-only clients (claude.ai custom connector)</div>
          <div class="api-tokens-row">
            <code class="api-tokens-code">{{ tokenUrl }}</code>
            <button class="btn-secondary" @click="copy(tokenUrl, 'url')">{{ copied === 'url' ? 'Copied' : 'Copy' }}</button>
          </div>
        </div>
      </div>

      <div v-if="error" class="api-tokens-error">{{ error }}</div>

      <div class="api-tokens-list">
        <div v-if="loading" class="api-tokens-empty">Loading…</div>
        <div v-else-if="tokens.length === 0" class="api-tokens-empty">No tokens yet.</div>
        <table v-else class="api-tokens-table">
          <thead>
            <tr><th>Label</th><th>Created</th><th>Last used</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="t in tokens" :key="t.id">
              <td>{{ t.label }}</td>
              <td>{{ formatDate(t.createdAt) }}</td>
              <td>{{ t.lastUsedAt ? formatDate(t.lastUsedAt) : "never" }}</td>
              <td><button class="btn-danger api-tokens-revoke" title="Revoke this token" @click="revoke(t)">Revoke</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="dialog-actions">
        <button class="btn-secondary" @click="emit('close')">Close</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.api-tokens-dialog { width: min(720px, 94vw); }
.api-tokens-sub { color: #7f8fa6; font-size: 12px; margin: 0 0 12px; }
.api-tokens-create { display: flex; gap: 8px; margin-bottom: 12px; }
.api-tokens-input {
  flex: 1; padding: 6px 10px; background: #0f1b33; border: 1px solid #0f3460; border-radius: 4px;
  color: #e0e0e0; font-size: 13px;
}
.api-tokens-fresh {
  border: 1px solid #2ea043; background: rgba(46, 160, 67, 0.08); border-radius: 6px; padding: 10px; margin-bottom: 12px;
}
.api-tokens-fresh-head { font-size: 12px; color: #7ee787; margin-bottom: 8px; }
.api-tokens-row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
.api-tokens-code {
  flex: 1; font-size: 11px; padding: 6px 8px; background: #0b1428; border-radius: 4px; color: #e0e0e0;
  overflow-x: auto; white-space: nowrap;
}
.api-tokens-howto { margin-top: 8px; }
.api-tokens-howto-label { font-size: 11px; color: #7f8fa6; margin: 6px 0 2px; }
.api-tokens-error { color: #e94560; font-size: 12px; margin-bottom: 8px; }
.api-tokens-list { margin-bottom: 8px; }
.api-tokens-empty { color: #7f8fa6; font-size: 12px; padding: 8px 0; }
.api-tokens-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.api-tokens-table th { text-align: left; color: #7f8fa6; font-weight: 500; padding: 4px 6px; border-bottom: 1px solid #0f3460; }
.api-tokens-table td { padding: 6px; border-bottom: 1px solid #0f1b33; }
.api-tokens-revoke { padding: 2px 8px; font-size: 11px; }
.btn-primary, .btn-secondary, .btn-danger { padding: 6px 12px; border-radius: 4px; border: 1px solid #0f3460; cursor: pointer; font-size: 12px; }
.btn-primary { background: #e94560; border-color: #e94560; color: #fff; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary { background: transparent; color: #e0e0e0; }
.btn-danger { background: transparent; color: #e94560; border-color: #e94560; }
</style>
