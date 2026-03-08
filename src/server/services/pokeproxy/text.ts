/**
 * Text measurement using opentype.js — replaces Python's FreeType usage.
 *
 * Loads system fonts (Arial Black, Helvetica Neue) for accurate
 * text width measurement, word wrapping, and layout calculations.
 */

import opentype from "opentype.js";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";
import { POKEMON_RULES, TRAINER_RULES } from "./constants.js";

function findFont(candidates: string[]): string {
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(`No font found, tried: ${candidates.join(", ")}`);
}

let titleFont: opentype.Font;
let bodyFont: opentype.Font;

function ensureFonts() {
  if (titleFont && bodyFont) return;

  if (platform() === "darwin") {
    titleFont = opentype.loadSync("/System/Library/Fonts/Supplemental/Arial Black.ttf");
    // HelveticaNeue.ttc is a TTC (collection) which opentype.js can't read — use Arial Bold instead
    bodyFont = opentype.loadSync("/System/Library/Fonts/Supplemental/Arial Bold.ttf");
  } else {
    const linuxBold = findFont([
      "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
      "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]);
    titleFont = opentype.loadSync(linuxBold);
    bodyFont = opentype.loadSync(linuxBold);
  }
}

/** Measure text width in pixels at a given font size. */
export function measureWidth(font: "title" | "body", text: string, sizePx: number): number {
  ensureFonts();
  const f = font === "title" ? titleFont : bodyFont;
  // opentype.js measures in font units; convert to pixels
  const scale = sizePx / f.unitsPerEm;
  let width = 0;
  const glyphs = f.stringToGlyphs(text);
  for (const g of glyphs) {
    width += (g.advanceWidth ?? 0) * scale;
  }
  return width;
}

/** Word-wrap text using actual glyph measurements. Returns list of lines. */
export function ftWrap(font: "title" | "body", text: string, sizePx: number, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current: string[] = [];

  for (const word of words) {
    const testLine = [...current, word].join(" ");
    // Replace energy symbols {X} with a single glyph for measurement only
    const measureLine = testLine.replace(/\{[A-Z]\}/g, "\u2B24");
    if (measureWidth(font, measureLine, sizePx) > maxWidth && current.length > 0) {
      lines.push(current.join(" "));
      current = [word];
    } else {
      current.push(word);
    }
  }
  if (current.length > 0) lines.push(current.join(" "));
  return lines;
}

/** Get the Pokemon suffix (ex, V, VMAX, VSTAR) from card data. */
export function getPokemonSuffix(card: Record<string, unknown>): string {
  const name = (card.name as string) ?? "";
  const stage = (card.stage as string) ?? "";
  const suffix = (card.suffix as string) ?? "";

  if (stage === "VMAX" || stage === "VSTAR") return stage;
  if (["ex", "EX", "V", "VMAX", "VSTAR"].includes(suffix)) return suffix;
  if (name.toLowerCase().endsWith(" ex")) return "ex";
  if (name.endsWith(" V") && !name.endsWith(" IV")) return "V";
  return "";
}

/**
 * Measure total content height using font metrics. Mirrors the render layout.
 */
export function ftContentHeight(
  bodySize: number,
  headSize: number,
  maxWidth: number,
  category: string,
  trainerEffect: string,
  abilities: Array<Record<string, unknown>>,
  attacks: Array<Record<string, unknown>>,
  card?: Record<string, unknown>,
): number {
  const lineH = Math.floor(bodySize * 1.25);
  let h = 0;

  if ((category === "Trainer" || category === "Energy") && trainerEffect) {
    h += ftWrap("body", trainerEffect, bodySize, maxWidth).length * lineH;
    h += Math.floor(bodySize * 0.83);
  }

  for (const ab of abilities) {
    h += Math.floor(headSize * 0.5);
    const effect = (ab.effect as string) ?? "";
    h += ftWrap("body", effect, bodySize, maxWidth).length * lineH;
    h += Math.floor(bodySize * 1.46);
  }

  for (const atk of attacks) {
    h += Math.floor(headSize * 0.64);
    const effect = (atk.effect as string) ?? "";
    if (effect) {
      h += ftWrap("body", effect, bodySize, maxWidth).length * lineH;
    }
    h += Math.floor(bodySize * 1.25);
  }

  // Account for rules text
  if (card) {
    const suffix = getPokemonSuffix(card);
    const trainerType = (card.trainerType as string) ?? "";
    let ruleText = "";
    if (category === "Pokemon" && suffix in POKEMON_RULES) {
      ruleText = POKEMON_RULES[suffix];
    } else if (category === "Trainer" && trainerType in TRAINER_RULES) {
      ruleText = TRAINER_RULES[trainerType];
    }
    if (ruleText) {
      const ruleSize = 16;
      const ruleLines = ftWrap("body", ruleText, ruleSize, maxWidth);
      h += 4 + ruleLines.length * Math.floor(ruleSize * 1.3);
    }
  }

  return h;
}

/** Shrink attack name + damage font sizes until they fit without overlap. */
export function fitAttackHeader(
  name: string,
  damage: string | number | undefined,
  costCount: number,
  headSize: number,
  cardW: number,
  margin: number,
): [number, number] {
  const dotR = Math.max(8, Math.floor(headSize * 0.5));
  const costW = costCount > 0 ? (dotR * 2 + 4) * costCount + 6 : 0;
  const available = cardW - 2 * margin - costW - 12;
  let nameSize = headSize;
  let dmgSize = Math.floor(headSize * 1.05);
  const dmgStr = damage ? String(damage) : "";

  for (let i = 0; i < 6; i++) {
    const nameW = measureWidth("title", name, nameSize);
    const dmgW = dmgStr ? measureWidth("title", dmgStr, dmgSize) : 0;
    if (nameW + 20 + dmgW <= available) break;
    nameSize = Math.floor(nameSize * 0.88);
    dmgSize = Math.floor(dmgSize * 0.88);
  }

  return [nameSize, dmgSize];
}

/** Shrink card name font size until it fits within available width. */
export function fitNameSize(name: string, maxSize: number, availableW: number, minSize = 24): number {
  let size = maxSize;
  while (size > minSize) {
    if (measureWidth("title", name, size) <= availableW) return size;
    size -= 2;
  }
  return minSize;
}
