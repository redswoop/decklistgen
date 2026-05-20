/**
 * JSON template renderer — given a resolved template's element tree,
 * enriches card data, applies bindings, and renders SVG.
 *
 * Template loading lives in template-set-store.ts. Callers resolve a
 * template via resolveTemplate(card, ctx, store.getAllSets()) and then
 * pass `resolved.template.elements` here.
 */

import type { NodeState } from "../../../shared/types/editor.js";
import { applyBindingsToTree } from "../../../shared/resolve-bindings.js";
import { resolveFontSizes } from "../../../shared/resolve-font-sizes.js";
import { createNode, renderElements } from "./elements/index.js";
import { enrichCardData } from "./enrich-card-data.js";
import { getEffectiveFontSizes } from "./font-size-store.js";
import { buildCardSvg } from "./svg-frame.js";
import { clearTemplateSetCache } from "../template-set-store.js";

/** Compatibility shim — old route called this; new code uses
 *  clearTemplateSetCache from template-set-store directly. */
export function clearTemplateCache(): void {
  clearTemplateSetCache();
}

/**
 * Render a card SVG from an already-resolved template's element tree.
 *
 * Pipeline:
 * 1. enrichCardData(cardData) — add computed fields
 * 2. applyBindingsToTree(elements, data) — expand repeaters, resolve bindings, filter showIf
 * 3. resolveFontSizes(expanded, fontSizes) — $token → number
 * 4. createNode() per element
 * 5. renderElements(nodes) — generate SVG strings
 * 6. buildCardSvg(imageB64, elementsHtml) — wrap in the full SVG frame
 */
export function renderResolvedTemplate(
  elements: NodeState[],
  cardData: Record<string, unknown>,
  imageB64: string,
): string {
  enrichCardData(cardData);
  const expanded = applyBindingsToTree(elements, cardData);
  resolveFontSizes(expanded, getEffectiveFontSizes());
  const nodes = expanded.map(s => createNode(s));
  const elementsHtml = renderElements(nodes);
  return buildCardSvg(imageB64, elementsHtml);
}
