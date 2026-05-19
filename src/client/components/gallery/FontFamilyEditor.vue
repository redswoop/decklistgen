<script setup lang="ts">
/** Left-rail editor for per-role font choices. */
import { ref, onMounted } from "vue";
import { api } from "../../lib/client.js";

const emit = defineEmits<{ saved: []; reset: [] }>();

interface FontOption { id: string; displayName: string; license: string; titleOnly: boolean; weights: number[] }
interface FontPreset { id: string; displayName: string; description: string; selection: Record<string, string> }

const ROLES: { id: string; label: string; titleOnly: boolean }[] = [
  { id: "title",         label: "Title",         titleOnly: true  },
  { id: "body",          label: "Body",          titleOnly: false },
  { id: "hp",            label: "HP / damage",   titleOnly: true  },
  { id: "infobar",       label: "Info bar",      titleOnly: false },
  { id: "pokedex",       label: "Pokédex",       titleOnly: false },
  { id: "trainerHeader", label: "Trainer header",titleOnly: true  },
];

const available = ref<FontOption[]>([]);
const presets = ref<FontPreset[]>([]);
const current = ref<Record<string, string>>({});
const loading = ref(false);
const status = ref("");

async function load() {
  loading.value = true;
  try {
    const data = await api.getFontFamily();
    available.value = data.available;
    presets.value = data.presets ?? [];
    current.value = { ...data.current };
    status.value = "";
  } catch (e) {
    status.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function fontsFor(roleTitleOnly: boolean): FontOption[] {
  return roleTitleOnly ? available.value : available.value.filter((f) => !f.titleOnly);
}

function applyPreset(p: FontPreset) {
  current.value = { ...p.selection };
  status.value = `Loaded "${p.displayName}" — click Save to apply.`;
}

async function save() {
  status.value = "Saving…";
  try {
    const data = await api.saveFontFamily(current.value);
    current.value = data.current;
    status.value = "Saved";
    emit("saved");
  } catch (e) {
    status.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function reset() {
  status.value = "Resetting…";
  try {
    const data = await api.resetFontFamily();
    current.value = data.current;
    status.value = "Reset";
    emit("reset");
  } catch (e) {
    status.value = `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}
</script>

<template>
  <div class="ffe">
    <div v-if="loading" class="ffe-loading">Loading…</div>
    <template v-else>
      <div v-if="presets.length" class="ffe-presets">
        <button
          v-for="p in presets"
          :key="p.id"
          class="ffe-preset"
          :title="p.description"
          @click="applyPreset(p)"
        >{{ p.displayName }}</button>
      </div>
      <div class="ffe-roles">
        <div v-for="role in ROLES" :key="role.id" class="ffe-row">
          <label :for="`ffe-${role.id}`">{{ role.label }}</label>
          <select :id="`ffe-${role.id}`" v-model="current[role.id]">
            <option v-for="f in fontsFor(role.titleOnly)" :key="f.id" :value="f.id">{{ f.displayName }}</option>
          </select>
        </div>
      </div>
      <div class="ffe-actions">
        <button class="btn btn-save-fs" @click="save">Save</button>
        <button class="btn btn-reset-fs" @click="reset">Reset</button>
        <span v-if="status" class="ffe-status">{{ status }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ffe-loading { color: #888; font-size: 12px; padding: 8px 0; }

.ffe-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}
.ffe-preset {
  background: #0f3460;
  color: #e0e0e0;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
}
.ffe-preset:hover { border-color: #5a8cd6; }

.ffe-roles { display: flex; flex-direction: column; gap: 6px; }
.ffe-row {
  display: grid;
  grid-template-columns: 90px 1fr;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}
.ffe-row label { color: #aaa; }
.ffe-row select {
  background: #0d1117;
  color: #fff;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 3px 4px;
  font-size: 11px;
  min-width: 0;
}

.ffe-actions {
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
.ffe-status { font-size: 11px; color: #9ae6b4; }
</style>
