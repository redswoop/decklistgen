/**
 * Template-set store — loads builtin and user sets from disk, layers in
 * shadow overrides for builtins, and exposes a Map for the resolver.
 *
 * Storage layout (see plan doc):
 *   <builtin-templates-path>/<set-id>/        — shipped sets, read at runtime
 *     set.json                                  manifest { id, name, description, extends? }
 *     <slot>.json                               slot template (filename = slotId)
 *     cards/<cardId>.json                       card-specific template
 *   <template-sets-path>/<set-id>/            — user sets, mutable
 *   <builtin-shadows-path>/<set-id>/          — production-mode overlays on builtins
 *     shadow.json                               { setId, createdAt, lastEditedAt, syncStatus }
 *     <slot>.json / cards/<cardId>.json
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { CardTemplate, LoadedSet, TemplateSetManifest, TemplateSetSummary } from "../../shared/types/template.js";
import {
  getBuiltinShadowsPath,
  getBuiltinTemplatesPath,
  getTemplateSetsPath,
} from "./template-config.js";

interface CacheEntry {
  loadedAt: number;
  sets: Map<string, LoadedSet>;
}

let cache: CacheEntry | null = null;

/** Invalidate the in-memory cache — call after any write to set files. */
export function clearTemplateSetCache(): void {
  cache = null;
}

/** Get all sets as a Map (id -> LoadedSet). Builds the cache on first call. */
export function getAllSets(): Map<string, LoadedSet> {
  if (!cache) cache = { loadedAt: Date.now(), sets: buildSets() };
  return cache.sets;
}

export function getSet(setId: string): LoadedSet | undefined {
  return getAllSets().get(setId);
}

export function listSetSummaries(): TemplateSetSummary[] {
  const summaries: TemplateSetSummary[] = [];
  for (const set of getAllSets().values()) {
    summaries.push({
      id: set.manifest.id,
      name: set.manifest.name,
      description: set.manifest.description,
      extends: set.manifest.extends,
      origin: set.origin,
      hasShadow: set.hasShadow,
      slotIds: Object.keys(set.slotTemplates).sort(),
      cardIds: Object.keys(set.cardTemplates).sort(),
    });
  }
  summaries.sort((a, b) => {
    if (a.origin !== b.origin) return a.origin === "builtin" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return summaries;
}

export function isBuiltin(setId: string): boolean {
  return getSet(setId)?.origin === "builtin";
}

function buildSets(): Map<string, LoadedSet> {
  const sets = new Map<string, LoadedSet>();

  for (const dir of listSubdirs(getBuiltinTemplatesPath())) {
    const set = readSetDir(dir, "builtin");
    if (set) sets.set(set.manifest.id, set);
  }

  for (const dir of listSubdirs(getTemplateSetsPath())) {
    const set = readSetDir(dir, "user");
    if (set) sets.set(set.manifest.id, set);
  }

  for (const dir of listSubdirs(getBuiltinShadowsPath())) {
    const shadowSetId = basename(dir);
    const builtin = sets.get(shadowSetId);
    if (!builtin || builtin.origin !== "builtin") continue;
    const shadow = readSetDir(dir, "builtin", { isShadow: true });
    if (!shadow) continue;
    for (const [slot, tmpl] of Object.entries(shadow.slotTemplates)) {
      builtin.slotTemplates[slot] = tmpl;
    }
    for (const [card, tmpl] of Object.entries(shadow.cardTemplates)) {
      builtin.cardTemplates[card] = tmpl;
    }
    builtin.hasShadow = true;
  }

  return sets;
}

function listSubdirs(parent: string): string[] {
  if (!existsSync(parent)) return [];
  try {
    return readdirSync(parent)
      .map((name) => join(parent, name))
      .filter((p) => {
        try { return statSync(p).isDirectory(); } catch { return false; }
      });
  } catch {
    return [];
  }
}

function readSetDir(
  dir: string,
  origin: "builtin" | "user",
  opts: { isShadow?: boolean } = {},
): LoadedSet | null {
  const manifestPath = join(dir, opts.isShadow ? "shadow.json" : "set.json");
  let manifest: TemplateSetManifest;
  if (existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    } catch { return null; }
  } else if (opts.isShadow) {
    manifest = { id: basename(dir), name: basename(dir) };
  } else {
    return null;
  }

  const slotTemplates: Record<string, CardTemplate> = {};
  const cardTemplates: Record<string, CardTemplate> = {};

  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    if (name === "set.json" || name === "shadow.json") continue;
    const slotId = name.slice(0, -".json".length);
    const tmpl = readTemplateFile(join(dir, name));
    if (tmpl) slotTemplates[slotId] = tmpl;
  }

  const cardsDir = join(dir, "cards");
  if (existsSync(cardsDir)) {
    for (const name of readdirSync(cardsDir)) {
      if (!name.endsWith(".json")) continue;
      const cardId = name.slice(0, -".json".length);
      const tmpl = readTemplateFile(join(cardsDir, name));
      if (tmpl) cardTemplates[cardId] = tmpl;
    }
  }

  return { manifest, origin, slotTemplates, cardTemplates };
}

function readTemplateFile(path: string): CardTemplate | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as CardTemplate;
  } catch {
    return null;
  }
}
