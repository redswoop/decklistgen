/**
 * ImageElement — unified image widget.
 * Merges TypeDotItem (energy icons), SuffixLogoItem (inline logos), and BigLogoElement (decorative logos).
 */

import type { PropDef, LayoutNode, NodeState } from "./types.js";
import { renderTypeIcon } from "../type-icons.js";
import { renderSuffixLogo } from "../logos.js";
import { getImagePropDefs } from "@shared/constants/prop-defs.js";

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
    return getImagePropDefs(String(this.props.src));
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
      const svg = renderTypeIcon(cx, cy, r, String(this.props.energyType));
      return idAttr ? `<g${idAttr}>${svg}</g>` : svg;
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

    return idAttr ? `<g${idAttr}>${logoSvg}</g>` : logoSvg;
  }

  toJSON(): NodeState {
    const state: NodeState = { type: this.type, props: { ...this.props } };
    if (this.id) state.id = this.id;
    if (this.bind) state.bind = { ...this.bind };
    return state;
  }
}
