/**
 * Template CRUD API — save/load/list/delete widget-based card templates.
 */

import { Hono } from "hono";
import { existsSync } from "node:fs";
import { readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { CardTemplate } from "../../shared/types/template.js";

function isValidTemplateId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

export function createTemplateRouter(dir?: string) {
  const TEMPLATES_DIR = dir ?? join(import.meta.dir, "../../..", "data", "templates");

  const router = new Hono();

  /** GET / — list all templates (id + name + description) */
  router.get("/", async (c) => {
    try {
      const files = await readdir(TEMPLATES_DIR);
      const templates: Array<{ id: string; name: string; description?: string }> = [];
      for (const f of files) {
        if (!f.endsWith(".json")) continue;
        try {
          const raw = await readFile(join(TEMPLATES_DIR, f), "utf-8");
          const t = JSON.parse(raw) as CardTemplate;
          templates.push({ id: t.id, name: t.name, description: t.description });
        } catch { /* skip malformed */ }
      }
      templates.sort((a, b) => a.name.localeCompare(b.name));
      return c.json(templates);
    } catch {
      return c.json([]);
    }
  });

  /** GET /:id — get a single template */
  router.get("/:id", async (c) => {
    const id = c.req.param("id");
    if (!isValidTemplateId(id)) return c.text("Invalid template id", 400);
    const p = join(TEMPLATES_DIR, `${id}.json`);
    if (!existsSync(p)) return c.text("Template not found", 404);
    try {
      const raw = await readFile(p, "utf-8");
      return c.json(JSON.parse(raw));
    } catch {
      return c.text("Failed to read template", 500);
    }
  });

  /** POST /:id — create or update a template */
  router.post("/:id", async (c) => {
    const id = c.req.param("id");
    if (!isValidTemplateId(id)) {
      return c.text("Invalid template id (use alphanumeric, dashes, underscores)", 400);
    }
    const body = await c.req.json() as Partial<CardTemplate>;
    if (!body.name || !body.elements) {
      return c.text("Missing name or elements", 400);
    }
    const template: CardTemplate = {
      id,
      name: body.name,
      description: body.description,
      elements: body.elements,
    };
    const p = join(TEMPLATES_DIR, `${id}.json`);
    await writeFile(p, JSON.stringify(template, null, 2));
    return c.json({ ok: true, id });
  });

  /** DELETE /:id — delete a template */
  router.delete("/:id", async (c) => {
    const id = c.req.param("id");
    if (!isValidTemplateId(id)) return c.text("Invalid template id", 400);
    const p = join(TEMPLATES_DIR, `${id}.json`);
    if (!existsSync(p)) return c.text("Template not found", 404);
    await unlink(p);
    return c.json({ ok: true });
  });

  return router;
}

export const templateRouter = createTemplateRouter();
