/**
 * Template-set API — replaces the old /gallery/editor/templates route with
 * a set-aware surface. Reads are public; writes require requireAuthorized.
 *
 * Phase 1 surface (this file):
 *   GET    /                                list set summaries
 *   GET    /policy                          report current BUILTIN_EDIT_MODE
 *   GET    /:setId                          get one set summary
 *   GET    /:setId/templates/:slotId        resolved slot template (walks extends)
 *   GET    /:setId/cards/:cardId            resolved card template
 *   POST   /:setId/templates/:slotId        save slot template
 *   DELETE /:setId/templates/:slotId        remove slot template
 *   POST   /:setId/cards/:cardId            save card template
 *   DELETE /:setId/cards/:cardId            remove card template
 *
 * Writes to builtin sets route through BUILTIN_EDIT_MODE:
 *   direct  → write the source file under BUILTIN_TEMPLATES_PATH
 *   shadow  → require X-Confirm-Shadow-Edit header; write to BUILTIN_SHADOWS_PATH
 *   locked  → 403
 *
 * Phase 2+ adds: fork, import, export, set-metadata, shadow management.
 */

import { Hono } from "hono";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AppEnv } from "../types.js";
import type { CardTemplate, LoadedSet } from "../../shared/types/template.js";
import { requireAuthorized } from "../middleware/auth.js";
import { DEFAULT_SET_ID } from "../../shared/utils/resolve-template.js";
import {
  clearTemplateSetCache,
  getAllSets,
  getSet,
  listSetSummaries,
} from "../services/template-set-store.js";
import {
  getBuiltinEditMode,
  getBuiltinShadowsPath,
  getBuiltinTemplatesPath,
  getTemplateSetsPath,
} from "../services/template-config.js";

const ID_RE = /^[a-zA-Z0-9_-]+$/;
const CARD_ID_RE = /^[a-zA-Z0-9_.-]+$/;

function isValidId(s: string): boolean { return ID_RE.test(s); }
function isValidCardId(s: string): boolean { return CARD_ID_RE.test(s) && !s.includes(".."); }

export const templateSetsRouter = new Hono<AppEnv>();

templateSetsRouter.get("/", (c) => {
  return c.json(listSetSummaries());
});

templateSetsRouter.get("/policy", (c) => {
  return c.json({
    builtinEditMode: getBuiltinEditMode(),
    globalSetId: DEFAULT_SET_ID,
  });
});

templateSetsRouter.get("/:setId", (c) => {
  const setId = c.req.param("setId");
  if (!isValidId(setId)) return c.json({ error: "Invalid set id" }, 400);
  const set = getSet(setId);
  if (!set) return c.json({ error: "Set not found" }, 404);
  return c.json({
    id: set.manifest.id,
    name: set.manifest.name,
    description: set.manifest.description,
    extends: set.manifest.extends,
    origin: set.origin,
    hasShadow: set.hasShadow,
    slotIds: Object.keys(set.slotTemplates).sort(),
    cardIds: Object.keys(set.cardTemplates).sort(),
  });
});

templateSetsRouter.get("/:setId/templates/:slotId", (c) => {
  const setId = c.req.param("setId");
  const slotId = c.req.param("slotId");
  if (!isValidId(setId) || !isValidId(slotId)) return c.json({ error: "Invalid id" }, 400);
  const tmpl = resolveSlotWithExtends(setId, slotId);
  if (!tmpl) return c.json({ error: "Template not found" }, 404);
  return c.json(tmpl);
});

templateSetsRouter.get("/:setId/cards/:cardId", (c) => {
  const setId = c.req.param("setId");
  const cardId = c.req.param("cardId");
  if (!isValidId(setId) || !isValidCardId(cardId)) return c.json({ error: "Invalid id" }, 400);
  const tmpl = resolveCardWithExtends(setId, cardId);
  if (!tmpl) return c.json({ error: "Card template not found" }, 404);
  return c.json(tmpl);
});

templateSetsRouter.post("/:setId/templates/:slotId", requireAuthorized, async (c) => {
  const setId = c.req.param("setId");
  const slotId = c.req.param("slotId");
  if (!isValidId(setId) || !isValidId(slotId)) return c.json({ error: "Invalid id" }, 400);
  const set = getSet(setId);
  if (!set) return c.json({ error: "Set not found" }, 404);

  const body = await c.req.json() as Partial<CardTemplate>;
  if (!body.name || !body.elements) return c.json({ error: "Missing name or elements" }, 400);
  const template: CardTemplate = {
    id: slotId,
    name: body.name,
    description: body.description,
    elements: body.elements,
  };

  const target = resolveWritePath(set, slotId, "slot", c.req.header("x-confirm-shadow-edit"));
  if (target.error) return c.json({ error: target.error }, target.status ?? 403);

  mkdirSync(dirname(target.path!), { recursive: true });
  writeFileSync(target.path!, JSON.stringify(template, null, 2));
  if (target.shadowManifestPath) writeShadowManifest(target.shadowManifestPath, setId, c.get("user")?.email);
  clearTemplateSetCache();
  return c.json({ ok: true, setId, slotId, mode: target.mode });
});

templateSetsRouter.delete("/:setId/templates/:slotId", requireAuthorized, (c) => {
  const setId = c.req.param("setId");
  const slotId = c.req.param("slotId");
  if (!isValidId(setId) || !isValidId(slotId)) return c.json({ error: "Invalid id" }, 400);
  const set = getSet(setId);
  if (!set) return c.json({ error: "Set not found" }, 404);

  const target = resolveWritePath(set, slotId, "slot", c.req.header("x-confirm-shadow-edit"));
  if (target.error) return c.json({ error: target.error }, target.status ?? 403);

  if (!existsSync(target.path!)) return c.json({ error: "Template not found" }, 404);
  unlinkSync(target.path!);
  if (target.shadowManifestPath) cleanShadowDirIfEmpty(target.shadowManifestPath);
  clearTemplateSetCache();
  return c.json({ ok: true });
});

templateSetsRouter.post("/:setId/cards/:cardId", requireAuthorized, async (c) => {
  const setId = c.req.param("setId");
  const cardId = c.req.param("cardId");
  if (!isValidId(setId) || !isValidCardId(cardId)) return c.json({ error: "Invalid id" }, 400);
  const set = getSet(setId);
  if (!set) return c.json({ error: "Set not found" }, 404);

  const body = await c.req.json() as Partial<CardTemplate>;
  if (!body.name || !body.elements) return c.json({ error: "Missing name or elements" }, 400);
  const template: CardTemplate = {
    id: cardId,
    name: body.name,
    description: body.description,
    elements: body.elements,
  };

  const target = resolveWritePath(set, cardId, "card", c.req.header("x-confirm-shadow-edit"));
  if (target.error) return c.json({ error: target.error }, target.status ?? 403);

  mkdirSync(dirname(target.path!), { recursive: true });
  writeFileSync(target.path!, JSON.stringify(template, null, 2));
  if (target.shadowManifestPath) writeShadowManifest(target.shadowManifestPath, setId, c.get("user")?.email);
  clearTemplateSetCache();
  return c.json({ ok: true, setId, cardId, mode: target.mode });
});

templateSetsRouter.delete("/:setId/cards/:cardId", requireAuthorized, (c) => {
  const setId = c.req.param("setId");
  const cardId = c.req.param("cardId");
  if (!isValidId(setId) || !isValidCardId(cardId)) return c.json({ error: "Invalid id" }, 400);
  const set = getSet(setId);
  if (!set) return c.json({ error: "Set not found" }, 404);

  const target = resolveWritePath(set, cardId, "card", c.req.header("x-confirm-shadow-edit"));
  if (target.error) return c.json({ error: target.error }, target.status ?? 403);

  if (!existsSync(target.path!)) return c.json({ error: "Template not found" }, 404);
  unlinkSync(target.path!);
  if (target.shadowManifestPath) cleanShadowDirIfEmpty(target.shadowManifestPath);
  clearTemplateSetCache();
  return c.json({ ok: true });
});

interface WriteTarget {
  path?: string;
  mode?: "direct" | "shadow" | "user";
  shadowManifestPath?: string;
  error?: string;
  status?: 400 | 403 | 412 | 501;
}

function resolveWritePath(
  set: LoadedSet,
  itemId: string,
  kind: "slot" | "card",
  confirmHeader: string | undefined,
): WriteTarget {
  const fileName = `${itemId}.json`;
  const cardsSeg = kind === "card" ? "cards" : "";

  if (set.origin === "user") {
    const path = join(getTemplateSetsPath(), set.manifest.id, cardsSeg, fileName);
    return { path, mode: "user" };
  }

  // origin === "builtin"
  const mode = getBuiltinEditMode();
  if (mode === "locked") {
    return { error: "Builtin set is locked (BUILTIN_EDIT_MODE=locked)", status: 403 };
  }
  if (mode === "direct") {
    const path = join(getBuiltinTemplatesPath(), set.manifest.id, cardsSeg, fileName);
    return { path, mode: "direct" };
  }
  // mode === "shadow"
  if (confirmHeader !== "i-understand") {
    return {
      error: "Shadow edit requires header X-Confirm-Shadow-Edit: i-understand",
      status: 412,
    };
  }
  const shadowDir = join(getBuiltinShadowsPath(), set.manifest.id);
  const path = join(shadowDir, cardsSeg, fileName);
  const shadowManifestPath = join(shadowDir, "shadow.json");
  return { path, mode: "shadow", shadowManifestPath };
}

function writeShadowManifest(manifestPath: string, setId: string, editorEmail?: string): void {
  let manifest: Record<string, unknown> = {};
  if (existsSync(manifestPath)) {
    try { manifest = JSON.parse(readFileSync(manifestPath, "utf-8")); } catch {}
  }
  const now = new Date().toISOString();
  manifest.setId = setId;
  manifest.createdAt ??= now;
  manifest.lastEditedAt = now;
  if (editorEmail) manifest.editor = editorEmail;
  manifest.syncStatus = "pending";
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

function cleanShadowDirIfEmpty(manifestPath: string): void {
  // If the shadow dir has nothing left except shadow.json, remove the whole dir
  // so the builtin reverts cleanly.
  const dir = dirname(manifestPath);
  try {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir);
    const cardsDir = join(dir, "cards");
    let cardsEmpty = true;
    if (existsSync(cardsDir)) {
      try { cardsEmpty = readdirSync(cardsDir).length === 0; } catch {}
    }
    const nonManifest = entries.filter((e) => e !== "shadow.json" && e !== "cards");
    if (nonManifest.length === 0 && cardsEmpty) {
      // Remove cards dir if present and empty, then shadow.json, then the set dir.
      if (existsSync(cardsDir)) {
        try { rmdirSync(cardsDir); } catch {}
      }
      try { unlinkSync(manifestPath); } catch {}
      try { rmdirSync(dir); } catch {}
    }
  } catch {}
}

/** Walks the extends chain to find the first set that defines this slot. */
function resolveSlotWithExtends(setId: string, slotId: string): CardTemplate | null {
  const sets = getAllSets();
  const seen = new Set<string>();
  let curId: string | undefined = setId;
  while (curId && !seen.has(curId)) {
    seen.add(curId);
    const cur = sets.get(curId);
    if (!cur) {
      curId = curId === DEFAULT_SET_ID ? undefined : DEFAULT_SET_ID;
      continue;
    }
    const t = cur.slotTemplates[slotId];
    if (t) return t;
    curId = cur.manifest.extends;
  }
  return null;
}

function resolveCardWithExtends(setId: string, cardId: string): CardTemplate | null {
  const sets = getAllSets();
  const seen = new Set<string>();
  let curId: string | undefined = setId;
  while (curId && !seen.has(curId)) {
    seen.add(curId);
    const cur = sets.get(curId);
    if (!cur) {
      curId = curId === DEFAULT_SET_ID ? undefined : DEFAULT_SET_ID;
      continue;
    }
    const t = cur.cardTemplates[cardId];
    if (t) return t;
    curId = cur.manifest.extends;
  }
  return null;
}

