/**
 * SVG helper functions for the pokeproxy renderer.
 */

import { getPokemonSuffix } from "./text.js";

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
