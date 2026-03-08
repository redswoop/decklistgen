/**
 * Energy palette persistence — stores custom color overrides in data/energy-palettes.json.
 * Falls back to compiled defaults from constants.ts when no file exists.
 */

import { readFileSync, writeFileSync, watchFile, statSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { ENERGY_COLORS_DARK, ENERGY_COLORS_LIGHT } from "./constants.js";
import type { EnergyPalette } from "./constants.js";

const PALETTES_PATH = join(import.meta.dir, "../../../../data/energy-palettes.json");

/** Letter-to-name mapping for expanding single-letter keys to full names */
const LETTER_NAME_MAP: [string, string][] = [
  ["G", "Grass"], ["R", "Fire"], ["W", "Water"], ["L", "Lightning"], ["P", "Psychic"],
  ["F", "Fighting"], ["D", "Darkness"], ["M", "Metal"], ["Y", "Fairy"], ["N", "Dragon"], ["C", "Colorless"],
];

interface StoredPalettes {
  dark?: Record<string, string>;
  light?: Record<string, string>;
}

let stored: StoredPalettes = {};
let lastMtime = 0;

function load() {
  try {
    if (!existsSync(PALETTES_PATH)) {
      stored = {};
      return;
    }
    const raw = readFileSync(PALETTES_PATH, "utf-8");
    stored = JSON.parse(raw) as StoredPalettes;
  } catch {
    stored = {};
  }
}

function reloadIfChanged() {
  try {
    if (!existsSync(PALETTES_PATH)) {
      if (lastMtime !== 0) {
        stored = {};
        lastMtime = 0;
      }
      return;
    }
    const mt = statSync(PALETTES_PATH).mtimeMs;
    if (mt !== lastMtime) {
      lastMtime = mt;
      load();
    }
  } catch {}
}

// Initial load
load();
try {
  if (existsSync(PALETTES_PATH)) {
    lastMtime = statSync(PALETTES_PATH).mtimeMs;
  }
} catch {}

// Watch for external edits
watchFile(PALETTES_PATH, { interval: 2000 }, () => {
  reloadIfChanged();
});

/** Expand letter-keyed overrides over a full default palette, producing both letter and name keys */
function expand(defaults: EnergyPalette, overrides: Record<string, string> | undefined): EnergyPalette {
  const result: EnergyPalette = { ...defaults };
  if (!overrides) return result;
  for (const [letter, name] of LETTER_NAME_MAP) {
    if (letter in overrides) {
      result[letter] = overrides[letter];
      result[name] = overrides[letter];
    }
  }
  return result;
}

/** Get dark palette (for standard cards) with any stored overrides merged in */
export function getDarkPalette(): EnergyPalette {
  reloadIfChanged();
  return expand(ENERGY_COLORS_DARK, stored.dark);
}

/** Get light palette (for full-art cards) with any stored overrides merged in */
export function getLightPalette(): EnergyPalette {
  reloadIfChanged();
  return expand(ENERGY_COLORS_LIGHT, stored.light);
}

/** Get raw letter-keyed palettes only (for API responses) */
export function getRawPalettes(): { dark: Record<string, string>; light: Record<string, string> } {
  reloadIfChanged();
  const dark: Record<string, string> = {};
  const light: Record<string, string> = {};
  const darkExpanded = expand(ENERGY_COLORS_DARK, stored.dark);
  const lightExpanded = expand(ENERGY_COLORS_LIGHT, stored.light);
  for (const [letter] of LETTER_NAME_MAP) {
    dark[letter] = darkExpanded[letter];
    light[letter] = lightExpanded[letter];
  }
  return { dark, light };
}

/** Save custom palettes (letter-keyed) */
export function savePalettes(dark: Record<string, string>, light: Record<string, string>): void {
  stored = { dark, light };
  writeFileSync(PALETTES_PATH, JSON.stringify(stored, null, 2) + "\n");
  lastMtime = statSync(PALETTES_PATH).mtimeMs;
}

/** Reset to defaults by removing the file */
export function resetPalettes(): void {
  stored = {};
  lastMtime = 0;
  try {
    if (existsSync(PALETTES_PATH)) {
      unlinkSync(PALETTES_PATH);
    }
  } catch {}
}
