/**
 * JSON template renderer — loads a template from data/templates/,
 * enriches card data, applies bindings, and renders SVG elements.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NodeState } from "../../../shared/types/editor.js";
import { applyBindingsToTree } from "../../../shared/resolve-bindings.js";
import { resolveFontSizes } from "../../../shared/resolve-font-sizes.js";
import { createNode, renderElements } from "./elements/index.js";
import { enrichCardData } from "./enrich-card-data.js";
import { getEffectiveFontSizes } from "./font-size-store.js";
import { buildCardSvg } from "./svg-frame.js";

const TEMPLATES_DIR = join(import.meta.dir, "../../../../data/templates");

/** In-memory cache: template name → parsed JSON */
const templateCache = new Map<string, { elements: NodeState[] }>();

/** Clear the in-memory template cache so next render re-reads from disk. */
export function clearTemplateCache(): void {
  templateCache.clear();
}

function loadTemplate(name: string): { elements: NodeState[] } {
  const cached = templateCache.get(name);
  if (cached) return cached;

  const filePath = join(TEMPLATES_DIR, `${name}.json`);
  const raw = readFileSync(filePath, "utf-8");
  const tmpl = JSON.parse(raw) as { elements: NodeState[] };
  templateCache.set(name, tmpl);
  return tmpl;
}

/**
 * Render a card SVG using a JSON template.
 *
 * Pipeline:
 * 1. Load template from data/templates/{templateName}.json
 * 2. enrichCardData(cardData) — add computed fields
 * 3. applyBindingsToTree(template.elements, data) — expand repeaters, resolve bindings, filter showIf
 * 4. createNode() for each expanded element
 * 5. renderElements(nodes) — generate SVG elements
 * 6. buildCardSvg(imageB64, elementsHtml) — wrap in full SVG
 */
export function renderFromJsonTemplate(
  templateName: string,
  cardData: Record<string, unknown>,
  imageB64: string,
): string {
  const template = loadTemplate(templateName);

  // Enrich card data with computed fields
  enrichCardData(cardData);

  // Apply bindings, expand repeaters, filter showIf
  const expanded = applyBindingsToTree(template.elements, cardData);

  // Resolve $token font sizes to numbers
  resolveFontSizes(expanded, getEffectiveFontSizes());

  // Instantiate LayoutNode tree and render SVG elements
  const nodes = expanded.map(s => createNode(s));
  const elementsHtml = renderElements(nodes);

  return buildCardSvg(imageB64, elementsHtml);
}
