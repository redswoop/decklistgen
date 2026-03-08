import { ref, watch } from "vue";
import type { ProxySettings } from "../../shared/types/proxy-settings.js";

const STORAGE_KEY = "decklistgen-proxy-settings";

function loadAll(): Record<string, ProxySettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveAll(data: Record<string, ProxySettings>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const allSettings = ref<Record<string, ProxySettings>>(loadAll());

watch(allSettings, (val) => saveAll(val), { deep: true });

export function useProxySettings() {
  function getSettings(setCode: string, localId: string): ProxySettings {
    const key = `${setCode}-${localId}`;
    return allSettings.value[key] ?? {};
  }

  function updateSettings(setCode: string, localId: string, patch: Partial<ProxySettings>) {
    const key = `${setCode}-${localId}`;
    const existing = allSettings.value[key] ?? {};
    allSettings.value = { ...allSettings.value, [key]: { ...existing, ...patch } };
  }

  function clearSettings(setCode: string, localId: string) {
    const key = `${setCode}-${localId}`;
    const copy = { ...allSettings.value };
    delete copy[key];
    allSettings.value = copy;
  }

  return { getSettings, updateSettings, clearSettings };
}
