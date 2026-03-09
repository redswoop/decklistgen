/**
 * Server-side card proxy settings store.
 *
 * Persists to data/card-settings.json. File-watched with hot-reload,
 * following the same pattern as prompt-db.ts.
 */

import { readFileSync, writeFileSync, watchFile, statSync, existsSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ProxySettings } from "../../shared/types/proxy-settings.js";

const SETTINGS_PATH = join(import.meta.dir, "../../../data/card-settings.json");

let settings: Record<string, ProxySettings> = {};
let lastMtime = 0;

function ensureDir() {
  const dir = join(import.meta.dir, "../../../data");
  mkdirSync(dir, { recursive: true });
}

function loadSettings() {
  try {
    if (!existsSync(SETTINGS_PATH)) {
      settings = {};
      return;
    }
    const raw = readFileSync(SETTINGS_PATH, "utf-8");
    settings = JSON.parse(raw);
    console.log(`[card-settings] Loaded settings for ${Object.keys(settings).length} cards`);
  } catch (e: any) {
    console.error(`[card-settings] Failed to load: ${e.message}`);
    settings = {};
  }
}

function reloadIfChanged() {
  try {
    if (!existsSync(SETTINGS_PATH)) return;
    const mt = statSync(SETTINGS_PATH).mtimeMs;
    if (mt !== lastMtime) {
      lastMtime = mt;
      loadSettings();
    }
  } catch {}
}

function persist() {
  ensureDir();
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
  lastMtime = statSync(SETTINGS_PATH).mtimeMs;
}

// Initial load
loadSettings();
try {
  if (existsSync(SETTINGS_PATH)) {
    lastMtime = statSync(SETTINGS_PATH).mtimeMs;
  }
} catch {}

// Watch for external changes
watchFile(SETTINGS_PATH, { interval: 2000 }, () => {
  reloadIfChanged();
});

export function getCardSettings(cardId: string): ProxySettings {
  reloadIfChanged();
  return settings[cardId] ?? {};
}

export function updateCardSettings(cardId: string, patch: Partial<ProxySettings>): ProxySettings {
  reloadIfChanged();
  const existing = settings[cardId] ?? {};
  const merged = { ...existing, ...patch };
  settings[cardId] = merged;
  persist();
  return merged;
}

export function deleteCardSettings(cardId: string): boolean {
  reloadIfChanged();
  if (!(cardId in settings)) return false;
  delete settings[cardId];
  persist();
  return true;
}

export function getAllCardSettings(): Record<string, ProxySettings> {
  reloadIfChanged();
  return { ...settings };
}

export function hasCardSettings(cardId: string): boolean {
  reloadIfChanged();
  return cardId in settings;
}
