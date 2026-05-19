<script setup lang="ts">
/** Left-rail editor for font-size tokens. Loads from /gallery/font-sizes,
 *  tracks dirty state, and emits @saved so the orchestrator can bump
 *  svgCacheBust to refresh the grid. */
import { ref, computed, onMounted } from "vue";
import { api } from "../../lib/client.js";

const emit = defineEmits<{ saved: []; reset: [] }>();

const defaults = ref<Record<string, number>>({});
const overrides = ref<Record<string, number>>({});
const edited = ref<Record<string, string>>({});
const loading = ref(false);
const status = ref("");

const HIDDEN_KEYS = new Set(["default"]);
const visibleKeys = computed(() =>
  Object.keys(defaults.value).filter((k) => !HIDDEN_KEYS.has(k)),
);

async function load() {
  loading.value = true;
  try {
    const data = await api.getFontSizes();
    defaults.value = data.defaults;
    overrides.value = data.current;
    const e: Record<string, string> = {};
    for (const k of Object.keys(data.defaults)) {
      e[k] = String(data.current[k] ?? data.defaults[k]);
    }
    edited.value = e;
    status.value = "";
  } catch (e) {
    status.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function isOverridden(key: string): boolean {
  if (!(key in overrides.value)) return false;
  return overrides.value[key] !== defaults.value[key];
}
function isEdited(key: string): boolean {
  const ev = Number(edited.value[key]);
  const effective = overrides.value[key] ?? defaults.value[key];
  return ev !== effective;
}

const hasUnsaved = computed(() =>
  Object.keys(defaults.value).some((k) => isEdited(k)),
);

async function save() {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(edited.value)) {
    const n = Number(v);
    if (!isNaN(n) && n !== defaults.value[k]) out[k] = n;
  }
  status.value = "Saving…";
  try {
    await api.saveFontSizes(out);
    overrides.value = out;
    status.value = "Saved";
    emit("saved");
  } catch (e) {
    status.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function reset() {
  status.value = "Resetting…";
  try {
    await api.resetFontSizes();
    overrides.value = {};
    const e: Record<string, string> = {};
    for (const k of Object.keys(defaults.value)) e[k] = String(defaults.value[k]);
    edited.value = e;
    status.value = "Reset";
    emit("reset");
  } catch (e) {
    status.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}
</script>

<template>
  <div class="fse">
    <div v-if="loading" class="fse-loading">Loading…</div>
    <template v-else>
      <table class="fse-table">
        <tbody>
          <tr
            v-for="k in visibleKeys"
            :key="k"
            :class="{ 'fse-overridden': isOverridden(k), 'fse-edited': isEdited(k) }"
          >
            <td class="fse-token">{{ k }}</td>
            <td class="fse-default">{{ defaults[k] }}</td>
            <td class="fse-value">
              <input
                type="number"
                :value="edited[k]"
                min="1"
                max="200"
                @input="(e: Event) => edited[k] = (e.target as HTMLInputElement).value"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <div class="fse-actions">
        <button class="btn btn-save-fs" :disabled="!hasUnsaved" @click="save">Save</button>
        <button class="btn btn-reset-fs" @click="reset">Reset</button>
        <span v-if="status" class="fse-status">{{ status }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.fse-loading { color: #888; font-size: 12px; padding: 8px 0; }

.fse-table {
  width: 100%;
  font-size: 11px;
  border-collapse: collapse;
}
.fse-table td {
  padding: 3px 4px;
  vertical-align: middle;
}
.fse-token { color: #aaa; font-family: monospace; }
.fse-default { color: #555; font-family: monospace; text-align: right; width: 32px; }
.fse-value { text-align: right; width: 64px; }
.fse-value input {
  width: 56px;
  background: #0d1117;
  color: #fff;
  border: 1px solid #333;
  border-radius: 3px;
  padding: 2px 4px;
  font-family: monospace;
  font-size: 11px;
  text-align: right;
}
.fse-overridden .fse-token { color: #f6e05e; }
.fse-edited .fse-token { color: #f39c12; font-weight: 700; }
.fse-edited .fse-value input { border-color: #f39c12; }

.fse-actions {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.btn {
  padding: 5px 12px;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.btn:hover { opacity: 0.85; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-save-fs { background: #276749; color: #9ae6b4; }
.btn-reset-fs { background: #9b2c2c; color: #fed7d7; }
.fse-status { font-size: 11px; color: #9ae6b4; }
</style>
