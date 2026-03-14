/**
 * TextElement — unified text widget with optional wrap mode.
 * Merges TextItem (single-line) + WrappedTextItem (multi-line).
 */

import type { PropDef, LayoutNode, NodeState } from "./types.js";
import { measureWidth, ftWrap } from "../text.js";
import { FONT_TITLE, FONT_BODY } from "../constants.js";

export class TextElement implements LayoutNode {
  readonly type = "text" as const;
  props: Record<string, number | string>;
  bind?: Record<string, string>;
  private _lastAllocatedWidth = 0;

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
      wrap: 0,
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
      { key: "wrap", label: "Wrap", type: "select", options: ["0", "1"] },
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

    if (Number(this.props.wrap)) {
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

    const width = measureWidth(fontFamily, text, fontSize);
    return { width, height: fontSize };
  }

  render(x: number, y: number): string {
    if (Number(this.props.wrap)) {
      return this._renderWrapped(x, y);
    }
    return this._renderSingle(x, y);
  }

  private _renderSingle(x: number, y: number): string {
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

  private _renderWrapped(x: number, y: number): string {
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
