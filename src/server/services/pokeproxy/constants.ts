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

/** Energy colors for inline SVG rendering */
export const ENERGY_COLORS: Record<string, string> = {
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
