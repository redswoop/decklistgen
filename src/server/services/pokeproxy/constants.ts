/** Pokemon card dimensions: 2.5" x 3.5" at 300dpi = 750x1050 */
export const CARD_W = 750;
export const CARD_H = 1050;

/** Artwork crop region on the 600x825 source image */
export const ART_TOP = 110;
export const ART_BOTTOM = 430;
export const ART_LEFT = 45;
export const ART_RIGHT = 555;

/** Type colors — deeper/saturated to match real TCG cards */
export const TYPE_COLORS: Record<string, string> = {
  Grass: "#3B9B2F",
  Fire: "#D4301A",
  Water: "#2980C0",
  Lightning: "#E8A800",
  Psychic: "#A8318C",
  Fighting: "#A0522D",
  Darkness: "#3E2D68",
  Metal: "#8A8A9A",
  Fairy: "#D44D8A",
  Dragon: "#5B2DA0",
  Colorless: "#8A8A70",
};

/** SV-era type matchups: [weakness_type, weakness_value, resistance_type, resistance_value] */
export const TYPE_MATCHUPS: Record<string, [string | null, string | null, string | null, string | null]> = {
  Fire:      ["Water",     "×2", null,       null],
  Water:     ["Lightning", "×2", null,       null],
  Grass:     ["Fire",      "×2", null,       null],
  Lightning: ["Fighting",  "×2", null,       null],
  Psychic:   ["Darkness",  "×2", "Fighting", "-30"],
  Fighting:  ["Psychic",   "×2", null,       null],
  Darkness:  ["Grass",     "×2", null,       null],
  Metal:     ["Fire",      "×2", "Grass",    "-30"],
  Dragon:    [null,         null, null,       null],
  Colorless: ["Fighting",  "×2", null,       null],
  Fairy:     ["Metal",     "×2", "Darkness", "-30"],
};

/** Energy palette type — maps type names and single-letter codes to hex colors */
export type EnergyPalette = Record<string, string>;

/** Energy colors for inline SVG rendering (neutral reference, used by type-icons) */
export const ENERGY_COLORS: EnergyPalette = {
  Grass: "#439837", G: "#439837",
  Fire: "#e4613e", R: "#e4613e",
  Water: "#3099e1", W: "#3099e1",
  Lightning: "#dfbc28", L: "#dfbc28",
  Psychic: "#e96c8c", P: "#e96c8c",
  Fighting: "#e49021", F: "#e49021",
  Darkness: "#4f4747", D: "#4f4747",
  Metal: "#74b0cb", M: "#74b0cb",
  Fairy: "#e18ce1", Y: "#e18ce1",
  Dragon: "#576fbc", N: "#576fbc",
  Colorless: "#828282", C: "#828282",
};

/** Darker/more saturated palette for standard cards (dark text on white) */
export const ENERGY_COLORS_DARK: EnergyPalette = {
  Grass: "#2d7a25", G: "#2d7a25",
  Fire: "#c0351a", R: "#c0351a",
  Water: "#1a6db8", W: "#1a6db8",
  Lightning: "#b89200", L: "#b89200",
  Psychic: "#b8306a", P: "#b8306a",
  Fighting: "#a86420", F: "#a86420",
  Darkness: "#2a1f3d", D: "#2a1f3d",
  Metal: "#4a7a8f", M: "#4a7a8f",
  Fairy: "#b840b8", Y: "#b840b8",
  Dragon: "#3a4e9a", N: "#3a4e9a",
  Colorless: "#5a5a5a", C: "#5a5a5a",
};

/** Brighter/lighter palette for full-art cards (white text on dark image) */
export const ENERGY_COLORS_LIGHT: EnergyPalette = {
  Grass: "#6bdb5a", G: "#6bdb5a",
  Fire: "#ff8866", R: "#ff8866",
  Water: "#5cc0ff", W: "#5cc0ff",
  Lightning: "#ffe04a", L: "#ffe04a",
  Psychic: "#ff88b0", P: "#ff88b0",
  Fighting: "#ffb84a", F: "#ffb84a",
  Darkness: "#9080b8", D: "#9080b8",
  Metal: "#a0d8ee", M: "#a0d8ee",
  Fairy: "#ffaaff", Y: "#ffaaff",
  Dragon: "#8899ee", N: "#8899ee",
  Colorless: "#b8b8b8", C: "#b8b8b8",
};

/** Font stacks */
export const FONT_TITLE = "'Arial Black', 'Helvetica Neue', Impact, Arial, sans-serif";
export const FONT_BODY = "'Helvetica Neue', 'Arial Black', Arial, Helvetica, sans-serif";
export const MARGIN = 30;

/** Rule text for special Pokemon mechanics */
export const POKEMON_RULES: Record<string, string> = {
  ex: "When this ex is KO'd, opponent takes 2 Prizes.",
  V: "When this V is KO'd, opponent takes 2 Prizes.",
  VMAX: "When this VMAX is KO'd, opponent takes 3 Prizes.",
  VSTAR: "When this VSTAR is KO'd, opponent takes 2 Prizes.",
};

export const TRAINER_RULES: Record<string, string> = {
  Supporter: "Play only 1 Supporter per turn.",
  Stadium: "Stays in play until replaced.",
  Tool: "Attach to a Pokemon. Limit 1 per Pokemon.",
};
