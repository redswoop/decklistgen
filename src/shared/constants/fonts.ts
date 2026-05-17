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
    // Per pokemonaaah.net/news/2026/04/know-your-pokemon-tcg-fonts/, the
    // authentic TCG title font is Gill Sans Condensed Bold (not Heavy).
    // We declare it as weight 900 in @font-face so the existing title-weight
    // rendering (font-weight="900") picks it up unmodified.
    license: "Monotype EULA (bundled per user direction)",
    weights: [
      { weight: 400, file: "Gill Sans.otf", format: "opentype" },
      { weight: 700, file: "Gill Sans Bold.otf", format: "opentype" },
      { weight: 900, file: "GillSans Condensed Bold.otf", format: "opentype" },
    ],
    titleWeight: 900,
    bodyBoldWeight: 700,
    bodyRegularWeight: 400,
    cssStack: `'Gill Sans MT', Calibri, ${SANS_FALLBACK}`,
  },
  "futura-heavy": {
    id: "futura-heavy",
    displayName: "Futura Heavy",
    // The font Pokémon TCG uses for HP and attack damage values. Currently
    // exposed as a global title-font choice (alternative aesthetic) until
    // per-element role routing is added.
    license: "Commercial — bundled per user direction",
    weights: [{ weight: 900, file: "Futura Heavy.otf", format: "opentype" }],
    titleWeight: 900,
    bodyBoldWeight: 900,
    bodyRegularWeight: 900,
    cssStack: `Futura, Impact, ${SANS_FALLBACK}`,
    titleOnly: true,
  },
  frutiger: {
    id: "frutiger",
    displayName: "Frutiger",
    // Used for info-bar text (Stage, Evolves from) and card number on
    // Diamond & Pearl onward.
    license: "Commercial — bundled per user direction",
    weights: [{ weight: 400, file: "Frutiger 400.ttf", format: "truetype" }],
    titleWeight: 400,
    bodyBoldWeight: 400,
    bodyRegularWeight: 400,
    cssStack: `Frutiger, ${SANS_FALLBACK}`,
  },
  sanvito: {
    id: "sanvito",
    displayName: "Sanvito Pro",
    // Used for Pokédex entries on DPP through Steam Siege.
    license: "Commercial — bundled per user direction",
    weights: [{ weight: 400, file: "sanvitopro-regular.otf", format: "opentype" }],
    titleWeight: 400,
    bodyBoldWeight: 400,
    bodyRegularWeight: 400,
    cssStack: `'Sanvito Pro', Palatino, Georgia, serif`,
  },
  bauhaus: {
    id: "bauhaus",
    displayName: "Bauhaus",
    // The font used for the "TRAINER" header word on classic trainer cards.
    // Display-only.
    license: "Commercial — bundled per user direction",
    weights: [{ weight: 400, file: "Bauhaus 5.ttf", format: "truetype" }],
    titleWeight: 400,
    bodyBoldWeight: 400,
    bodyRegularWeight: 400,
    cssStack: `Bauhaus, 'Bauhaus 93', Impact, ${SANS_FALLBACK}`,
    titleOnly: true,
  },
};

export const DEFAULT_FONT_ID = "inter";

/** Resolve a font id to a FontDef, falling back to the default if unknown. */
export function resolveFont(id: string | undefined): FontDef {
  if (id && FONTS[id]) return FONTS[id];
  return FONTS[DEFAULT_FONT_ID];
}
