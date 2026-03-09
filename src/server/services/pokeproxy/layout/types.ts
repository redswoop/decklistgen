/** Layout node types, resolved tree, and theme interfaces. */

// ── Insets ──

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function normalizeInsets(v: number | Insets | undefined): Insets {
  if (v == null) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof v === "number") return { top: v, right: v, bottom: v, left: v };
  return v;
}

// ── Layout Nodes ──

export type LayoutNode =
  | BoxNode
  | TextNode
  | IconNode
  | ImageNode
  | LineNode
  | ShapeNode
  | LogoNode;

export interface BoxNode {
  type: "box";
  role?: string;
  direction?: "row" | "column";
  width?: number;
  height?: number;
  flex?: number;
  minHeight?: number;
  maxHeight?: number;
  padding?: number | Insets;
  gap?: number;
  align?: "start" | "center" | "baseline";
  children: LayoutNode[];
}

export interface TextNode {
  type: "text";
  role?: string;
  content: string;
  fontSize: number;
  font: "title" | "body";
  anchor?: "start" | "middle" | "end";
  flex?: number;
  justify?: number;
  fontStyle?: "italic";
  dominantBaseline?: "central";
}

export interface IconNode {
  type: "icon";
  iconType: string;
  radius: number;
}

export interface ImageNode {
  type: "image";
  flex?: number;
  height?: number;
  crop?: { x: number; y: number; w: number; h: number; srcW: number; srcH: number };
}

export interface LineNode {
  type: "line";
  role?: string;
}

export interface ShapeNode {
  type: "shape";
  shape: "triangle-down" | "triangle-up" | "arrow-right";
  size: number;
}

export interface LogoNode {
  type: "logo";
  logoKey: "V" | "ex";
  height: number;
}

// ── Resolved Tree ──

export interface ResolvedNode {
  node: LayoutNode;
  x: number;
  y: number;
  width: number;
  height: number;
  children?: ResolvedNode[];
}

// ── Theme ──

export interface BoxStyle {
  fill?: string;
  opacity?: number;
  rx?: number;
  stroke?: string;
  strokeWidth?: number;
  /** Accent line at top of box */
  accentLineY?: "top";
  accentLineColor?: string;
  accentLineOpacity?: number;
}

export interface TextStyle {
  fill: string;
  filter?: string;
  stroke?: string;
  strokeWidth?: number;
  paintOrder?: string;
  fontWeight?: string;
}

export interface LineStyle {
  stroke: string;
  strokeWidth: number;
  opacity?: number;
}

export interface Theme {
  box: Record<string, BoxStyle>;
  text: Record<string, TextStyle>;
  line: Record<string, LineStyle>;
  defs: string[];
  energyPalette: Record<string, string>;
  background: {
    fills: Array<{ fill: string; opacity?: number; rx?: number; stroke?: string; strokeWidth?: number }>;
  };
  footer: {
    fill: string;
    retreatDotFill: string;
    infoFill: string;
    sepColor: string;
  };
}
