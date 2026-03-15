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
import { POKEMON_RULES, TRAINER_RULES } from "../services/pokeproxy/constants.js";
import { getPokemonSuffix } from "../services/pokeproxy/text.js";
import type { NodeState } from "../services/pokeproxy/elements/index.js";
import { suggestTemplate } from "../../shared/utils/suggest-template.js";

const CACHE_DIR = join(import.meta.dir, "../../..", "cache");

const VALID_CARD_ID = /^[a-zA-Z0-9._-]+$/;
function isValidCardId(id: string): boolean {
  return VALID_CARD_ID.test(id) && !id.includes("..");
}

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
    const name = (data.name as string) ?? "";
    const [baseName, nameSuffix] = splitNameSuffix(name, data);
    data._baseName = baseName;
    data._nameSuffix = nameSuffix;

    // Computed fields for templates
    const category = (data.category as string) ?? "Pokemon";
    const suffix = getPokemonSuffix(data);
    const trainerType = (data.trainerType as string) ?? "";
    let ruleText = "";
    if (category === "Pokemon" && suffix in POKEMON_RULES) ruleText = POKEMON_RULES[suffix];
    else if (category === "Trainer" && trainerType in TRAINER_RULES) ruleText = TRAINER_RULES[trainerType];
    data._ruleText = ruleText;

    const stage = (data.stage as string) ?? "Basic";
    const evolveFrom = (data.evolveFrom as string) ?? "";
    data._stageLabel = evolveFrom ? `${stage} — Evolves from ${evolveFrom}` : stage;

    const setObj = data.set as Record<string, unknown> | undefined;
    const setName = (setObj?.name as string) ?? "";
    const localId = (data.localId as string) ?? "";
    data._footer = setName && localId ? `${setName} • ${localId}` : setName || localId;

    // Retreat cost as array of "Colorless" strings for repeater binding
    const retreat = (data.retreat as number) ?? 0;
    data._retreatDots = Array.from({ length: retreat }, () => "Colorless");

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
  if (!isValidCardId(cardId)) return c.text("Invalid card ID", 400);
  const p = join(CACHE_DIR, `${cardId}.png`);
  if (!existsSync(p)) return c.text("No raw image found", 404);
  const buf = await readFile(p);
  return c.body(buf, 200, { "Content-Type": "image/png" });
});

export { editorRouter };
