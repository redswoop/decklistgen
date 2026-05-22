<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useEditorApi } from "../../composables/useEditorApi.js";
import { useAuth } from "../../composables/useAuth.js";

const api = useEditorApi();
const { isAdmin } = useAuth();

interface ShadowSummary {
  setId: string;
  createdAt?: string;
  lastEditedAt?: string;
  editor?: string;
  syncStatus?: string;
  slotIds: string[];
  cardIds: string[];
}

const shadows = ref<ShadowSummary[]>([]);
const loaded = ref(false);

async function refresh() {
  if (!isAdmin.value) return;
  shadows.value = await api.listShadows();
  loaded.value = true;
}

onMounted(refresh);

const visible = computed(() => isAdmin.value && shadows.value.length > 0);

function onDownload() {
  window.location.href = api.exportShadowsUrl();
}

async function onClear(setId: string) {
  const ok = window.confirm(
    `Mark shadow for set "${setId}" as synced? This deletes the overlay; ` +
    `make sure you've already merged it into the source tree.`,
  );
  if (!ok) return;
  const result = await api.clearShadow(setId);
  if (!result.ok) {
    window.alert(`Clear failed: ${result.error ?? `HTTP ${result.status}`}`);
    return;
  }
  await refresh();
}

function fmtDate(s?: string): string {
  if (!s) return "?";
  try { return new Date(s).toLocaleString(); } catch { return s; }
}
</script>

<template>
  <div v-if="visible" class="shadow-banner">
    <span class="banner-icon">⚠</span>
    <span class="banner-text">
      {{ shadows.length }} shadow override{{ shadows.length === 1 ? '' : 's' }} pending sync to dev
    </span>
    <button class="banner-btn" @click="onDownload">Download bundle</button>
    <details class="banner-details">
      <summary>Details</summary>
      <ul>
        <li v-for="s in shadows" :key="s.setId">
          <strong>{{ s.setId }}</strong> — slots: [{{ s.slotIds.join(', ') || '—' }}], cards: [{{ s.cardIds.join(', ') || '—' }}]
          <br />
          <span class="meta">last edited {{ fmtDate(s.lastEditedAt) }} by {{ s.editor ?? 'unknown' }}</span>
          <button class="banner-btn clear-btn" @click="onClear(s.setId)">Mark synced</button>
        </li>
      </ul>
    </details>
  </div>
</template>

<style scoped>
.shadow-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #3a2615;
  border-bottom: 1px solid #c97a3a;
  color: #f5c896;
  padding: 6px 12px;
  font-size: 12px;
  flex-wrap: wrap;
}
.banner-icon { font-size: 14px; }
.banner-text { font-weight: bold; }
.banner-btn {
  background: #0f3460;
  color: #e0e0e0;
  border: 1px solid #4a9eff;
  border-radius: 3px;
  padding: 3px 10px;
  font-size: 11px;
  cursor: pointer;
}
.banner-btn:hover { background: #1a5276; }
.banner-details { font-size: 11px; }
.banner-details summary { cursor: pointer; opacity: 0.8; }
.banner-details ul { margin: 6px 0 0; padding-left: 16px; }
.banner-details li { margin-bottom: 4px; }
.meta { opacity: 0.7; }
.clear-btn { margin-left: 8px; border-color: #c97a3a; }
</style>
