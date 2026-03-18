/**
 * Gradient persistence — loads named gradient presets from data/gradients.json.
 * Re-reads on file change (same pattern as font-size-store.ts).
 */

import { readFileSync, watchFile, statSync, existsSync } from "node:fs";
import { join } from "node:path";

export type GradientStop = { offset: string; opacity: number };

export type GradientDef = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: GradientStop[];
};

const STORE_PATH = join(import.meta.dir, "../../../../data/gradients.json");

let gradients: Record<string, GradientDef> = {};
let lastMtime = 0;

function load() {
  try {
    if (!existsSync(STORE_PATH)) {
      gradients = {};
      return;
    }
    const raw = readFileSync(STORE_PATH, "utf-8");
    gradients = JSON.parse(raw) as Record<string, GradientDef>;
  } catch {
    gradients = {};
  }
}

function reloadIfChanged() {
  try {
    if (!existsSync(STORE_PATH)) {
      if (lastMtime !== 0) {
        gradients = {};
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

/** Get a named gradient definition, or undefined if not found. */
export function getGradient(name: string): GradientDef | undefined {
  reloadIfChanged();
  return gradients[name];
}
