import { reactive } from "vue";
import type { ProxySettings } from "../../shared/types/proxy-settings.js";
import { api } from "../lib/client.js";

// In-memory cache of settings fetched from server
const cache = reactive(new Map<string, ProxySettings>());

// Track pending fetches to avoid duplicate requests
const pending = new Map<string, Promise<ProxySettings>>();

async function fetchSettings(cardId: string): Promise<ProxySettings> {
  if (cache.has(cardId)) return cache.get(cardId)!;
  if (pending.has(cardId)) return pending.get(cardId)!;

  const promise = api.getCardSettings(cardId).then((settings) => {
    cache.set(cardId, settings);
    pending.delete(cardId);
    return settings;
  }).catch(() => {
    pending.delete(cardId);
    return {} as ProxySettings;
  });

  pending.set(cardId, promise);
  return promise;
}

export function useProxySettings() {
  function getSettings(cardId: string): ProxySettings {
    if (!cache.has(cardId)) {
      // Kick off async fetch, return empty for now
      fetchSettings(cardId);
      return {};
    }
    return cache.get(cardId)!;
  }

  async function updateSettings(cardId: string, patch: Partial<ProxySettings>) {
    // Optimistic update
    const existing = cache.get(cardId) ?? {};
    cache.set(cardId, { ...existing, ...patch });
    try {
      const result = await api.updateCardSettings(cardId, patch);
      cache.set(cardId, result);
    } catch {
      // Revert on failure
      cache.set(cardId, existing);
    }
  }

  async function clearSettings(cardId: string) {
    cache.delete(cardId);
    try {
      await api.deleteCardSettings(cardId);
    } catch {}
  }

  return { getSettings, updateSettings, clearSettings };
}
