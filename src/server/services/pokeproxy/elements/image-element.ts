/**
 * ImageElement — unified image widget.
 * Merges TypeDotItem (energy icons), SuffixLogoItem (inline logos), and BigLogoElement (decorative logos).
 */

import type { PropDef, LayoutNode, NodeState } from "./types.js";
import { renderTypeIcon } from "../type-icons.js";
import { renderSuffixLogo } from "../logos.js";

const ENERGY_TYPES = [
  "Grass", "Fire", "Water", "Lightning", "Psychic",
  "Fighting", "Darkness", "Metal", "Fairy", "Dragon", "Colorless",
];

const SUFFIX_OPTIONS = ["V", "ex", "VSTAR", "VSTAR-big"];

export class ImageElement implements LayoutNode {
  readonly type = "image" as const;
  id?: string;
  props: Record<string, number | string>;
  bind?: Record<string, string>;

  constructor(props?: Record<string, number | string>, bind?: Record<string, string>, id?: string) {
    if (id) this.id = id;
    this.props = {
      src: "energy",
      energyType: "Fire",
      radius: 28,
      suffix: "VSTAR",
      height: 55,
      opacity: 1,
      clipToCard: 0,
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
      vAlign: "middle",
      ...props,
    };
    if (bind) this.bind = bind;
  }

  propDefs(): PropDef[] {
    const src = String(this.props.src);
    const defs: PropDef[] = [
      { key: "src", label: "Source", type: "select", options: ["energy", "logo"] },
    ];
    if (src === "energy") {
      defs.push(
        { key: "energyType", label: "Type", type: "select", options: ENERGY_TYPES },
        { key: "radius", label: "Radius", type: "number", min: 5, max: 60, step: 1 },
      );
    } else {
      defs.push(
        { key: "suffix", label: "Logo", type: "select", options: SUFFIX_OPTIONS },
        { key: "height", label: "Height", type: "number", min: 10, max: 600, step: 1 },
        { key: "opacity", label: "Opacity", type: "range", min: 0, max: 1, step: 0.05 },
        { key: "clipToCard", label: "Clip", type: "select", options: ["0", "1"] },
        { key: "filter", label: "Filter", type: "select", options: ["none", "shadow", "title-shadow"] },
      );
    }
    defs.push(
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
    );
    return defs;
  }

  measure(): { width: number; height: number } {
    if (String(this.props.src) === "energy") {
      const r = Number(this.props.radius);
      return { width: r * 2, height: r * 2 };
    }
    const h = Number(this.props.height);
    const [, w] = renderSuffixLogo(String(this.props.suffix), 0, 0, h);
    return { width: w, height: h };
  }

  render(x: number, y: number): string {
    const idAttr = this.id ? ` data-element-id="${this.id}"` : "";

    if (String(this.props.src) === "energy") {
      const r = Number(this.props.radius);
      const cx = x + r;
      const cy = y + r;
      return renderTypeIcon(cx, cy, r, String(this.props.energyType));
    }

    // Logo rendering
    const h = Number(this.props.height);
    const filter = String(this.props.filter);
    const filterAttr = filter !== "none" ? `url(#${filter})` : undefined;
    const [logoSvg] = renderSuffixLogo(String(this.props.suffix), x, y, h, filterAttr);

    if (Number(this.props.clipToCard)) {
      const opacity = Number(this.props.opacity ?? 1);
      if (!logoSvg) return `<g${idAttr}></g>`;
      return `<g${idAttr} opacity="${opacity}" clip-path="url(#card-clip)">${logoSvg}</g>`;
    }

    return logoSvg;
  }

  toJSON(): NodeState {
    const state: NodeState = { type: this.type, props: { ...this.props } };
    if (this.id) state.id = this.id;
    if (this.bind) state.bind = { ...this.bind };
    return state;
  }
}
