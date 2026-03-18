/**
 * SVG frame — builds the outer SVG shell for card rendering.
 * Shared by the editor and the JSON template renderer.
 */

import { CARD_W, CARD_H } from "./constants.js";
import { getFontStyle } from "./type-icons.js";

/**
 * Card-scoped ID prefix — avoids ID collisions when multiple card SVGs
 * are embedded in the same HTML document (e.g. print page).
 * Call setCardIdPrefix() before rendering each card.
 */
let _cardIdPrefix = "";

export function setCardIdPrefix(prefix: string): void {
  _cardIdPrefix = prefix;
}

export function getCardIdPrefix(): string {
  return _cardIdPrefix;
}

/** Build a complete card SVG: clip path, filters, fonts, background image, elements overlay. */
export function buildCardSvg(imageB64: string, elementsHtml: string): string {
  const p = _cardIdPrefix;
  const lines: string[] = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}">`);
  lines.push("  <defs>");
  lines.push(`    <clipPath id="${p}card-clip"><rect width="${CARD_W}" height="${CARD_H}" rx="25" ry="25"/></clipPath>`);
  lines.push(`    <filter id="${p}shadow"><feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-opacity="0.7"/></filter>`);
  lines.push(`    <filter id="${p}title-shadow"><feDropShadow dx="1.5" dy="2" stdDeviation="1.5" flood-opacity="0.8"/></filter>`);
  lines.push(`    <filter id="${p}dmg-shadow"><feDropShadow dx="1" dy="1.5" stdDeviation="1" flood-opacity="0.8"/></filter>`);
  lines.push("    " + getFontStyle());
  lines.push("  </defs>");
  lines.push(`  <g clip-path="url(#${p}card-clip)">`);
  lines.push(`    <image id="${p}bg-image" x="0" y="0" width="${CARD_W}" height="${CARD_H}" preserveAspectRatio="xMidYMid slice" href="data:image/png;base64,${imageB64}"/>`);
  lines.push("  </g>");
  lines.push(elementsHtml);
  lines.push(`  <rect width="${CARD_W}" height="${CARD_H}" rx="25" ry="25" fill="none" stroke="#444" stroke-width="4"/>`);
  lines.push("</svg>");
  return lines.join("\n");
}
