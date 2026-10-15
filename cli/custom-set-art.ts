/**
 * Rasterize a custom set's artwork → `art/<localId>.png`, a 750×1050
 * full-bleed card art with the card's feeling banner baked in. Two sources,
 * per card:
 *
 *   art/gen/<localId>.png — a generated illustration (Klein, hand-picked),
 *     resized to cover the canvas; the banner is composited on top.
 *   art/src/<localId>.svg — the 200×130 critter drawing, composed onto an
 *     energy-type backdrop. The fallback when no gen PNG exists, and the
 *     reference image the generator is fed.
 *
 *   bun cli/custom-set-art.ts custom-sets/feelings [--only 001,002]
 *
 * The PNGs are committed: the server serves them as-is (see
 * services/custom-sets.ts), so prod never runs this.
 */
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CustomSetFile } from "../src/server/services/custom-sets.js";

const W = 750;
const H = 1050;

/** Backdrop per energy type: [base, pale highlight]. Mirrors the Feelings
 *  Deck page's --e-* / --p-* palette. */
const PALETTE: Record<string, [string, string]> = {
  Fire: ["#e4572e", "#fde4d8"],
  Darkness: ["#2f3a4a", "#dde2ea"],
  Lightning: ["#f2c12e", "#fdf2c8"],
  Colorless: ["#cfcdc4", "#f1f0eb"],
  Fighting: ["#b5651d", "#f2dfca"],
  Water: ["#2d8fd5", "#d8eaf8"],
  Metal: ["#7f8c99", "#e3e7ec"],
  Grass: ["#4a9e45", "#ddeed6"],
  Psychic: ["#8e5bb0", "#ebdcf5"],
  Dragon: ["#b8962e", "#f3ead0"],
  Fairy: ["#d96fa5", "#fbe0ee"],
};

const METER_COLORS = ["#f0a24a", "#e4572e", "#9e1f1f"];

const FONT_DIR = resolve(import.meta.dir, "../src/client/public/fonts");
const FONTS = ["Inter-Black.ttf", "Inter-Bold.ttf"].map((f) => join(FONT_DIR, f));

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Re-root a standalone 200×130 svg at the given box. */
function placeCritter(svg: string, x: number, y: number, w: number, h: number): string {
  return svg
    .replace(/<\?xml[^>]*>\s*/, "")
    .replace(/<svg\b([^>]*)>/, (_m, attrs: string) => {
      const kept = attrs.replace(/\s(width|height|x|y)="[^"]*"/g, "");
      return `<svg${kept} x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet">`;
    });
}

interface ArtMeta { banner?: string; caption?: string; meter?: string[] }

function bannerSvg(meta: ArtMeta): string {
  if (!meta.banner && !meta.caption) return "";
  const x = 36, y = 124, w = W - 72, h = 74;
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="rgba(12,14,22,0.58)"/>`;
  if (meta.banner) {
    out += `<text x="${x + 22}" y="${y + 33}" font-family="Inter" font-weight="900" font-size="31" letter-spacing="1.5" fill="#ffffff">${esc(meta.banner.toUpperCase())}</text>`;
  }
  if (meta.caption) {
    out += `<text x="${x + 22}" y="${y + 62}" font-family="Inter" font-weight="700" font-size="22" fill="rgba(255,255,255,0.92)">${esc(meta.caption)}</text>`;
  }
  if (meta.meter?.length) {
    // Right-aligned run of chips, widest-first so the run ends flush.
    const chipH = 26, gap = 8, pad = 14, charW = 9.2;
    const widths = meta.meter.map((m) => Math.round(m.length * charW) + pad * 2);
    let cx = x + w - 18 - widths.reduce((a, b) => a + b, 0) - gap * (widths.length - 1);
    const cy = y + (h - chipH) / 2;
    meta.meter.forEach((label, i) => {
      const cw = widths[i];
      out += `<rect x="${cx}" y="${cy}" width="${cw}" height="${chipH}" rx="6" fill="${METER_COLORS[i % METER_COLORS.length]}"/>`;
      out += `<text x="${cx + cw / 2}" y="${cy + 18}" text-anchor="middle" font-family="Inter" font-weight="900" font-size="14" letter-spacing="1" fill="#fff">${esc(label.toUpperCase())}</text>`;
      cx += cw + gap;
    });
  }
  return out;
}

export interface ArtLayout {
  /** Critter box width in px (height follows the 200×130 viewBox). Default 560. */
  critterWidth?: number;
  /** Critter box top in px. Default 186 (just under the banner). */
  critterTop?: number;
  /** Draw a darker ground band from this y to the bottom (reference images for
   *  the art generator: gives the critter something to stand on). */
  groundFrom?: number;
}

export function composeCardArt(critterSvg: string, type: string, meta: ArtMeta, layout: ArtLayout = {}): string {
  const [base, pale] = PALETTE[type] ?? PALETTE.Colorless;
  // Critter box: below the banner, feet clear of where the content panel
  // (ability + two attacks) starts at ~y=500 on the rendered card.
  const cw = layout.critterWidth ?? 560, ch = Math.round(cw * 130 / 200);
  const cx = (W - cw) / 2, cy = layout.critterTop ?? 186;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="hl" cx="0.72" cy="0.2" r="0.75">
      <stop offset="0" stop-color="${pale}" stop-opacity="0.95"/>
      <stop offset="0.55" stop-color="${pale}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${pale}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="vig" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.4" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.5"/>
    </linearGradient>
    <radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#000" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${base}"/>
  <rect width="${W}" height="${H}" fill="url(#hl)"/>
  <circle cx="120" cy="330" r="260" fill="#fff" opacity="0.10"/>
  <circle cx="640" cy="600" r="300" fill="#fff" opacity="0.08"/>
  <circle cx="560" cy="150" r="140" fill="#fff" opacity="0.12"/>
  <path d="M-50 760 L800 420 L800 520 L-50 860 Z" fill="#fff" opacity="0.07"/>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  ${layout.groundFrom != null ? `<rect x="0" y="${layout.groundFrom}" width="${W}" height="${H - layout.groundFrom}" fill="#000" opacity="0.22"/>` : ""}
  <ellipse cx="${W / 2}" cy="${cy + ch * 0.94}" rx="${cw * 0.42}" ry="40" fill="url(#shadow)"/>
  ${placeCritter(critterSvg, cx, cy, cw, ch)}
  ${bannerSvg(meta)}
</svg>`;
}

/** The banner alone on a transparent 750×1050 canvas, for compositing. */
export function bannerOverlaySvg(meta: ArtMeta): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bannerSvg(meta)}</svg>`;
}

/** Generated illustration → card art: cover-resize to the canvas, banner on top. */
export async function composeGeneratedArt(png: Buffer, meta: ArtMeta): Promise<Buffer> {
  const base = await sharp(png).resize(W, H, { fit: "cover", position: "centre" }).png().toBuffer();
  const overlay = rasterize(bannerOverlaySvg(meta));
  return sharp(base).composite([{ input: overlay }]).png().toBuffer();
}

export function rasterize(svg: string): Buffer {
  const r = new Resvg(svg, {
    fitTo: { mode: "width", value: W },
    font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Inter" },
  });
  return r.render().asPng();
}

async function main(): Promise<void> {
  const [setDirArg, ...rest] = process.argv.slice(2);
  if (!setDirArg) {
    console.error("usage: bun cli/custom-set-art.ts <custom-sets/folder> [--only 001,002]");
    process.exit(1);
  }
  const onlyIdx = rest.indexOf("--only");
  const only = onlyIdx >= 0 ? new Set(rest[onlyIdx + 1]?.split(",") ?? []) : null;

  const setDir = resolve(setDirArg);
  const set = JSON.parse(readFileSync(join(setDir, "set.json"), "utf-8")) as CustomSetFile;
  const srcDir = join(setDir, "art", "src");
  const genDir = join(setDir, "art", "gen");
  const outDir = join(setDir, "art");
  mkdirSync(outDir, { recursive: true });

  for (const card of set.cards) {
    if (only && !only.has(card.localId)) continue;
    const meta = (card as { art?: ArtMeta }).art ?? {};
    const genPath = join(genDir, `${card.localId}.png`);
    const srcPath = join(srcDir, `${card.localId}.svg`);
    let png: Buffer;
    let source: string;
    if (existsSync(genPath)) {
      png = await composeGeneratedArt(readFileSync(genPath), meta);
      source = "gen";
    } else if (existsSync(srcPath)) {
      png = rasterize(composeCardArt(readFileSync(srcPath, "utf-8"), card.types?.[0] ?? "Colorless", meta));
      source = "svg";
    } else {
      console.warn(`  ${card.localId} ${card.name}: no ${genPath} or ${srcPath}, skipping`);
      continue;
    }
    const outPath = join(outDir, `${card.localId}.png`);
    writeFileSync(outPath, png);
    console.log(`  ${card.localId} ${card.name} [${source}]: ${outPath} (${(png.length / 1024).toFixed(0)} KB)`);
  }
}

if (import.meta.main) await main();
