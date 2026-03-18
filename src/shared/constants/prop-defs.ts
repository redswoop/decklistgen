import type { AlignOption, PropDef } from "../types/editor.js";

export const ENERGY_TYPES = [
  "Grass",
  "Fire",
  "Water",
  "Lightning",
  "Psychic",
  "Fighting",
  "Darkness",
  "Metal",
  "Fairy",
  "Dragon",
  "Colorless",
] as const;

// ── Align option sets (for AlignButtons) ──

export const H_ALIGN_OPTIONS: AlignOption[] = [
  { value: "start", icon: "M2 4h7M2 8h5M2 12h9", title: "Start" },
  { value: "center", icon: "M4.5 4h7M5.5 8h5M3.5 12h9", title: "Center" },
  { value: "end", icon: "M7 4h7M9 8h5M5 12h9", title: "End" },
];

export const V_ALIGN_OPTIONS: AlignOption[] = [
  { value: "top", icon: "M3 3h10M5 6h6M5 9h8", title: "Top" },
  { value: "middle", icon: "M5 4h6M3 8h10M5 12h8", title: "Middle" },
  { value: "bottom", icon: "M5 5h8M5 8h6M3 13h10", title: "Bottom" },
];

export const TEXT_ANCHOR_OPTIONS: AlignOption[] = [
  { value: "start", icon: "M2 4h7M2 8h5M2 12h9", title: "Start" },
  { value: "middle", icon: "M4.5 4h7M5.5 8h5M3.5 12h9", title: "Middle" },
  { value: "end", icon: "M7 4h7M9 8h5M5 12h9", title: "End" },
];

export const DIRECTION_OPTIONS: AlignOption[] = [
  { value: "row", icon: "M3 8h10M10 5l3 3-3 3", title: "Row \u2192" },
  { value: "row-reverse", icon: "M3 8h10M6 5l-3 3 3 3", title: "Row Reverse \u2190" },
  { value: "column", icon: "M8 3v10M5 10l3 3 3-3", title: "Column \u2193" },
];

export const V_ANCHOR_OPTIONS: AlignOption[] = [
  { value: "top", icon: "M3 3h10M8 3v10", title: "Top" },
  { value: "bottom", icon: "M3 13h10M8 3v10", title: "Bottom" },
];

export const H_ANCHOR_OPTIONS: AlignOption[] = [
  { value: "left", icon: "M3 3v10M3 8h10", title: "Left" },
  { value: "right", icon: "M13 3v10M3 8h10", title: "Right" },
];

export const WRAP_OPTIONS: AlignOption[] = [
  { value: "0", text: "\u2014", title: "No Wrap" },
  { value: "1", text: "\u21A9", title: "Wrap" },
];

export const WEIGHT_OPTIONS: AlignOption[] = [
  { value: "normal", text: "B", title: "Normal" },
  { value: "bold", text: "B", title: "Bold" },
];

export const FONT_FAMILY_OPTIONS: AlignOption[] = [
  { value: "title", text: "T", title: "Title font" },
  { value: "body", text: "A", title: "Body font" },
];

// ── Image prop building blocks ──

export const IMAGE_SRC_DEF: PropDef = { key: "src", label: "Source", type: "select", options: ["energy", "logo"], group: "content" };

export const IMAGE_ENERGY_DEFS: PropDef[] = [
  { key: "energyType", label: "Type", type: "select", options: [...ENERGY_TYPES], group: "content" },
  { key: "radius", label: "Radius", type: "number", min: 5, max: 60, step: 1, group: "content" },
];

export const IMAGE_LOGO_DEFS: PropDef[] = [
  { key: "suffix", label: "Logo", type: "select", options: ["V", "ex", "VSTAR", "VSTAR-big"], group: "content" },
  { key: "height", label: "Height", type: "number", min: 10, max: 600, step: 1, group: "content" },
  { key: "opacity", label: "Opacity", type: "range", min: 0, max: 1, step: 0.05, group: "appearance" },
  { key: "clipToCard", label: "Clip", type: "select", options: ["0", "1"], group: "appearance" },
  { key: "filter", label: "Filter", type: "select", options: ["none", "shadow", "title-shadow"], group: "appearance" },
];

export const IMAGE_COMMON_DEFS: PropDef[] = [
  { key: "grow", label: "Grow", type: "number", min: 0, max: 10, step: 1, group: "layout" },
  { key: "hAlign", label: "H-Align", type: "select", options: ["start", "center", "end"], group: "align" },
  { key: "marginTop", label: "Margin Top", type: "number", min: -50, max: 50, step: 1 },
  { key: "marginRight", label: "Margin Right", type: "number", min: -50, max: 50, step: 1 },
  { key: "marginBottom", label: "Margin Bottom", type: "number", min: -50, max: 50, step: 1 },
  { key: "marginLeft", label: "Margin Left", type: "number", min: -50, max: 50, step: 1 },
  { key: "paddingTop", label: "Pad Top", type: "number", min: 0, max: 50, step: 1 },
  { key: "paddingRight", label: "Pad Right", type: "number", min: 0, max: 50, step: 1 },
  { key: "paddingBottom", label: "Pad Bottom", type: "number", min: 0, max: 50, step: 1 },
  { key: "paddingLeft", label: "Pad Left", type: "number", min: 0, max: 50, step: 1 },
  { key: "vAlign", label: "V-Align", type: "select", options: ["top", "middle", "bottom"], group: "align" },
];

/** Context-aware prop defs for an image element (child or server-side). */
export function getImagePropDefs(src: string): PropDef[] {
  const typeDefs = src === "energy" ? IMAGE_ENERGY_DEFS : IMAGE_LOGO_DEFS;
  return [IMAGE_SRC_DEF, ...typeDefs, ...IMAGE_COMMON_DEFS];
}

// ── Root-level prop defs (with position props) ──

export const PROP_DEFS: Record<string, PropDef[]> = {
  box: [
    { key: "anchorX", label: "Anchor X", type: "number", min: -200, max: 900, step: 1, isPosition: true, group: "position" },
    { key: "anchorY", label: "Anchor Y", type: "number", min: -200, max: 1100, step: 1, isPosition: true, group: "position" },
    { key: "direction", label: "Direction", type: "select", options: ["row", "row-reverse", "column"], group: "direction" },
    { key: "width", label: "Width", type: "number", min: 0, max: 900, step: 1, group: "layout" },
    { key: "gap", label: "Gap", type: "number", min: 0, max: 50, step: 1, group: "layout" },
    { key: "vAnchor", label: "V-Anchor", type: "select", options: ["top", "bottom"], group: "direction" },
    { key: "hAnchor", label: "H-Anchor", type: "select", options: ["left", "right"], group: "direction" },
    { key: "marginTop", label: "Margin Top", type: "number", min: -50, max: 50, step: 1 },
    { key: "marginRight", label: "Margin Right", type: "number", min: -50, max: 50, step: 1 },
    { key: "marginBottom", label: "Margin Bottom", type: "number", min: -50, max: 50, step: 1 },
    { key: "marginLeft", label: "Margin Left", type: "number", min: -50, max: 50, step: 1 },
    { key: "paddingTop", label: "Pad Top", type: "number", min: 0, max: 50, step: 1 },
    { key: "paddingRight", label: "Pad Right", type: "number", min: 0, max: 50, step: 1 },
    { key: "paddingBottom", label: "Pad Bottom", type: "number", min: 0, max: 50, step: 1 },
    { key: "paddingLeft", label: "Pad Left", type: "number", min: 0, max: 50, step: 1 },
    { key: "fill", label: "Fill", type: "color" },
    { key: "fillOpacity", label: "Fill Opacity", type: "range", min: 0, max: 1, step: 0.05 },
    { key: "stroke", label: "Stroke", type: "color", group: "stroke" },
    { key: "strokeWidth", label: "Stroke W", type: "number", min: 0, max: 10, step: 0.5, group: "stroke" },
    { key: "rx", label: "Corner Radius", type: "number", min: 0, max: 30, step: 1, group: "appearance" },
  ],
  image: [
    { key: "anchorX", label: "Anchor X", type: "number", min: -200, max: 900, step: 1, isPosition: true, group: "position" },
    { key: "anchorY", label: "Anchor Y", type: "number", min: -200, max: 1100, step: 1, isPosition: true, group: "position" },
    { key: "src", label: "Source", type: "select", options: ["energy", "logo"], group: "content" },
    { key: "energyType", label: "Type", type: "select", options: [...ENERGY_TYPES], group: "content" },
    { key: "radius", label: "Radius", type: "number", min: 5, max: 60, step: 1, group: "content" },
    { key: "suffix", label: "Logo", type: "select", options: ["V", "ex", "VSTAR", "VSTAR-big"], group: "content" },
    { key: "height", label: "Height", type: "number", min: 10, max: 600, step: 1, group: "content" },
    { key: "opacity", label: "Opacity", type: "range", min: 0, max: 1, step: 0.05, group: "appearance" },
    { key: "clipToCard", label: "Clip", type: "select", options: ["0", "1"], group: "appearance" },
    { key: "filter", label: "Filter", type: "select", options: ["none", "shadow", "title-shadow"], group: "appearance" },
  ],
};

// ── Child-level prop defs (with layout props, no position) ──

export const SUB_PROP_DEFS: Record<string, PropDef[]> = {
  text: [
    { key: "text", label: "Text", type: "text", group: "content" },
    { key: "fontSize", label: "Font Size", type: "number", min: 8, max: 120, step: 1 },
    { key: "fontFamily", label: "Font", type: "select", options: ["title", "body"] },
    { key: "fontWeight", label: "Weight", type: "select", options: ["normal", "bold"] },
    { key: "fill", label: "Fill", type: "color" },
    { key: "opacity", label: "Opacity", type: "range", min: 0, max: 1, step: 0.05 },
    { key: "stroke", label: "Stroke", type: "color", group: "stroke" },
    { key: "strokeWidth", label: "Stroke W", type: "number", min: 0, max: 10, step: 0.5, group: "stroke" },
    { key: "filter", label: "Filter", type: "select", options: ["none", "shadow", "title-shadow", "dmg-shadow"], group: "appearance" },
    { key: "textAnchor", label: "Anchor", type: "select", options: ["start", "middle", "end"], group: "align" },
    { key: "wrap", label: "Wrap", type: "select", options: ["0", "1"], group: "align" },
    { key: "palette", label: "Energy Palette", type: "select", options: ["dark", "light"], default: "dark", group: "appearance" },
    { key: "grow", label: "Grow", type: "number", min: 0, max: 10, step: 1, group: "layout" },
    { key: "hAlign", label: "H-Align", type: "select", options: ["start", "center", "end"], group: "align" },
    { key: "marginTop", label: "Margin Top", type: "number", min: -50, max: 50, step: 1 },
    { key: "marginRight", label: "Margin Right", type: "number", min: -50, max: 50, step: 1 },
    { key: "marginBottom", label: "Margin Bottom", type: "number", min: -50, max: 50, step: 1 },
    { key: "marginLeft", label: "Margin Left", type: "number", min: -50, max: 50, step: 1 },
    { key: "paddingTop", label: "Pad Top", type: "number", min: 0, max: 50, step: 1 },
    { key: "paddingRight", label: "Pad Right", type: "number", min: 0, max: 50, step: 1 },
    { key: "paddingBottom", label: "Pad Bottom", type: "number", min: 0, max: 50, step: 1 },
    { key: "paddingLeft", label: "Pad Left", type: "number", min: 0, max: 50, step: 1 },
    { key: "vAlign", label: "V-Align", type: "select", options: ["top", "middle", "bottom"], group: "align" },
  ],
  image: [
    { key: "src", label: "Source", type: "select", options: ["energy", "logo"], group: "content" },
    { key: "energyType", label: "Type", type: "select", options: [...ENERGY_TYPES], group: "content" },
    { key: "radius", label: "Radius", type: "number", min: 5, max: 60, step: 1, group: "content" },
    { key: "suffix", label: "Logo", type: "select", options: ["V", "ex", "VSTAR", "VSTAR-big"], group: "content" },
    { key: "height", label: "Height", type: "number", min: 10, max: 600, step: 1, group: "content" },
    { key: "opacity", label: "Opacity", type: "range", min: 0, max: 1, step: 0.05, group: "appearance" },
    { key: "clipToCard", label: "Clip", type: "select", options: ["0", "1"], group: "appearance" },
    { key: "filter", label: "Filter", type: "select", options: ["none", "shadow", "title-shadow"], group: "appearance" },
    { key: "grow", label: "Grow", type: "number", min: 0, max: 10, step: 1, group: "layout" },
    { key: "hAlign", label: "H-Align", type: "select", options: ["start", "center", "end"], group: "align" },
    { key: "marginTop", label: "Margin Top", type: "number", min: -50, max: 50, step: 1 },
    { key: "marginRight", label: "Margin Right", type: "number", min: -50, max: 50, step: 1 },
    { key: "marginBottom", label: "Margin Bottom", type: "number", min: -50, max: 50, step: 1 },
    { key: "marginLeft", label: "Margin Left", type: "number", min: -50, max: 50, step: 1 },
    { key: "paddingTop", label: "Pad Top", type: "number", min: 0, max: 50, step: 1 },
    { key: "paddingRight", label: "Pad Right", type: "number", min: 0, max: 50, step: 1 },
    { key: "paddingBottom", label: "Pad Bottom", type: "number", min: 0, max: 50, step: 1 },
    { key: "paddingLeft", label: "Pad Left", type: "number", min: 0, max: 50, step: 1 },
    { key: "vAlign", label: "V-Align", type: "select", options: ["top", "middle", "bottom"], group: "align" },
  ],
  box: [
    { key: "direction", label: "Direction", type: "select", options: ["row", "row-reverse", "column"], group: "direction" },
    { key: "width", label: "Width", type: "number", min: 0, max: 900, step: 1, group: "layout" },
    { key: "gap", label: "Gap", type: "number", min: 0, max: 50, step: 1, group: "layout" },
    { key: "fill", label: "Fill", type: "color" },
    { key: "fillOpacity", label: "Fill Opacity", type: "range", min: 0, max: 1, step: 0.05 },
    { key: "stroke", label: "Stroke", type: "color", group: "stroke" },
    { key: "strokeWidth", label: "Stroke W", type: "number", min: 0, max: 10, step: 0.5, group: "stroke" },
    { key: "rx", label: "Corner Radius", type: "number", min: 0, max: 30, step: 1, group: "appearance" },
    { key: "grow", label: "Grow", type: "number", min: 0, max: 10, step: 1, group: "layout" },
    { key: "hAlign", label: "H-Align", type: "select", options: ["start", "center", "end"], group: "align" },
    { key: "marginTop", label: "Margin Top", type: "number", min: -50, max: 50, step: 1 },
    { key: "marginRight", label: "Margin Right", type: "number", min: -50, max: 50, step: 1 },
    { key: "marginBottom", label: "Margin Bottom", type: "number", min: -50, max: 50, step: 1 },
    { key: "marginLeft", label: "Margin Left", type: "number", min: -50, max: 50, step: 1 },
    { key: "paddingTop", label: "Pad Top", type: "number", min: 0, max: 50, step: 1 },
    { key: "paddingRight", label: "Pad Right", type: "number", min: 0, max: 50, step: 1 },
    { key: "paddingBottom", label: "Pad Bottom", type: "number", min: 0, max: 50, step: 1 },
    { key: "paddingLeft", label: "Pad Left", type: "number", min: 0, max: 50, step: 1 },
    { key: "vAlign", label: "V-Align", type: "select", options: ["top", "middle", "bottom"], group: "align" },
  ],
  repeater: [
    { key: "direction", label: "Direction", type: "select", options: ["row", "column"], group: "direction" },
    { key: "gap", label: "Gap", type: "number", min: 0, max: 50, step: 1, group: "layout" },
  ],
};

export const BOX_MODEL_KEYS: Record<string, boolean> = {
  marginTop: true, marginRight: true, marginBottom: true, marginLeft: true,
  paddingTop: true, paddingRight: true, paddingBottom: true, paddingLeft: true,
};

export const FILL_KEYS: Record<string, boolean> = {
  fill: true, fillOpacity: true, opacity: true,
};
