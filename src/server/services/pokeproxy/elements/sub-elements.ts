/**
 * Leaf element types — text, type-dot, suffix-logo, wrapped-text.
 * These implement LayoutNode and can appear at any depth in the tree.
 */

import type { PropDef, LayoutNode, NodeState } from "./types.js";
import { measureWidth, ftWrap } from "../text.js";
import { renderTypeIcon } from "../type-icons.js";
import { renderSuffixLogo } from "../logos.js";
import { FONT_TITLE, FONT_BODY } from "../constants.js";

const ENERGY_TYPES = [
  "Grass", "Fire", "Water", "Lightning", "Psychic",
  "Fighting", "Darkness", "Metal", "Fairy", "Dragon", "Colorless",
];

export class TextItem implements LayoutNode {
  readonly type = "text" as const;
  props: Record<string, number | string>;
  bind?: Record<string, string>;

  constructor(props?: Record<string, number | string>, bind?: Record<string, string>) {
    this.props = {
      text: "Text",
      fontSize: 24,
      fontFamily: "title",
      fontWeight: "bold",
      fill: "#000",
      opacity: 1,
      stroke: "",
      strokeWidth: 0,
      filter: "none",
      textAnchor: "start",
      grow: 0,
      hAlign: "start",
      marginTop: 0,
      marginRight: 0,
      marginBottom: 0,
      marginLeft: 0,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      vAlign: "top",
      ...props,
    };
    if (bind) this.bind = bind;
  }

  propDefs(): PropDef[] {
    return [
      { key: "text", label: "Text", type: "text" },
      { key: "fontSize", label: "Font Size", type: "number", min: 8, max: 120, step: 1 },
      { key: "fontFamily", label: "Font", type: "select", options: ["title", "body"] },
      { key: "fontWeight", label: "Weight", type: "select", options: ["normal", "bold"] },
      { key: "fill", label: "Fill", type: "color" },
      { key: "opacity", label: "Opacity", type: "range", min: 0, max: 1, step: 0.05 },
      { key: "stroke", label: "Stroke", type: "color" },
      { key: "strokeWidth", label: "Stroke W", type: "number", min: 0, max: 10, step: 0.5 },
      { key: "filter", label: "Filter", type: "select", options: ["none", "shadow", "title-shadow", "dmg-shadow"] },
      { key: "textAnchor", label: "Anchor", type: "select", options: ["start", "middle", "end"] },
      { key: "grow", label: "Grow", type: "number", min: 0, max: 10, step: 1 },
      { key: "hAlign", label: "H-Align", type: "select", options: ["start", "center", "end"] },
      { key: "marginTop", label: "Margin Top", type: "number", min: -50, max: 50, step: 1 },
      { key: "marginRight", label: "Margin Right", type: "number", min: -50, max: 50, step: 1 },
      { key: "marginBottom", label: "Margin Bottom", type: "number", min: -50, max: 50, step: 1 },
      { key: "marginLeft", label: "Margin Left", type: "number", min: -50, max: 50, step: 1 },
      { key: "paddingTop", label: "Pad Top", type: "number", min: 0, max: 50, step: 1 },
      { key: "paddingRight", label: "Pad Right", type: "number", min: 0, max: 50, step: 1 },
      { key: "paddingBottom", label: "Pad Bottom", type: "number", min: 0, max: 50, step: 1 },
      { key: "paddingLeft", label: "Pad Left", type: "number", min: 0, max: 50, step: 1 },
      { key: "vAlign", label: "V-Align", type: "select", options: ["top", "middle", "bottom"] },
    ];
  }

  measure(): { width: number; height: number } {
    const text = String(this.props.text);
    const fontSize = Number(this.props.fontSize);
    const fontFamily = String(this.props.fontFamily) as "title" | "body";
    const width = measureWidth(fontFamily, text, fontSize);
    return { width, height: fontSize };
  }

  render(x: number, y: number): string {
    const { text, fontSize, fontFamily, fontWeight, fill, opacity, stroke, strokeWidth, filter, textAnchor } = this.props;
    const font = String(fontFamily) === "body" ? FONT_BODY : FONT_TITLE;
    let attrs = `x="${x}" y="${y}" font-family="${font}" ` +
      `font-size="${Number(fontSize)}" font-weight="${String(fontWeight)}" ` +
      `fill="${String(fill)}" opacity="${Number(opacity)}"`;
    if (stroke && Number(strokeWidth) > 0) {
      attrs += ` stroke="${String(stroke)}" stroke-width="${Number(strokeWidth)}" stroke-linejoin="round" style="paint-order:stroke fill"`;
    }
    if (filter && String(filter) !== "none") {
      attrs += ` filter="url(#${String(filter)})"`;
    }
    attrs += ` text-anchor="${String(textAnchor || "start")}"`;
    attrs += ` dominant-baseline="hanging"`;
    return `<text ${attrs}>${String(text)}</text>`;
  }

  toJSON(): NodeState {
    const state: NodeState = { type: this.type, props: { ...this.props } };
    if (this.bind) state.bind = { ...this.bind };
    return state;
  }
}

export class TypeDotItem implements LayoutNode {
  readonly type = "type-dot" as const;
  props: Record<string, number | string>;
  bind?: Record<string, string>;

  constructor(props?: Record<string, number | string>, bind?: Record<string, string>) {
    this.props = {
      energyType: "Fire",
      radius: 28,
      grow: 0,
      hAlign: "start",
      marginTop: 0,
      marginRight: 0,
      marginBottom: 0,
      marginLeft: 0,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      vAlign: "middle",
      ...props,
    };
    if (bind) this.bind = bind;
  }

  propDefs(): PropDef[] {
    return [
      { key: "energyType", label: "Type", type: "select", options: ENERGY_TYPES },
      { key: "radius", label: "Radius", type: "number", min: 5, max: 60, step: 1 },
      { key: "grow", label: "Grow", type: "number", min: 0, max: 10, step: 1 },
      { key: "hAlign", label: "H-Align", type: "select", options: ["start", "center", "end"] },
      { key: "marginTop", label: "Margin Top", type: "number", min: -50, max: 50, step: 1 },
      { key: "marginRight", label: "Margin Right", type: "number", min: -50, max: 50, step: 1 },
      { key: "marginBottom", label: "Margin Bottom", type: "number", min: -50, max: 50, step: 1 },
      { key: "marginLeft", label: "Margin Left", type: "number", min: -50, max: 50, step: 1 },
      { key: "paddingTop", label: "Pad Top", type: "number", min: 0, max: 50, step: 1 },
      { key: "paddingRight", label: "Pad Right", type: "number", min: 0, max: 50, step: 1 },
      { key: "paddingBottom", label: "Pad Bottom", type: "number", min: 0, max: 50, step: 1 },
      { key: "paddingLeft", label: "Pad Left", type: "number", min: 0, max: 50, step: 1 },
      { key: "vAlign", label: "V-Align", type: "select", options: ["top", "middle", "bottom"] },
    ];
  }

  measure(): { width: number; height: number } {
    const r = Number(this.props.radius);
    return { width: r * 2, height: r * 2 };
  }

  render(x: number, y: number): string {
    const r = Number(this.props.radius);
    const cx = x + r;
    const cy = y + r;
    return renderTypeIcon(cx, cy, r, String(this.props.energyType));
  }

  toJSON(): NodeState {
    const state: NodeState = { type: this.type, props: { ...this.props } };
    if (this.bind) state.bind = { ...this.bind };
    return state;
  }
}

const SUFFIX_OPTIONS = ["V", "ex", "VSTAR"];

export class SuffixLogoItem implements LayoutNode {
  readonly type = "suffix-logo" as const;
  props: Record<string, number | string>;
  bind?: Record<string, string>;

  constructor(props?: Record<string, number | string>, bind?: Record<string, string>) {
    this.props = {
      suffix: "VSTAR",
      height: 55,
      filter: "none",
      grow: 0,
      hAlign: "start",
      marginTop: 0,
      marginRight: 0,
      marginBottom: 0,
      marginLeft: 0,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      vAlign: "bottom",
      ...props,
    };
    if (bind) this.bind = bind;
  }

  propDefs(): PropDef[] {
    return [
      { key: "suffix", label: "Suffix", type: "select", options: SUFFIX_OPTIONS },
      { key: "height", label: "Height", type: "number", min: 10, max: 120, step: 1 },
      { key: "filter", label: "Filter", type: "select", options: ["none", "shadow", "title-shadow"] },
      { key: "grow", label: "Grow", type: "number", min: 0, max: 10, step: 1 },
      { key: "hAlign", label: "H-Align", type: "select", options: ["start", "center", "end"] },
      { key: "marginTop", label: "Margin Top", type: "number", min: -50, max: 50, step: 1 },
      { key: "marginRight", label: "Margin Right", type: "number", min: -50, max: 50, step: 1 },
      { key: "marginBottom", label: "Margin Bottom", type: "number", min: -50, max: 50, step: 1 },
      { key: "marginLeft", label: "Margin Left", type: "number", min: -50, max: 50, step: 1 },
      { key: "paddingTop", label: "Pad Top", type: "number", min: 0, max: 50, step: 1 },
      { key: "paddingRight", label: "Pad Right", type: "number", min: 0, max: 50, step: 1 },
      { key: "paddingBottom", label: "Pad Bottom", type: "number", min: 0, max: 50, step: 1 },
      { key: "paddingLeft", label: "Pad Left", type: "number", min: 0, max: 50, step: 1 },
      { key: "vAlign", label: "V-Align", type: "select", options: ["top", "middle", "bottom"] },
    ];
  }

  measure(): { width: number; height: number } {
    const h = Number(this.props.height);
    const [, w] = renderSuffixLogo(String(this.props.suffix), 0, 0, h);
    return { width: w, height: h };
  }

  render(x: number, y: number): string {
    const h = Number(this.props.height);
    const filter = String(this.props.filter);
    const filterAttr = filter !== "none" ? `url(#${filter})` : undefined;
    const [svg] = renderSuffixLogo(String(this.props.suffix), x, y, h, filterAttr);
    return svg;
  }

  toJSON(): NodeState {
    const state: NodeState = { type: this.type, props: { ...this.props } };
    if (this.bind) state.bind = { ...this.bind };
    return state;
  }
}

export class WrappedTextItem implements LayoutNode {
  readonly type = "wrapped-text" as const;
  props: Record<string, number | string>;
  bind?: Record<string, string>;
  private _lastAllocatedWidth = 0;

  constructor(props?: Record<string, number | string>, bind?: Record<string, string>) {
    this.props = {
      text: "Description text",
      fontSize: 20,
      fontFamily: "body",
      fontWeight: "bold",
      fill: "#222222",
      opacity: 1,
      filter: "none",
      grow: 0,
      hAlign: "start",
      marginTop: 0,
      marginRight: 0,
      marginBottom: 0,
      marginLeft: 0,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      vAlign: "top",
      ...props,
    };
    if (bind) this.bind = bind;
  }

  propDefs(): PropDef[] {
    return [
      { key: "text", label: "Text", type: "text" },
      { key: "fontSize", label: "Font Size", type: "number", min: 8, max: 120, step: 1 },
      { key: "fontFamily", label: "Font", type: "select", options: ["title", "body"] },
      { key: "fontWeight", label: "Weight", type: "select", options: ["normal", "bold"] },
      { key: "fill", label: "Fill", type: "color" },
      { key: "opacity", label: "Opacity", type: "range", min: 0, max: 1, step: 0.05 },
      { key: "filter", label: "Filter", type: "select", options: ["none", "shadow", "title-shadow", "dmg-shadow"] },
      { key: "grow", label: "Grow", type: "number", min: 0, max: 10, step: 1 },
      { key: "hAlign", label: "H-Align", type: "select", options: ["start", "center", "end"] },
      { key: "marginTop", label: "Margin Top", type: "number", min: -50, max: 50, step: 1 },
      { key: "marginRight", label: "Margin Right", type: "number", min: -50, max: 50, step: 1 },
      { key: "marginBottom", label: "Margin Bottom", type: "number", min: -50, max: 50, step: 1 },
      { key: "marginLeft", label: "Margin Left", type: "number", min: -50, max: 50, step: 1 },
      { key: "paddingTop", label: "Pad Top", type: "number", min: 0, max: 50, step: 1 },
      { key: "paddingRight", label: "Pad Right", type: "number", min: 0, max: 50, step: 1 },
      { key: "paddingBottom", label: "Pad Bottom", type: "number", min: 0, max: 50, step: 1 },
      { key: "paddingLeft", label: "Pad Left", type: "number", min: 0, max: 50, step: 1 },
      { key: "vAlign", label: "V-Align", type: "select", options: ["top", "middle", "bottom"] },
    ];
  }

  measure(allocatedWidth?: number): { width: number; height: number } {
    const text = String(this.props.text);
    const fontSize = Number(this.props.fontSize);
    const fontFamily = String(this.props.fontFamily) as "title" | "body";
    const lineH = Math.floor(fontSize * 1.25);

    if (allocatedWidth != null && allocatedWidth > 0) {
      this._lastAllocatedWidth = allocatedWidth;
      const lines = ftWrap(fontFamily, text, fontSize, allocatedWidth);
      return { width: allocatedWidth, height: Math.max(1, lines.length) * lineH };
    }

    // Single-line fallback
    const width = measureWidth(fontFamily, text, fontSize);
    this._lastAllocatedWidth = width;
    return { width, height: lineH };
  }

  render(x: number, y: number): string {
    const text = String(this.props.text);
    const fontSize = Number(this.props.fontSize);
    const fontFamily = String(this.props.fontFamily) as "title" | "body";
    const fontWeight = String(this.props.fontWeight);
    const fill = String(this.props.fill);
    const opacity = Number(this.props.opacity);
    const filter = String(this.props.filter);
    const font = fontFamily === "body" ? FONT_BODY : FONT_TITLE;
    const lineH = Math.floor(fontSize * 1.25);

    const wrapWidth = this._lastAllocatedWidth || 400;
    const lines = ftWrap(fontFamily, text, fontSize, wrapWidth);

    let attrs = `font-family="${font}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fill}" opacity="${opacity}"`;
    if (filter && filter !== "none") {
      attrs += ` filter="url(#${filter})"`;
    }
    attrs += ` dominant-baseline="hanging"`;

    const tspans = lines.map((line, i) =>
      `<tspan x="${x}" y="${y + i * lineH}">${line}</tspan>`
    ).join("");

    return `<text ${attrs}>${tspans}</text>`;
  }

  toJSON(): NodeState {
    const state: NodeState = { type: this.type, props: { ...this.props } };
    if (this.bind) state.bind = { ...this.bind };
    return state;
  }
}
