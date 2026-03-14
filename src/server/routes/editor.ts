/**
 * Card Element Editor API — endpoints for the Vue editor to render SVG previews.
 */

import { Hono } from "hono";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { CARD_W, CARD_H } from "../services/pokeproxy/constants.js";
import { createElement, createDefaultElements, renderElements } from "../services/pokeproxy/elements/index.js";
import { getFontStyle } from "../services/pokeproxy/type-icons.js";
import { splitNameSuffix } from "../services/pokeproxy/svg-helpers.js";
import type { ElementState } from "../services/pokeproxy/elements/index.js";

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

/** Build minimal SVG: card background + elements */
function buildEditorSvg(imageB64: string, elementsHtml: string): string {
  const lines: string[] = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}">`);
  lines.push("  <defs>");
  lines.push(`    <clipPath id="card-clip"><rect width="${CARD_W}" height="${CARD_H}" rx="25" ry="25"/></clipPath>`);
  lines.push('    <filter id="shadow"><feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-opacity="0.7"/></filter>');
  lines.push('    <filter id="title-shadow"><feDropShadow dx="1.5" dy="2" stdDeviation="1.5" flood-opacity="0.8"/></filter>');
  lines.push('    <filter id="dmg-shadow"><feDropShadow dx="1" dy="1.5" stdDeviation="1" flood-opacity="0.8"/></filter>');
  lines.push("    " + getFontStyle());
  lines.push("  </defs>");
  lines.push('  <g clip-path="url(#card-clip)">');
  lines.push(`    <image x="0" y="0" width="${CARD_W}" height="${CARD_H}" preserveAspectRatio="xMidYMid slice" href="data:image/png;base64,${imageB64}"/>`);
  lines.push("  </g>");
  lines.push(elementsHtml);
  lines.push(`  <rect width="${CARD_W}" height="${CARD_H}" rx="25" ry="25" fill="none" stroke="#444" stroke-width="4"/>`);
  lines.push("</svg>");
  return lines.join("\n");
}

// GET /cards — list cards that have clean images
editorRouter.get("/cards", async (c) => {
  try {
    const files = await readdir(CACHE_DIR);
    const cardIds: string[] = [];
    for (const f of files) {
      const m = f.match(/^([a-zA-Z0-9._-]+?)_clean\.png$/);
      if (m) cardIds.push(m[1]);
    }
    cardIds.sort();
    return c.json(cardIds);
  } catch {
    return c.json([]);
  }
});

// GET /card-data?cardId=X — return cached card JSON
editorRouter.get("/card-data", async (c) => {
  const cardId = c.req.query("cardId");
  if (!cardId) return c.text("Missing cardId", 400);
  const jsonPath = join(CACHE_DIR, `${cardId}.json`);
  if (!existsSync(jsonPath)) return c.json(null);
  try {
    const data = JSON.parse(await readFile(jsonPath, "utf-8"));
    const name = (data.name as string) ?? "";
    const [baseName, nameSuffix] = splitNameSuffix(name, data);
    data._baseName = baseName;
    data._nameSuffix = nameSuffix;
    return c.json(data);
  } catch {
    return c.json(null);
  }
});

// POST /render — { cardId, elements }
editorRouter.post("/render", async (c) => {
  const body = await c.req.json() as { cardId?: string; elements?: ElementState[] };
  const cardId = body.cardId;
  if (!cardId) return c.text("Missing cardId", 400);

  const imageB64 = await loadCleanImageB64(cardId);
  if (!imageB64) return c.text("No clean image found for card", 404);

  let elements;
  if (body.elements) {
    try {
      elements = body.elements.map(s => createElement(s));
    } catch {
      return c.text("Invalid elements JSON", 400);
    }
  } else {
    elements = createDefaultElements();
  }

  const elementsHtml = renderElements(elements);
  const svg = buildEditorSvg(imageB64, elementsHtml);
  return c.body(svg, 200, { "Content-Type": "image/svg+xml" });
});

// GET /raw-image?cardId=X — serve raw original card image
editorRouter.get("/raw-image", async (c) => {
  const cardId = c.req.query("cardId");
  if (!cardId) return c.text("Missing cardId", 400);
  const p = join(CACHE_DIR, `${cardId}.png`);
  if (!existsSync(p)) return c.text("No raw image found", 404);
  const buf = await readFile(p);
  return c.body(buf, 200, { "Content-Type": "image/png" });
});

export { editorRouter };
