/**
 * Basic Energy template — full card image with minimal overlay.
 * Artist-editable: colors, border, set info position.
 */

import type { CardProps } from "./types.js";
import { CARD_W, CARD_H, FONT_BODY } from "../constants.js";
import { getFontStyle } from "../type-icons.js";
import { escapeXml } from "../svg-helpers.js";

export function render(props: CardProps): string {
  const { color, setName, localId, imageB64 } = props;

  const lines: string[] = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}">`);
  lines.push("  <defs>");
  lines.push(`    ${getFontStyle()}`);
  lines.push(`    <clipPath id="card-clip"><rect width="${CARD_W}" height="${CARD_H}" rx="25" ry="25"/></clipPath>`);
  lines.push("  </defs>");
  lines.push('  <g clip-path="url(#card-clip)">');
  lines.push(`    <image x="0" y="0" width="${CARD_W}" height="${CARD_H}" preserveAspectRatio="xMidYMid slice"`);
  lines.push(`           href="data:image/png;base64,${imageB64}"/>`);
  lines.push('  </g>');
  lines.push(`  <rect width="${CARD_W}" height="${CARD_H}" rx="25" ry="25" fill="none" stroke="${color}" stroke-width="4"/>`);
  lines.push(`  <text x="${CARD_W >> 1}" y="${CARD_H - 20}" font-family="${FONT_BODY}" font-size="18" font-weight="600" fill="rgba(255,255,255,0.7)" text-anchor="middle">${escapeXml(setName)} ${escapeXml(localId)}</text>`);
  lines.push("</svg>");
  return lines.join("\n");
}
