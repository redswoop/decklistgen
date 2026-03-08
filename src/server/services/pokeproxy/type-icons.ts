/**
 * Pokemon TCG type icons using EssentiarumTCG font glyphs.
 * Renders energy type symbols as colored circles with white font glyphs.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

// Load font as base64 for SVG embedding
const FONT_PATH = join(import.meta.dir, "../../../../pokeproxy/fonts/EssentiarumTCG.otf");
const FONT_B64 = readFileSync(FONT_PATH).toString("base64");

const FONT_STYLE =
  '<style>' +
  '@font-face {' +
  '  font-family: "EssentiarumTCG";' +
  `  src: url("data:font/otf;base64,${FONT_B64}") format("opentype");` +
  '}' +
  '</style>';

/** Return the @font-face <style> block to include in SVG <defs>. */
export function getFontStyle(): string {
  return FONT_STYLE;
}

/** TCG type -> (font character, circle background color) */
const ICON_MAP: Record<string, { char: string; bg: string }> = {
  Grass:     { char: "G", bg: "#439837" },
  Fire:      { char: "R", bg: "#e4613e" },
  Water:     { char: "W", bg: "#3099e1" },
  Lightning: { char: "L", bg: "#dfbc28" },
  Psychic:   { char: "P", bg: "#e96c8c" },
  Fighting:  { char: "F", bg: "#e49021" },
  Darkness:  { char: "D", bg: "#4f4747" },
  Metal:     { char: "M", bg: "#74b0cb" },
  Fairy:     { char: "Y", bg: "#e18ce1" },
  Dragon:    { char: "N", bg: "#576fbc" },
  Colorless: { char: "C", bg: "#828282" },
  // Single-letter abbreviation aliases
  G: { char: "G", bg: "#439837" },
  R: { char: "R", bg: "#e4613e" },
  W: { char: "W", bg: "#3099e1" },
  L: { char: "L", bg: "#dfbc28" },
  P: { char: "P", bg: "#e96c8c" },
  F: { char: "F", bg: "#e49021" },
  D: { char: "D", bg: "#4f4747" },
  M: { char: "M", bg: "#74b0cb" },
  Y: { char: "Y", bg: "#e18ce1" },
  N: { char: "N", bg: "#576fbc" },
  C: { char: "C", bg: "#828282" },
};

const DRAGON_PATHS =
  '<path fill="#fff" d="M170.93,124.41c.8,15.21-5.05,28.07-14.96,38.95-4.86,5.34-7.13,10.82-7.01,17.85.07,4.3-.64,8.63-1.21,12.91-1.48,11.17-7.97,16.55-19.79,16.53-11.81-.02-18.2-5.38-19.75-16.59-.18-1.32-.43-2.65-.42-3.97.07-12.31-3.37-22.68-11.93-32.43-14.25-16.22-14.56-45.3-2.66-60.49,5.82-7.42,4.65-17.14,7.55-25.58,2.37-6.9,4.02-14.05,6.07-21.06,.48-1.65,1.51-3.06,3.48-3,2.02,.06,2.71,1.6,3.11,3.3,1.8,7.77,4.05,15.47,5.23,23.33,.95,6.31,4.94,5.95,9.39,5.97,4.5,.02,8.42,.25,9.35-6.03,1.11-7.53,3.32-14.9,5.03-22.34,.45-1.96,.74-4.19,3.34-4.19,2.43,0,3.15,1.99,3.71,4,1.88,6.72,3.88,13.4,5.7,20.14,3.01,11.13,4.22,22.74,11.59,32.51,4.31,5.71,3.98,13.22,4.18,20.21Z"/>' +
  '<path fill="#fff" d="M194.2,95.93c16.78,17.37,18.87,64.53-8.22,85.49-5.83-6.35-8.44-14.77-13.52-21.58-.65-.87-.74-2.88-.18-3.82,5.41-9,4.95-20.46,12.96-28.54,7.84-7.92,9.39-18.61,8.97-31.55Z"/>' +
  '<path fill="#576fbc" d="M141.47,153.95c6.61-10.7,12.32-19.93,18.62-30.12,5.76,18.39-.34,28.8-18.62,30.12Z"/>' +
  '<path fill="#fff" d="M61.68,95.93c-16.78,17.37-18.87,64.53,8.22,85.49,5.83-6.35,8.44-14.77,13.52-21.58,.65-.87,.74-2.88,.18-3.82-5.41-9-4.95-20.46-12.96-28.54-7.84-7.92-9.39-18.61-8.97-31.55Z"/>' +
  '<path fill="#576fbc" d="M115.46,153.95c-6.61-10.7-12.32-19.93-18.62-30.12-5.76,18.39,.34,28.8,18.62,30.12Z"/>';

let iconIdCounter = 0;

/** Reset the icon ID counter (for deterministic test output). */
export function resetIconIds(): void {
  iconIdCounter = 0;
}

function nextIconId(): string {
  iconIdCounter++;
  return `ei${iconIdCounter}`;
}

function glassyCircle(cx: number, cy: number, radius: number, bgColor: string, uid: string): string {
  const r = radius;
  return (
    `<defs>` +
    `<radialGradient id="${uid}-rg" cx="45%" cy="40%" r="55%">` +
    `  <stop offset="0%" stop-color="#fff" stop-opacity="0.35"/>` +
    `  <stop offset="60%" stop-color="${bgColor}" stop-opacity="0"/>` +
    `  <stop offset="100%" stop-color="#000" stop-opacity="0.3"/>` +
    `</radialGradient>` +
    `<radialGradient id="${uid}-gl" cx="50%" cy="25%" r="50%">` +
    `  <stop offset="0%" stop-color="#fff" stop-opacity="0.55"/>` +
    `  <stop offset="50%" stop-color="#fff" stop-opacity="0.12"/>` +
    `  <stop offset="100%" stop-color="#fff" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<clipPath id="${uid}-cp"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>` +
    `</defs>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bgColor}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${uid}-rg)"/>` +
    `<ellipse cx="${cx}" cy="${Math.floor(cy - r * 0.2)}" rx="${Math.floor(r * 0.7)}" ry="${Math.floor(r * 0.55)}" ` +
    `fill="url(#${uid}-gl)" clip-path="url(#${uid}-cp)"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#000" stroke-width="${Math.max(1, r * 0.08).toFixed(1)}" opacity="0.5"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${(r - Math.max(1, r * 0.06)).toFixed(1)}" fill="none" stroke="#fff" stroke-width="${Math.max(0.5, r * 0.04).toFixed(1)}" opacity="0.15"/>`
  );
}

/** Render a type icon centered at (cx, cy) with given radius. Returns SVG markup. */
export function renderTypeIcon(cx: number, cy: number, radius: number, typeName: string): string {
  const icon = ICON_MAP[typeName];
  const uid = nextIconId();

  if (!icon) {
    return (
      glassyCircle(cx, cy, radius, "#888", uid) +
      `<text x="${cx}" y="${Math.floor(cy + 1)}" font-family="Helvetica, Arial, sans-serif" ` +
      `font-size="${Math.floor(radius * 1.3)}" font-weight="bold" fill="white" ` +
      `text-anchor="middle" dominant-baseline="central">?</text>`
    );
  }

  const { bg, char } = icon;

  // Dragon: use SVG path fallback since 'N' renders "LEGEND" in the font
  if (typeName === "Dragon" || typeName === "N") {
    const scale = (radius * 2) / 256;
    const tx = cx - radius;
    const ty = cy - radius;
    return (
      glassyCircle(cx, cy, radius, bg, uid) +
      `<g transform="translate(${tx.toFixed(1)},${ty.toFixed(1)}) scale(${scale.toFixed(4)})" clip-path="url(#${uid}-cp)">` +
      DRAGON_PATHS +
      `</g>`
    );
  }

  const fontSize = radius * 1.55;
  const sw = Math.max(1, radius * 0.08);
  return (
    glassyCircle(cx, cy, radius, bg, uid) +
    `<text x="${cx}" y="${cy}" font-family="EssentiarumTCG" ` +
    `font-size="${Math.floor(fontSize)}" fill="#111" ` +
    `stroke="#fff" stroke-width="${sw.toFixed(1)}" stroke-linejoin="round" ` +
    `style="paint-order:stroke fill" ` +
    `text-anchor="middle" dominant-baseline="central">${char}</text>`
  );
}
