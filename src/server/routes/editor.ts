/**
 * Card Element Editor API — endpoints for the Vue editor to render SVG previews.
 */

import { Hono } from "hono";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createElement, createDefaultElements, renderElements } from "../services/pokeproxy/elements/index.js";
import type { NodeState } from "../services/pokeproxy/elements/index.js";
import { enrichCardData } from "../services/pokeproxy/enrich-card-data.js";
import { getEffectiveFontSizes } from "../services/pokeproxy/font-size-store.js";
import { buildCardSvg } from "../services/pokeproxy/svg-frame.js";
import { resolveFontSizes } from "../../shared/resolve-font-sizes.js";
import { suggestTemplate } from "../../shared/utils/suggest-template.js";
import { isValidCardId } from "../../shared/validation.js";

const CACHE_DIR = join(import.meta.dir, "../../..", "cache");

const editorRouter = new Hono();

/** Load the clean image for a card (used as editor background) */
async function loadCleanImageB64(cardId: string): Promise<string | null> {
  const p = join(CACHE_DIR, `${cardId}_clean.png`);
  if (existsSync(p)) {
    return (await readFile(p)).toString("base64");
  }
  return null;
}


// GET /cards — list cards that have clean images, with category metadata
editorRouter.get("/cards", async (c) => {
  try {
    const files = await readdir(CACHE_DIR);
    const cards: Array<{ id: string; category?: string; name?: string; suggestedTemplate?: string }> = [];
    for (const f of files) {
      const m = f.match(/^([a-zA-Z0-9._-]+?)_clean\.png$/);
      if (!m) continue;
      const id = m[1];
      const entry: { id: string; category?: string; name?: string; suggestedTemplate?: string } = { id };
      // Try to read category from cached card JSON
      const jsonPath = join(CACHE_DIR, `${id}.json`);
      if (existsSync(jsonPath)) {
        try {
          const data = JSON.parse(await readFile(jsonPath, "utf-8"));
          entry.category = (data.category as string) ?? undefined;
          entry.name = (data.name as string) ?? undefined;
          entry.suggestedTemplate = suggestTemplate(data);
        } catch { /* skip metadata if JSON is malformed */ }
      }
      cards.push(entry);
    }
    cards.sort((a, b) => a.id.localeCompare(b.id));
    return c.json(cards);
  } catch {
    return c.json([]);
  }
});

// GET /card-data?cardId=X — return cached card JSON
editorRouter.get("/card-data", async (c) => {
  const cardId = c.req.query("cardId");
  if (!cardId) return c.text("Missing cardId", 400);
  if (!isValidCardId(cardId)) return c.text("Invalid card ID", 400);
  const jsonPath = join(CACHE_DIR, `${cardId}.json`);
  if (!existsSync(jsonPath)) return c.json(null);
  try {
    const data = JSON.parse(await readFile(jsonPath, "utf-8"));
    enrichCardData(data);
    return c.json(data);
  } catch {
    return c.json(null);
  }
});

// POST /render — { cardId, elements }
editorRouter.post("/render", async (c) => {
  const body = await c.req.json() as { cardId?: string; elements?: NodeState[] };
  const cardId = body.cardId;
  if (!cardId) return c.text("Missing cardId", 400);
  if (!isValidCardId(cardId)) return c.text("Invalid card ID", 400);

  const imageB64 = await loadCleanImageB64(cardId);
  if (!imageB64) return c.text("No clean image found for card", 404);

  let elements;
  if (body.elements) {
    try {
      resolveFontSizes(body.elements, getEffectiveFontSizes());
      elements = body.elements.map(s => createElement(s));
    } catch {
      return c.text("Invalid elements JSON", 400);
    }
  } else {
    elements = createDefaultElements();
  }

  const elementsHtml = renderElements(elements);
  const svg = buildCardSvg(imageB64, elementsHtml);
  return c.body(svg, 200, { "Content-Type": "image/svg+xml" });
});

// GET /raw-image?cardId=X — serve raw original card image
editorRouter.get("/raw-image", async (c) => {
  const cardId = c.req.query("cardId");
  if (!cardId) return c.text("Missing cardId", 400);
  if (!isValidCardId(cardId)) return c.text("Invalid card ID", 400);
  const p = join(CACHE_DIR, `${cardId}.png`);
  if (!existsSync(p)) return c.text("No raw image found", 404);
  const buf = await readFile(p);
  return c.body(buf, 200, { "Content-Type": "image/png" });
});

export { editorRouter };
