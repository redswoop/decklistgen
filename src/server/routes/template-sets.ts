/**
 * Template-set API — replaces the old /gallery/editor/templates route with
 * a set-aware surface. Reads are public; writes require requireAuthorized.
 *
 * Surface:
 *   GET    /                                list set summaries
 *   GET    /policy                          report current BUILTIN_EDIT_MODE
 *   GET    /:setId                          get one set summary
 *   POST   /:setId/fork                     create a user set that extends :setId
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
 */

import { Hono } from "hono";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AppEnv } from "../types.js";
import type { CardTemplate, LoadedSet } from "../../shared/types/template.js";
import { requireAdmin, requireAuthorized } from "../middleware/auth.js";
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

templateSetsRouter.get("/builtin-shadows", requireAdmin, (c) => {
  const shadows = listShadowSummaries();
  return c.json(shadows);
});

templateSetsRouter.get("/builtin-shadows/export", requireAdmin, (c) => {
  const shadows = readAllShadows();
  const bundle = {
    exportedAt: new Date().toISOString(),
    shadows,
  };
  c.header("Content-Type", "application/json");
  c.header("Content-Disposition", `attachment; filename="builtin-shadows.json"`);
  return c.body(JSON.stringify(bundle, null, 2));
});

templateSetsRouter.delete("/builtin-shadows/:setId", requireAdmin, (c) => {
  const setId = c.req.param("setId");
  if (!isValidId(setId)) return c.json({ error: "Invalid set id" }, 400);
  const dir = join(getBuiltinShadowsPath(), setId);
  if (!existsSync(dir)) return c.json({ error: "Shadow not found" }, 404);
  rmSync(dir, { recursive: true, force: true });
  clearTemplateSetCache();
  return c.json({ ok: true });
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

templateSetsRouter.get("/:setId/export", (c) => {
  const setId = c.req.param("setId");
  if (!isValidId(setId)) return c.json({ error: "Invalid set id" }, 400);
  const set = getSet(setId);
  if (!set) return c.json({ error: "Set not found" }, 404);
  const bundle = {
    manifest: {
      id: set.manifest.id,
      name: set.manifest.name,
      description: set.manifest.description,
      extends: set.manifest.extends,
    },
    slots: { ...set.slotTemplates },
    cards: { ...set.cardTemplates },
  };
  c.header("Content-Type", "application/json");
  c.header("Content-Disposition", `attachment; filename="${setId}.template-set.json"`);
  return c.body(JSON.stringify(bundle, null, 2));
});

templateSetsRouter.post("/import", requireAuthorized, async (c) => {
  const body = await c.req.json().catch(() => null) as null | {
    manifest?: { id?: string; name?: string; description?: string; extends?: string };
    slots?: Record<string, CardTemplate>;
    cards?: Record<string, CardTemplate>;
    id?: string;
  };
  if (!body || !body.manifest) return c.json({ error: "Missing bundle or manifest" }, 400);

  const targetId = body.id ?? body.manifest.id;
  if (!targetId || !isValidId(targetId)) return c.json({ error: "Invalid or missing target id" }, 400);
  if (targetId === "builtin-shadows") return c.json({ error: "'builtin-shadows' is reserved" }, 400);
  if (!body.manifest.name) return c.json({ error: "Bundle manifest missing name" }, 400);
  if (getSet(targetId)) return c.json({ error: `Set '${targetId}' already exists` }, 409);

  const newDir = join(getTemplateSetsPath(), targetId);
  if (existsSync(newDir)) return c.json({ error: `Directory '${targetId}' already exists` }, 409);
  mkdirSync(newDir, { recursive: true });
  const manifest = {
    id: targetId,
    name: body.manifest.name,
    description: body.manifest.description,
    extends: body.manifest.extends,
  };
  writeFileSync(join(newDir, "set.json"), JSON.stringify(manifest, null, 2));

  for (const [slotId, tmpl] of Object.entries(body.slots ?? {})) {
    if (!isValidId(slotId)) continue;
    writeFileSync(join(newDir, `${slotId}.json`), JSON.stringify(tmpl, null, 2));
  }
  if (body.cards && Object.keys(body.cards).length > 0) {
    mkdirSync(join(newDir, "cards"), { recursive: true });
    for (const [cardId, tmpl] of Object.entries(body.cards)) {
      if (!isValidCardId(cardId)) continue;
      writeFileSync(join(newDir, "cards", `${cardId}.json`), JSON.stringify(tmpl, null, 2));
    }
  }

  clearTemplateSetCache();
  return c.json({ ok: true, id: targetId });
});

templateSetsRouter.post("/:setId", requireAuthorized, async (c) => {
  const setId = c.req.param("setId");
  if (!isValidId(setId)) return c.json({ error: "Invalid set id" }, 400);
  const set = getSet(setId);
  if (!set) return c.json({ error: "Set not found" }, 404);
  if (set.origin !== "user") return c.json({ error: "Builtin set metadata is read-only" }, 403);

  const body = await c.req.json().catch(() => ({})) as { name?: string; description?: string; extends?: string };
  const updated = {
    id: set.manifest.id,
    name: body.name ?? set.manifest.name,
    description: body.description ?? set.manifest.description,
    extends: body.extends === null ? undefined : (body.extends ?? set.manifest.extends),
  };
  writeFileSync(join(getTemplateSetsPath(), setId, "set.json"), JSON.stringify(updated, null, 2));
  clearTemplateSetCache();
  return c.json({ ok: true });
});

templateSetsRouter.delete("/:setId", requireAuthorized, (c) => {
  const setId = c.req.param("setId");
  if (!isValidId(setId)) return c.json({ error: "Invalid set id" }, 400);
  const set = getSet(setId);
  if (!set) return c.json({ error: "Set not found" }, 404);
  if (set.origin !== "user") return c.json({ error: "Builtin sets cannot be deleted" }, 403);
  const dir = join(getTemplateSetsPath(), setId);
  rmSync(dir, { recursive: true, force: true });
  clearTemplateSetCache();
  return c.json({ ok: true });
});

templateSetsRouter.post("/:setId/fork", requireAuthorized, async (c) => {
  const sourceSetId = c.req.param("setId");
  if (!isValidId(sourceSetId)) return c.json({ error: "Invalid source set id" }, 400);
  const source = getSet(sourceSetId);
  if (!source) return c.json({ error: "Source set not found" }, 404);

  const body = await c.req.json().catch(() => ({})) as { id?: string; name?: string; description?: string };
  if (!body.id || !body.name) return c.json({ error: "Missing id or name" }, 400);
  if (!isValidId(body.id)) return c.json({ error: "Invalid target id (alphanumeric, dashes, underscores)" }, 400);
  if (body.id === "builtin-shadows") return c.json({ error: "'builtin-shadows' is reserved" }, 400);
  if (getSet(body.id)) return c.json({ error: `Set '${body.id}' already exists` }, 409);

  const newDir = join(getTemplateSetsPath(), body.id);
  if (existsSync(newDir)) return c.json({ error: `Directory '${body.id}' already exists` }, 409);
  mkdirSync(newDir, { recursive: true });
  const manifest = {
    id: body.id,
    name: body.name,
    description: body.description,
    extends: sourceSetId,
  };
  writeFileSync(join(newDir, "set.json"), JSON.stringify(manifest, null, 2));
  clearTemplateSetCache();
  return c.json({ ok: true, id: body.id, extends: sourceSetId });
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

interface ShadowSummary {
  setId: string;
  createdAt?: string;
  lastEditedAt?: string;
  editor?: string;
  syncStatus?: string;
  slotIds: string[];
  cardIds: string[];
}

function listShadowSummaries(): ShadowSummary[] {
  const root = getBuiltinShadowsPath();
  if (!existsSync(root)) return [];
  const out: ShadowSummary[] = [];
  for (const entry of readdirSync(root)) {
    const dir = join(root, entry);
    let stat;
    try { stat = readdirSync(dir); } catch { continue; }
    let manifest: Record<string, unknown> = {};
    const manifestPath = join(dir, "shadow.json");
    if (existsSync(manifestPath)) {
      try { manifest = JSON.parse(readFileSync(manifestPath, "utf-8")); } catch {}
    }
    const slotIds: string[] = [];
    for (const name of stat) {
      if (!name.endsWith(".json") || name === "shadow.json") continue;
      slotIds.push(name.slice(0, -".json".length));
    }
    const cardIds: string[] = [];
    const cardsDir = join(dir, "cards");
    if (existsSync(cardsDir)) {
      try {
        for (const name of readdirSync(cardsDir)) {
          if (!name.endsWith(".json")) continue;
          cardIds.push(name.slice(0, -".json".length));
        }
      } catch {}
    }
    out.push({
      setId: typeof manifest.setId === "string" ? manifest.setId : entry,
      createdAt: typeof manifest.createdAt === "string" ? manifest.createdAt : undefined,
      lastEditedAt: typeof manifest.lastEditedAt === "string" ? manifest.lastEditedAt : undefined,
      editor: typeof manifest.editor === "string" ? manifest.editor : undefined,
      syncStatus: typeof manifest.syncStatus === "string" ? manifest.syncStatus : undefined,
      slotIds: slotIds.sort(),
      cardIds: cardIds.sort(),
    });
  }
  return out.sort((a, b) => a.setId.localeCompare(b.setId));
}

function readAllShadows(): Array<{
  setId: string;
  manifest: Record<string, unknown>;
  slots: Record<string, CardTemplate>;
  cards: Record<string, CardTemplate>;
}> {
  const root = getBuiltinShadowsPath();
  if (!existsSync(root)) return [];
  const out = [];
  for (const entry of readdirSync(root)) {
    const dir = join(root, entry);
    let stat;
    try { stat = readdirSync(dir); } catch { continue; }
    let manifest: Record<string, unknown> = {};
    const manifestPath = join(dir, "shadow.json");
    if (existsSync(manifestPath)) {
      try { manifest = JSON.parse(readFileSync(manifestPath, "utf-8")); } catch {}
    }
    const slots: Record<string, CardTemplate> = {};
    const cards: Record<string, CardTemplate> = {};
    for (const name of stat) {
      if (!name.endsWith(".json") || name === "shadow.json") continue;
      const slotId = name.slice(0, -".json".length);
      try { slots[slotId] = JSON.parse(readFileSync(join(dir, name), "utf-8")); } catch {}
    }
    const cardsDir = join(dir, "cards");
    if (existsSync(cardsDir)) {
      try {
        for (const name of readdirSync(cardsDir)) {
          if (!name.endsWith(".json")) continue;
          const cardId = name.slice(0, -".json".length);
          try { cards[cardId] = JSON.parse(readFileSync(join(cardsDir, name), "utf-8")); } catch {}
        }
      } catch {}
    }
    out.push({
      setId: typeof manifest.setId === "string" ? manifest.setId : entry,
      manifest,
      slots,
      cards,
    });
  }
  return out;
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

