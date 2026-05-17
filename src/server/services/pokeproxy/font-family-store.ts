/**
 * Font selection persistence — stores which font is used for title vs body
 * text in data/font-family.json. Falls back to DEFAULT_FONT_ID when no file
 * exists or a stored id isn't in the registry.
 *
 * Mirrors font-size-store.ts (load + watchFile + getEffective + save + reset).
 */

import { readFileSync, writeFileSync, watchFile, statSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { FONTS, DEFAULT_FONT_ID, FONT_ROLES, resolveFont, type FontRole } from "../../../shared/constants/fonts.js";

const STORE_PATH = join(import.meta.dir, "../../../../data/font-family.json");

export type FontSelection = Record<FontRole, string>;

const DEFAULT_SELECTION: FontSelection = FONT_ROLES.reduce((acc, role) => {
  acc[role] = DEFAULT_FONT_ID;
  return acc;
}, {} as FontSelection);

let overrides: Partial<FontSelection> = {};
let lastMtime = 0;

function load() {
  try {
    if (!existsSync(STORE_PATH)) {
      overrides = {};
      return;
    }
    const raw = readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<FontSelection>;
    overrides = {};
    for (const role of FONT_ROLES) {
      if (typeof parsed[role] === "string") overrides[role] = parsed[role];
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

load();
try {
  if (existsSync(STORE_PATH)) {
    lastMtime = statSync(STORE_PATH).mtimeMs;
  }
} catch {}

watchFile(STORE_PATH, { interval: 2000 }, () => {
  reloadIfChanged();
});

function validateId(id: string | undefined, fallback: string): string {
  if (id && FONTS[id]) return id;
  if (id && !FONTS[id]) {
    console.warn(`[font-family-store] Unknown font id "${id}", falling back to "${fallback}"`);
  }
  return fallback;
}

/** Get the effective font selection, with unknown ids snapped to the default. */
export function getFontSelection(): FontSelection {
  reloadIfChanged();
  const out = {} as FontSelection;
  for (const role of FONT_ROLES) {
    out[role] = validateId(overrides[role], DEFAULT_SELECTION[role]);
  }
  return out;
}

/** Get raw overrides only (for API responses — no validation applied). */
export function getFontSelectionOverrides(): Partial<FontSelection> {
  reloadIfChanged();
  return { ...overrides };
}

/** Get the compiled defaults. */
export function getFontSelectionDefaults(): FontSelection {
  return { ...DEFAULT_SELECTION };
}

/** Save selection overrides. Only known roles are persisted; unknown keys ignored. */
export function saveFontSelection(sel: Partial<FontSelection>): void {
  const next: Partial<FontSelection> = {};
  for (const role of FONT_ROLES) {
    if (typeof sel[role] === "string") next[role] = sel[role];
  }
  overrides = next;
  writeFileSync(STORE_PATH, JSON.stringify(overrides, null, 2) + "\n");
  lastMtime = statSync(STORE_PATH).mtimeMs;
}

/** CSS font-family stack for a role, resolved from the current selection. */
export function fontStack(role: FontRole): string {
  const sel = getFontSelection();
  const def = resolveFont(sel[role]);
  return `'${def.displayName}', ${def.cssStack}`;
}

/** Reset to defaults by removing the file. */
export function resetFontSelection(): void {
  overrides = {};
  lastMtime = 0;
  try {
    if (existsSync(STORE_PATH)) {
      unlinkSync(STORE_PATH);
    }
  } catch {}
}
