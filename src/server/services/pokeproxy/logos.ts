/**
 * Pokemon V and ex logo images — loaded once as base64 data URIs.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadLogoB64(filename: string): string {
  const buf = readFileSync(join(__dirname, "fonts", filename));
  return buf.toString("base64");
}

// Lazy-loaded cache
let _vB64: string | null = null;
let _exB64: string | null = null;
let _vstarB64: string | null = null;
let _vstarBigB64: string | null = null;

// Original pixel dimensions (300px-wide resized versions)
export const LOGO_V_W = 300;
export const LOGO_V_H = 227;
export const LOGO_EX_W = 300;
export const LOGO_EX_H = 212;
export const LOGO_VSTAR_W = 300;
export const LOGO_VSTAR_H = 159;
export const LOGO_VSTAR_BIG_W = 300;
export const LOGO_VSTAR_BIG_H = 227;

export function getVLogoB64(): string {
  if (!_vB64) _vB64 = loadLogoB64("pokemon-v.png");
  return _vB64;
}

export function getExLogoB64(): string {
  if (!_exB64) _exB64 = loadLogoB64("pokemon-ex.png");
  return _exB64;
}

export function getVstarLogoB64(): string {
  if (!_vstarB64) _vstarB64 = loadLogoB64("pokemon-vstar.png");
  return _vstarB64;
}

export function getVstarBigLogoB64(): string {
  if (!_vstarBigB64) _vstarBigB64 = loadLogoB64("pokemon-vstar-big.png");
  return _vstarBigB64;
}

/**
 * Render a suffix logo as an SVG <image> element, sized to match text height.
 * Returns the SVG element string and the rendered width.
 */
export function renderSuffixLogo(
  suffix: string,
  x: number,
  y: number,
  height: number,
  filter?: string,
): [svg: string, width: number] {
  let b64: string;
  let srcW: number;
  let srcH: number;

  if (suffix === "V") {
    b64 = getVLogoB64();
    srcW = LOGO_V_W;
    srcH = LOGO_V_H;
  } else if (suffix === "ex") {
    b64 = getExLogoB64();
    srcW = LOGO_EX_W;
    srcH = LOGO_EX_H;
  } else if (suffix === "VSTAR") {
    b64 = getVstarLogoB64();
    srcW = LOGO_VSTAR_W;
    srcH = LOGO_VSTAR_H;
  } else if (suffix === "VSTAR-big") {
    b64 = getVstarBigLogoB64();
    srcW = LOGO_VSTAR_BIG_W;
    srcH = LOGO_VSTAR_BIG_H;
  } else {
    return ["", 0];
  }

  const aspect = srcW / srcH;
  const w = Math.round(height * aspect);
  const filterAttr = filter ? ` filter="${filter}"` : "";

  const svg = `<image x="${x}" y="${y}" width="${w}" height="${height}" href="data:image/png;base64,${b64}" preserveAspectRatio="xMidYMid meet"${filterAttr}/>`;
  return [svg, w];
}
