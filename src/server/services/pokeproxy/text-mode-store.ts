/**
 * Text-mode override persistence — lets the user force a specific brightness
 * mode (dark/light) per card when the auto-detection picks the wrong one.
 *
 * Stored in data/text-mode-overrides.json keyed by cardId:
 *   { "sv01-001": { "textMode": "dark", "hpTextMode": "light" } }
 *
 * Either field may be absent — absent means "use auto-detection". Mirrors the
 * font-size-store pattern (env-var path override + load + watchFile).
 */

import { readFileSync, writeFileSync, watchFile, statSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export type TextMode = "dark" | "light";

export interface TextModeOverride {
  textMode?: TextMode;
  hpTextMode?: TextMode;
}

const STORE_PATH = process.env.TEXT_MODE_OVERRIDE_STORE_PATH
  ?? join(import.meta.dir, "../../../../data/text-mode-overrides.json");

let overrides: Record<string, TextModeOverride> = {};
let lastMtime = 0;

function isValidMode(v: unknown): v is TextMode {
  return v === "dark" || v === "light";
}

function sanitize(raw: unknown): Record<string, TextModeOverride> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, TextModeOverride> = {};
  for (const [cardId, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const norm: TextModeOverride = {};
    if (isValidMode(e.textMode)) norm.textMode = e.textMode;
    if (isValidMode(e.hpTextMode)) norm.hpTextMode = e.hpTextMode;
    if (norm.textMode || norm.hpTextMode) out[cardId] = norm;
  }
  return out;
}

function load() {
  try {
    if (!existsSync(STORE_PATH)) {
      overrides = {};
      return;
    }
    const raw = readFileSync(STORE_PATH, "utf-8");
    overrides = sanitize(JSON.parse(raw));
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

/** Look up the override for a card. Returns an empty object if none stored. */
export function getTextModeOverride(cardId: string): TextModeOverride {
  reloadIfChanged();
  return { ...(overrides[cardId] ?? {}) };
}

/** All overrides — used by tests and (potentially) bulk-list endpoints. */
export function getAllTextModeOverrides(): Record<string, TextModeOverride> {
  reloadIfChanged();
  const out: Record<string, TextModeOverride> = {};
  for (const [k, v] of Object.entries(overrides)) out[k] = { ...v };
  return out;
}

/** Merge-update a card's override. Pass `null` for a field to clear it.
 *  If both fields end up unset, the card is removed from the store entirely. */
export function saveTextModeOverride(
  cardId: string,
  patch: { textMode?: TextMode | null; hpTextMode?: TextMode | null },
): TextModeOverride {
  reloadIfChanged();
  const current: TextModeOverride = { ...(overrides[cardId] ?? {}) };

  if (patch.textMode === null) delete current.textMode;
  else if (isValidMode(patch.textMode)) current.textMode = patch.textMode;

  if (patch.hpTextMode === null) delete current.hpTextMode;
  else if (isValidMode(patch.hpTextMode)) current.hpTextMode = patch.hpTextMode;

  if (!current.textMode && !current.hpTextMode) {
    delete overrides[cardId];
  } else {
    overrides[cardId] = current;
  }

  writeFileSync(STORE_PATH, JSON.stringify(overrides, null, 2) + "\n");
  lastMtime = statSync(STORE_PATH).mtimeMs;
  return { ...current };
}

/** Wipe the entire store (file + memory). Used by tests' beforeEach. */
export function resetTextModeOverrides(): void {
  overrides = {};
  lastMtime = 0;
  try {
    if (existsSync(STORE_PATH)) {
      unlinkSync(STORE_PATH);
    }
  } catch {}
}
