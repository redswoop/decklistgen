/**
 * SVG frame — builds the outer SVG shell for card rendering.
 * Shared by the editor and the JSON template renderer.
 */

import { CARD_W, CARD_H } from "./constants.js";
import { getFontStyle } from "./type-icons.js";

/** Build a complete card SVG: clip path, filters, fonts, background image, elements overlay. */
export function buildCardSvg(imageB64: string, elementsHtml: string): string {
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
