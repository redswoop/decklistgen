/**
 * Font registry — defines which fonts are available for card rendering.
 *
 * Each FontDef points at TTF/OTF files in src/server/services/pokeproxy/fonts/.
 * The same files are used by:
 *   - text.ts (opentype.js measurement for layout)
 *   - type-icons.ts (base64 @font-face embedding in the SVG)
 * If those two diverge, server-measured layout drifts from browser-rendered
 * glyphs — exactly the bug Phase A fixed for Inter. Don't add a font entry
 * without confirming its files parse with opentype.js (see registry-integrity test).
 */

export interface FontWeightFile {
  /** CSS font-weight (100..900). */
  weight: number;
  /** File name relative to src/server/services/pokeproxy/fonts/. */
  file: string;
  /** Used in @font-face src declaration. */
  format: "truetype" | "opentype";
}

export interface FontDef {
  /** Stable id used in the JSON override and API. */
  id: string;
  /** Human-readable name, used as the CSS family. */
  displayName: string;
  /** License note — informational, surfaced in the UI. */
  license: string;
  /** Available weight files, ascending by weight. */
  weights: FontWeightFile[];
  /** Heaviest available weight; used when fontFamily="title". */
  titleWeight: number;
  /** Used when fontFamily="body" + fontWeight="bold". 700 if present, else titleWeight. */
  bodyBoldWeight: number;
  /** Used when fontFamily="body" + fontWeight="normal". 400 if present, else lowest. */
  bodyRegularWeight: number;
  /** CSS fallback chain appended after the bundled family. */
  cssStack: string;
  /** When true, this font is hidden from the body dropdown — display-only fonts. */
  titleOnly?: boolean;
}

const SANS_FALLBACK = "'Helvetica Neue', Arial, Helvetica, sans-serif";

export const FONTS: Record<string, FontDef> = {
  inter: {
    id: "inter",
    displayName: "Inter",
    license: "SIL OFL 1.1",
    weights: [
      { weight: 700, file: "Inter-Bold.ttf", format: "truetype" },
      { weight: 900, file: "Inter-Black.ttf", format: "truetype" },
    ],
    titleWeight: 900,
    bodyBoldWeight: 700,
    bodyRegularWeight: 700,
    cssStack: `'Arial Black', Impact, ${SANS_FALLBACK}`,
  },
  "gill-sans": {
    id: "gill-sans",
    displayName: "Gill Sans",
    license: "Monotype EULA (bundled per user direction)",
    weights: [
      { weight: 400, file: "Gill Sans.otf", format: "opentype" },
      { weight: 700, file: "Gill Sans Bold.otf", format: "opentype" },
      { weight: 900, file: "Gill Sans Heavy.otf", format: "opentype" },
    ],
    titleWeight: 900,
    bodyBoldWeight: 700,
    bodyRegularWeight: 400,
    cssStack: `'Gill Sans MT', Calibri, ${SANS_FALLBACK}`,
  },
};

export const DEFAULT_FONT_ID = "inter";

/** Resolve a font id to a FontDef, falling back to the default if unknown. */
export function resolveFont(id: string | undefined): FontDef {
  if (id && FONTS[id]) return FONTS[id];
  return FONTS[DEFAULT_FONT_ID];
}
