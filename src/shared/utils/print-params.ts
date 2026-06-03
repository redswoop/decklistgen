import type { PrintPaper, PrintOrientation, CardSize } from "./print-grid.js";

/**
 * The /print.html URL grammar, as a tested unit. Both sides of the contract live
 * here: parsePrintParams (PrintSheet, the consumer) and buildJumboPrintUrl
 * (JumboPrintDialog, the producer). See PRINT_SHEET.md for the prose spec.
 */

export type ArtMode = "proxy" | "cleaned" | "original";

export interface PrintParams {
  deckId: string | null;
  /** Explicit card IDs (comma-separated): single-card jumbo, or a 2-up pair. */
  cardIds: string[];
  isGallery: boolean;
  cardSize: CardSize;
  /** Print exactly 1 of each card rather than repeating by deck count. */
  qtyOneEach: boolean;
  paper: PrintPaper;
  orientation: PrintOrientation;
  /** Category exclusions (pokemon|supporters|items|tools|stadiums|specialenergy). */
  excludeSet: Set<string>;
  noBasicEnergy: boolean;
  /** Per-card art modes, aligned 1:1 with cardIds; a single value applies to all. */
  artModes: ArtMode[];
  /** Mode for prints with no per-card list (deck/gallery): the first art entry. */
  defaultArtMode: ArtMode;
  cropMarks: boolean;
  autoPrint: boolean;
}

/** Coerce a raw `art` token to a known mode, defaulting to "proxy". */
export function normalizeArtMode(s: string | undefined): ArtMode {
  return s === "original" ? "original" : s === "cleaned" ? "cleaned" : "proxy";
}

export function parsePrintParams(search: string | URLSearchParams): PrintParams {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;

  const artModes = (params.get("art") || "")
    .split(",")
    .map((s) => normalizeArtMode(s.trim()));
  if (artModes.length === 0) artModes.push("proxy");

  return {
    deckId: params.get("deckId"),
    cardIds: (params.get("cardId") || "").split(",").filter(Boolean),
    isGallery: params.get("gallery") === "1",
    cardSize: params.get("size") === "jumbo" ? "jumbo" : "standard",
    qtyOneEach: params.get("qty") === "one-each",
    paper: params.get("paper") === "super-b" ? "super-b" : "letter",
    orientation: params.get("orientation") === "landscape" ? "landscape" : "portrait",
    excludeSet: new Set((params.get("exclude") || "").split(",").filter(Boolean)),
    noBasicEnergy: params.get("noBasicEnergy") === "1",
    artModes,
    defaultArtMode: artModes[0],
    cropMarks: params.get("crop") !== "0",
    autoPrint: params.get("auto") === "1",
  };
}

export interface JumboPrintRequest {
  /** One or two card IDs. */
  ids: string[];
  /** Art mode per card, aligned 1:1 with ids. */
  arts: ArtMode[];
  layout: "one-up" | "two-up";
}

/**
 * Build the /print.html URL for the jumbo pair-picker. Two-up prints landscape;
 * one-up uses the portrait default. Always jumbo size and auto-print.
 */
export function buildJumboPrintUrl(req: JumboPrintRequest): string {
  const params = new URLSearchParams({
    cardId: req.ids.join(","),
    size: "jumbo",
    art: req.arts.join(","),
    auto: "1",
  });
  if (req.layout === "two-up") params.set("orientation", "landscape");
  return `/print.html?${params.toString()}`;
}
