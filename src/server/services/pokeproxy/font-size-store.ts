/**
 * Font size persistence — stores custom overrides in data/font-sizes.json.
 * Falls back to compiled defaults from @shared/constants/font-sizes.ts when no file exists.
 */

import { readFileSync, writeFileSync, watchFile, statSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { FONT_SIZES } from "../../../shared/constants/font-sizes.js";

const STORE_PATH = join(import.meta.dir, "../../../../data/font-sizes.json");

let overrides: Record<string, number> = {};
let lastMtime = 0;

/** Rename keys from old token names to new ones */
const KEY_MIGRATIONS: Record<string, string> = {
  stageLine: "evolvesFrom",
  "stageLine.fullart": "evolvesFrom.fullart",
  "stageLine.vstar": "evolvesFrom.vstar",
};

function migrateKeys(obj: Record<string, number>): boolean {
  let changed = false;
  for (const [oldKey, newKey] of Object.entries(KEY_MIGRATIONS)) {
    if (oldKey in obj && !(newKey in obj)) {
      obj[newKey] = obj[oldKey];
      delete obj[oldKey];
      changed = true;
    }
  }
  return changed;
}

function load() {
  try {
    if (!existsSync(STORE_PATH)) {
      overrides = {};
      return;
    }
    const raw = readFileSync(STORE_PATH, "utf-8");
    overrides = JSON.parse(raw) as Record<string, number>;
    if (migrateKeys(overrides)) {
      writeFileSync(STORE_PATH, JSON.stringify(overrides, null, 2) + "\n");
    }
  } catch {
    overrides = {};
  }
}

function reloadIfChanged() {
  try {
    if (!existsSync(STORE_PATH)) {
      if (lastMtime !== 0) {
        overrides = {};
        lastMtime = 0;
      }
      return;
    }
    const mt = statSync(STORE_PATH).mtimeMs;
    if (mt !== lastMtime) {
      lastMtime = mt;
      load();
    }
  } catch {}
}

// Initial load
load();
try {
  if (existsSync(STORE_PATH)) {
    lastMtime = statSync(STORE_PATH).mtimeMs;
  }
} catch {}

// Watch for external edits
watchFile(STORE_PATH, { interval: 2000 }, () => {
  reloadIfChanged();
});

/** Get effective font sizes (defaults merged with overrides) */
export function getEffectiveFontSizes(): Record<string, number> {
  reloadIfChanged();
  return { ...FONT_SIZES, ...overrides };
}

/** Get raw overrides only (for API responses) */
export function getFontSizeOverrides(): Record<string, number> {
  reloadIfChanged();
  return { ...overrides };
}

/** Save custom font size overrides */
export function saveFontSizes(newOverrides: Record<string, number>): void {
  overrides = newOverrides;
  writeFileSync(STORE_PATH, JSON.stringify(overrides, null, 2) + "\n");
  lastMtime = statSync(STORE_PATH).mtimeMs;
}

/** Reset to defaults by removing the file */
export function resetFontSizes(): void {
  overrides = {};
  lastMtime = 0;
  try {
    if (existsSync(STORE_PATH)) {
      unlinkSync(STORE_PATH);
    }
  } catch {}
}
