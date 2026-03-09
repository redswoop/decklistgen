/** Convenience constructors for layout nodes. */

import type {
  BoxNode, TextNode, IconNode, ImageNode, LineNode,
  ShapeNode, LogoNode, LayoutNode, Insets,
} from "./types.js";

type BoxOpts = Omit<BoxNode, "type" | "children">;
type TextOpts = Omit<TextNode, "type">;
type IconOpts = Omit<IconNode, "type">;
type ImageOpts = Omit<ImageNode, "type">;

export function box(opts: BoxOpts, children: LayoutNode[]): BoxNode {
  return { type: "box", ...opts, children };
}

export function row(opts: Omit<BoxOpts, "direction">, children: LayoutNode[]): BoxNode {
  return { type: "box", ...opts, direction: "row", children };
}

export function column(opts: Omit<BoxOpts, "direction">, children: LayoutNode[]): BoxNode {
  return { type: "box", ...opts, direction: "column", children };
}

export function text(opts: TextOpts): TextNode {
  return { type: "text", ...opts };
}

export function icon(iconType: string, radius: number): IconNode {
  return { type: "icon", iconType, radius };
}

export function image(opts?: ImageOpts): ImageNode {
  return { type: "image", ...opts };
}

export function line(role?: string): LineNode {
  return { type: "line", role };
}

export function shape(shape: ShapeNode["shape"], size: number): ShapeNode {
  return { type: "shape", shape, size };
}

export function logo(logoKey: "V" | "ex", height: number): LogoNode {
  return { type: "logo", logoKey, height };
}

/** Spacer — a flex box with no children that eats remaining space. */
export function spacer(flex = 1): BoxNode {
  return { type: "box", flex, children: [] };
}

/** Fixed-height gap (empty box). */
export function gap(h: number): BoxNode {
  return { type: "box", height: h, children: [] };
}
