/**
 * SVG helper functions extracted from renderer.ts.
 * Used by both the original renderer and template-based renderers.
 */

import {
  CARD_W, TYPE_MATCHUPS, ENERGY_COLORS,
  FONT_TITLE, FONT_BODY, MARGIN,
} from "./constants.js";
import { renderTypeIcon } from "./type-icons.js";
import { measureWidth, fitNameSize, getPokemonSuffix } from "./text.js";

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function splitNameSuffix(name: string, card: Record<string, unknown>): [string, string] {
  const suffix = getPokemonSuffix(card);
  if (!suffix) return [name, ""];
  if (suffix === "ex" && name.toLowerCase().endsWith(" ex")) return [name.slice(0, -3).trimEnd(), "ex"];
  if (suffix === "V" && name.endsWith(" V")) return [name.slice(0, -2).trimEnd(), "V"];
  if (suffix === "VMAX" && name.endsWith(" VMAX")) return [name.slice(0, -5).trimEnd(), "VMAX"];
  if (suffix === "VSTAR" && name.endsWith(" VSTAR")) return [name.slice(0, -6).trimEnd(), "VSTAR"];
  return [name, suffix];
}

export function splitNameSubtitle(name: string): [string, string] {
  const m = name.match(/^(.+?)\s*\((.+?)\)\s*$/);
  if (m) return [m[1].trim(), m[2].trim()];
  return [name, ""];
}

export function renderEnergyDots(
  x: number, centerY: number, cost: string[], radius: number,
): [string[], number] {
  const elems: string[] = [];
  let cx = x + radius;
  for (const energy of cost) {
    elems.push(`  ${renderTypeIcon(cx, centerY, radius, energy)}`);
    cx += radius * 2 + 4;
  }
  return [elems, cx - x + 6];
}

export function energyInlineSvg(text: string, fontSize: number): string {
  const escaped = escapeXml(text);
  return escaped.replace(/\{([A-Z])\}/g, (_match, letter: string) => {
    const color = ENERGY_COLORS[letter] ?? "#888";
    return `<tspan fill="${color}" font-size="${Math.floor(fontSize * 1.1)}">&#x25CF;</tspan>`;
  });
}

/**
 * Render a line of text with inline energy icons as proper glassy circles.
 * Splits text at {X} tokens and renders text segments + renderTypeIcon() inline.
 * Pushes SVG elements into `lines`. Returns nothing.
 */
export function renderTextLineWithEnergy(
  lines: string[],
  text: string,
  x: number,
  y: number,
  fontSize: number,
  fontFamily: string,
  fill: string,
  filterAttr: string,
): void {
  // If no energy tokens, render as simple text
  if (!text.includes("{")) {
    lines.push(`  <text x="${x}" y="${y}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="700" fill="${fill}"${filterAttr}>${escapeXml(text)}</text>`);
    return;
  }

  // Split into segments: text and {X} tokens
  const parts = text.split(/(\{[A-Z]\})/);
  const iconR = Math.floor(fontSize * 0.4);
  const iconDiam = iconR * 2;
  const iconGap = Math.max(2, Math.floor(fontSize * 0.1));
  let cx = x;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const m = part.match(/^\{([A-Z])\}$/);
    if (m) {
      // Energy icon — small gap, then glassy circle, then small gap
      cx += iconGap;
      const iconCx = cx + iconR;
      const iconCy = y - Math.floor(fontSize * 0.32);
      lines.push(`  ${renderTypeIcon(iconCx, iconCy, iconR, m[1])}`);
      cx += iconDiam + iconGap;
    } else if (part) {
      // Text segment — trim spaces adjacent to energy icons
      let seg = part;
      // If previous part was an icon, trim leading space
      if (i > 0 && parts[i - 1].match(/^\{[A-Z]\}$/)) seg = seg.replace(/^ /, "");
      // If next part is an icon, trim trailing space
      if (i < parts.length - 1 && parts[i + 1]?.match(/^\{[A-Z]\}$/)) seg = seg.replace(/ $/, "");
      if (seg) {
        lines.push(`  <text x="${cx}" y="${y}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="700" fill="${fill}"${filterAttr}>${escapeXml(seg)}</text>`);
        cx += measureWidth("body", seg, fontSize);
      }
    }
  }
}

/** Shrink ability header text to fit within available width. */
export function fitAbilityHeader(
  label: string,
  headSize: number,
  maxWidth: number,
): number {
  return fitNameSize(label, headSize, maxWidth, Math.floor(headSize * 0.6));
}

export interface FooterStyle {
  footerY: number;
  sepOffset: number;
  sepColor: string;
  fill: string;
  retreatDotFill: string;
  infoY: number;
  infoFill: string;
}

export function renderFooterSvg(
  lines: string[],
  card: Record<string, unknown>,
  category: string,
  cardType: string,
  retreat: number,
  bodySize: number,
  setName: string,
  localId: string,
  opts: FooterStyle,
): void {
  const { footerY, sepOffset, sepColor, fill, infoY, infoFill } = opts;

  let weakness: Array<{ type: string; value: string }> | null = null;
  let resistance: Array<{ type: string; value: string }> | null = null;

  if (category !== "Trainer" && category !== "Energy") {
    weakness = card.weaknesses as typeof weakness ?? null;
    resistance = card.resistances as typeof resistance ?? null;
    if (cardType in TYPE_MATCHUPS) {
      const [wt, wv, rt, rv] = TYPE_MATCHUPS[cardType];
      if (!weakness && wt) weakness = [{ type: wt, value: wv! }];
      if (!resistance && rt) resistance = [{ type: rt, value: rv! }];
    }
  } else {
    retreat = 0;
  }

  const hasFooter = weakness || resistance || retreat;
  if (hasFooter) {
    lines.push(`  <line x1="20" y1="${footerY - sepOffset}" x2="${CARD_W - 20}" y2="${footerY - sepOffset}" stroke="${sepColor}" stroke-width="1"/>`);
  }

  let footerX = MARGIN;
  const dotR = Math.floor(bodySize * 0.45);
  const midY = footerY - bodySize * 0.35;
  const triS = Math.floor(bodySize * 0.55);

  if (weakness) {
    for (const w of weakness) {
      const tx = Math.floor(footerX) + triS;
      lines.push(`  <polygon points="${tx - triS},${Math.floor(midY - triS)} ${tx + triS},${Math.floor(midY - triS)} ${tx},${Math.floor(midY + triS)}" fill="${fill}" filter="url(#shadow)"/>`);
      footerX += triS * 2 + 6;
      lines.push(`  ${renderTypeIcon(Math.floor(footerX + dotR), Math.floor(midY), dotR, w.type)}`);
      footerX += dotR * 2 + 4;
      lines.push(`  <text x="${Math.floor(footerX)}" y="${footerY}" font-family="${FONT_BODY}" font-size="${bodySize}" font-weight="700" fill="${fill}" filter="url(#shadow)">${escapeXml(w.value)}</text>`);
      footerX += bodySize * 3.0;
    }
  }

  if (resistance) {
    for (const r of resistance) {
      const tx = Math.floor(footerX) + triS;
      lines.push(`  <polygon points="${tx},${Math.floor(midY - triS)} ${tx + triS},${Math.floor(midY + triS)} ${tx - triS},${Math.floor(midY + triS)}" fill="${fill}" filter="url(#shadow)"/>`);
      footerX += triS * 2 + 6;
      lines.push(`  ${renderTypeIcon(Math.floor(footerX + dotR), Math.floor(midY), dotR, r.type)}`);
      footerX += dotR * 2 + 4;
      lines.push(`  <text x="${Math.floor(footerX)}" y="${footerY}" font-family="${FONT_BODY}" font-size="${bodySize}" font-weight="700" fill="${fill}" filter="url(#shadow)">${escapeXml(r.value)}</text>`);
      footerX += bodySize * 3.0;
    }
  }

  if (retreat) {
    if (weakness || resistance) {
      footerX += bodySize * 0.8;
      lines.push(`  <line x1="${Math.floor(footerX)}" y1="${Math.floor(midY - triS)}" x2="${Math.floor(footerX)}" y2="${Math.floor(midY + triS)}" stroke="${fill}" stroke-width="1" opacity="0.4"/>`);
      footerX += bodySize * 0.8;
    }
    const ax = Math.floor(footerX);
    const amy = Math.floor(midY);
    lines.push(`  <polygon points="${ax},${amy} ${ax + triS},${amy - triS} ${ax + triS},${amy + triS}" fill="${fill}" filter="url(#shadow)"/>`);
    lines.push(`  <line x1="${ax + triS}" y1="${amy}" x2="${ax + triS * 2}" y2="${amy}" stroke="${fill}" stroke-width="3" filter="url(#shadow)"/>`);
    footerX += triS * 2 + 8;
    for (let i = 0; i < retreat; i++) {
      lines.push(`  ${renderTypeIcon(Math.floor(footerX + dotR), Math.floor(midY), dotR, "Colorless")}`);
      footerX += dotR * 2 + 4;
    }
  }

  lines.push(`  <text x="${CARD_W >> 1}" y="${infoY}" font-family="${FONT_BODY}" font-size="20" font-weight="600" fill="${infoFill}" text-anchor="middle">${escapeXml(setName)} ${escapeXml(localId)}</text>`);
}
