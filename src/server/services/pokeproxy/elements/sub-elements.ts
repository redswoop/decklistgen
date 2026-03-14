/**
 * Sub-element types for use inside PackedRow composites.
 */

import type { PropDef, SubElement, SubElementState } from "./types.js";
import { measureWidth } from "../text.js";
import { renderTypeIcon } from "../type-icons.js";
import { renderSuffixLogo } from "../logos.js";
import { FONT_TITLE, FONT_BODY } from "../constants.js";

const ENERGY_TYPES = [
  "Grass", "Fire", "Water", "Lightning", "Psychic",
  "Fighting", "Darkness", "Metal", "Fairy", "Dragon", "Colorless",
];

export class TextItem implements SubElement {
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

  toJSON(): SubElementState {
    const state: SubElementState = { type: this.type, props: { ...this.props } };
    if (this.bind) state.bind = { ...this.bind };
    return state;
  }
}

export class TypeDotItem implements SubElement {
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

  toJSON(): SubElementState {
    const state: SubElementState = { type: this.type, props: { ...this.props } };
    if (this.bind) state.bind = { ...this.bind };
    return state;
  }
}

const SUFFIX_OPTIONS = ["V", "ex", "VSTAR"];

export class SuffixLogoItem implements SubElement {
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

  toJSON(): SubElementState {
    const state: SubElementState = { type: this.type, props: { ...this.props } };
    if (this.bind) state.bind = { ...this.bind };
    return state;
  }
}

export function createSubElement(state: SubElementState): SubElement {
  switch (state.type) {
    case "text":
      return new TextItem(state.props, state.bind);
    case "type-dot":
      return new TypeDotItem(state.props, state.bind);
    case "suffix-logo":
      return new SuffixLogoItem(state.props, state.bind);
    default:
      throw new Error(`Unknown sub-element type: ${(state as SubElementState).type}`);
  }
}
