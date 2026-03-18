/**
 * TextElement — unified text widget with optional wrap mode.
 * Merges TextItem (single-line) + WrappedTextItem (multi-line).
 */

import type { PropDef, LayoutNode, NodeState } from "./types.js";
import { measureWidth, ftWrap } from "../text.js";
import { FONT_TITLE, FONT_BODY, ENERGY_COLORS_DARK, ENERGY_COLORS_LIGHT } from "../constants.js";
import type { EnergyPalette } from "../constants.js";
import { escapeXml } from "../svg-helpers.js";
import { SUB_PROP_DEFS } from "@shared/constants/prop-defs.js";

export function expandEnergyTokens(text: string, fontSize: number, palette: EnergyPalette): string {
  return text.replace(/\{([A-Z])\}/g, (_, letter: string) => {
    const color = palette[letter] ?? "#888";
    const glyphSize = Math.floor(fontSize * 1.1);
    // Shift glyph up to vertically center with surrounding text.
    // The icon font has different metrics, so we nudge by ~15% of fontSize.
    const dy = -Math.round(fontSize * 0.15);
    const baseline = `dy="${dy}" dominant-baseline="auto"`;
    if (letter === "N") {
      return `<tspan fill="${color}" font-size="${glyphSize}" ${baseline}>&#x25CF;</tspan>`;
    }
    return `<tspan font-family="EssentiarumTCG" fill="${color}" font-size="${glyphSize}" ${baseline}>${letter}</tspan>`;
  });
}

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
      palette: "dark",
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
    return SUB_PROP_DEFS.text;
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
    const pal = String(this.props.palette) === "light" ? ENERGY_COLORS_LIGHT : ENERGY_COLORS_DARK;
    const content = expandEnergyTokens(escapeXml(String(text)), Number(fontSize), pal);
    return `<text ${attrs}>${content}</text>`;
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
    const stroke = String(this.props.stroke);
    const strokeWidth = Number(this.props.strokeWidth);
    if (stroke && strokeWidth > 0) {
      attrs += ` stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" style="paint-order:stroke fill"`;
    }
    if (filter && filter !== "none") {
      attrs += ` filter="url(#${filter})"`;
    }
    const textAnchor = String(this.props.textAnchor || "start");
    attrs += ` text-anchor="${textAnchor}"`;
    attrs += ` dominant-baseline="hanging"`;

    const pal = String(this.props.palette) === "light" ? ENERGY_COLORS_LIGHT : ENERGY_COLORS_DARK;
    const tspans = lines.map((line, i) => {
      const content = expandEnergyTokens(escapeXml(line), fontSize, pal);
      return `<tspan x="${x}" y="${y + i * lineH}">${content}</tspan>`;
    }).join("");

    return `<text ${attrs}>${tspans}</text>`;
  }

  toJSON(): NodeState {
    const state: NodeState = { type: this.type, props: { ...this.props } };
    if (this.bind) state.bind = { ...this.bind };
    return state;
  }
}
