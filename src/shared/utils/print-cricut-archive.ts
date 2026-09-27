import type { ArtMode } from "./print-params.js";
import type { CardSize } from "./print-grid.js";
import { CARD_DIMS_MM } from "./print-grid.js";

/**
 * Cricut Design Space "Print Then Cut" archive: the planning half, DOM-free.
 *
 * Design Space wants every element as its own raster upload, one file at a
 * time, sizes it from the PNG's DPI metadata, cuts along the transparent edge,
 * and auto-lays the images out at 4 standard cards per Letter page. So the
 * archive holds one PNG per *unique* card (id + art) with the copy count in the
 * filename — upload once, Duplicate ×N — plus a README with the size to type in
 * if Design Space lands it wrong. PrintSheet does the rasterizing; this file
 * decides what to rasterize and what to call it.
 */

const MM_PER_IN = 25.4;

/**
 * Cards Design Space packs per sheet, by its own paper choice (made in Design
 * Space, independent of this sheet's paper). Beta print areas: Letter
 * 7.44×9.94 in → 2×2 of 63×87 mm; A3 10.64×15.44 in → 4×4. Jumbo (132×185 mm)
 * is 1-up on Letter, 2×2 on A3. A3 is the largest area Design Space offers and
 * the ET-8550 feeds it natively, so it is the sheet of choice.
 */
export type CricutPaper = "letter" | "a3";
export const CRICUT_PAPERS: CricutPaper[] = ["letter", "a3"];
export const CRICUT_CARDS_PER_PAGE: Record<CardSize, Record<CricutPaper, number>> = {
  standard: { letter: 4, a3: 16 },
  jumbo: { letter: 1, a3: 4 },
};
const CRICUT_PAPER_LABEL: Record<CricutPaper, string> = { letter: "Letter", a3: "A3" };

/** "~15 Letter pages (4/page) or ~4 A3 pages (16/page)". */
export function cricutPagesLabel(copies: number, cardSize: CardSize): string {
  return CRICUT_PAPERS.map((paper) => {
    const per = CRICUT_CARDS_PER_PAGE[cardSize][paper];
    const pages = Math.ceil(copies / per);
    return `~${pages} ${CRICUT_PAPER_LABEL[paper]} page${pages === 1 ? "" : "s"} (${per}/page)`;
  }).join(" or ");
}

export interface CricutArchiveSource {
  card: { id: string; name: string };
  artUrl: string;
  artMode: ArtMode;
}

export interface CricutArchiveItem {
  /** Dedupe key: card id + art mode + art URL. */
  key: string;
  cardId: string;
  name: string;
  artMode: ArtMode;
  copies: number;
  /** Index into the source entry list of the first occurrence (the cell to rasterize). */
  firstIndex: number;
  filename: string;
}

/** Lowercase ASCII, hyphen-separated, safe on every filesystem Design Space runs on. */
export function fileSlug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** `4x-charizard-ex-sv03-125.png`; Design Space names the layer after the file. */
export function cricutFilename(copies: number, name: string, cardId: string, artMode: ArtMode = "proxy"): string {
  const parts = [`${copies}x`, fileSlug(name), fileSlug(cardId)];
  if (artMode !== "proxy") parts.push(artMode);
  return `${parts.filter(Boolean).join("-")}.png`;
}

export function planCricutArchive(entries: CricutArchiveSource[]): CricutArchiveItem[] {
  const byKey = new Map<string, CricutArchiveItem>();
  entries.forEach((e, i) => {
    const key = `${e.card.id}|${e.artMode}|${e.artUrl}`;
    const item = byKey.get(key);
    if (item) {
      item.copies++;
      return;
    }
    byKey.set(key, {
      key,
      cardId: e.card.id,
      name: e.card.name,
      artMode: e.artMode,
      copies: 1,
      firstIndex: i,
      filename: "",
    });
  });
  const items = Array.from(byKey.values());
  const used = new Set<string>();
  for (const item of items) {
    let filename = cricutFilename(item.copies, item.name, item.cardId, item.artMode);
    // Two different ids can slug identically; keep both files.
    let n = 2;
    while (used.has(filename)) {
      filename = filename.replace(/\.png$/, `-${n++}.png`);
    }
    used.add(filename);
    item.filename = filename;
  }
  return items;
}

export interface CricutManifestOptions {
  cardSize: CardSize;
  dpi: number;
  cornerMm: number;
  /** Deck or selection label for the heading; null for an ad-hoc card list. */
  label?: string | null;
}

export function totalCricutCopies(items: CricutArchiveItem[]): number {
  return items.reduce((n, i) => n + i.copies, 0);
}

export function cricutPixelDims(cardSize: CardSize, dpi: number): { w: number; h: number } {
  const mm = CARD_DIMS_MM[cardSize];
  return { w: Math.round((mm.w / MM_PER_IN) * dpi), h: Math.round((mm.h / MM_PER_IN) * dpi) };
}

/** README.txt for the archive: the how-to plus one line per file. */
export function cricutManifest(items: CricutArchiveItem[], opts: CricutManifestOptions): string {
  const mm = CARD_DIMS_MM[opts.cardSize];
  const inW = (mm.w / MM_PER_IN).toFixed(3);
  const inH = (mm.h / MM_PER_IN).toFixed(3);
  const px = cricutPixelDims(opts.cardSize, opts.dpi);
  const copies = totalCricutCopies(items);
  const lines = [
    `Cricut Design Space — Print Then Cut${opts.label ? ` — ${opts.label}` : ""}`,
    "",
    `Card size: ${mm.w} × ${mm.h} mm (${inW} × ${inH} in), ${opts.cornerMm} mm corners, transparent outside the card.`,
    `Each PNG: ${px.w} × ${px.h} px, tagged ${opts.dpi} dpi. Total: ${items.length} unique card${items.length === 1 ? "" : "s"}, ${copies} copies: ${cricutPagesLabel(copies, opts.cardSize)}.`,
    "Pick A3 in Design Space (Settings → Application Experience → Beta for the larger Print Then Cut sizes) and in the printer dialog; print at 100 %, no fit-to-page.",
    "",
    "How to:",
    "  1. Design Space → Upload → Image → pick one PNG → Complex → Continue → Print Then Cut image → Upload.",
    "     (One file per upload; that is a Design Space limit.)",
    `  2. Insert it on the canvas. Check the size in the Edit bar: it should read ${inW} × ${inH} in (${mm.w} × ${mm.h} mm).`,
    `     If Design Space ignored the ${opts.dpi} dpi tag, lock the aspect ratio and type W = ${inW} in once.`,
    "  3. Duplicate it to the count in the filename (\"4x-…\" = 4 copies).",
    "  4. Repeat for every PNG, then Make It. Design Space lays out the sheets and prints its own registration marks.",
    "     Leave Bleed on (the card border hides the blade's wobble). Use the Print Then Cut calibration in Design Space, not the sheet calibration.",
    "",
    "Files:",
    ...items.map((i) => `  ${i.filename}  ×${i.copies}  ${i.name}  ${i.cardId}${i.artMode !== "proxy" ? `  (${i.artMode})` : ""}`),
    "",
  ];
  return lines.join("\n");
}

export function cricutArchiveFilename(label: string | null | undefined, cardSize: CardSize, dpi: number): string {
  const mm = CARD_DIMS_MM[cardSize];
  const who = fileSlug(label ?? "") || "cards";
  return `cricut-ptc-${who}-${mm.w}x${mm.h}mm-${dpi}dpi.zip`;
}
