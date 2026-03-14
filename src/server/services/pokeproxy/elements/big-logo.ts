/**
 * BigLogoElement — large decorative suffix logo (V/VSTAR) on fullart cards.
 */

import type { LayoutNode, PropDef, NodeState } from "./types.js";
import { renderSuffixLogo } from "../logos.js";

const SUFFIX_OPTIONS = ["V", "ex", "VSTAR", "VSTAR-big"];

export class BigLogoElement implements LayoutNode {
  readonly type = "big-logo";
  id?: string;
  props: Record<string, number | string>;

  constructor(props?: Record<string, number | string>, id?: string) {
    if (id) this.id = id;
    this.props = {
      x: -50,
      y: -38,
      height: 280,
      opacity: 0.7,
      suffix: "VSTAR-big",
      ...props,
    };
  }

  propDefs(): PropDef[] {
    return [
      { key: "x", label: "X", type: "number", min: -200, max: 750, step: 1, isPosition: true },
      { key: "y", label: "Y", type: "number", min: -200, max: 1050, step: 1, isPosition: true },
      { key: "height", label: "Height", type: "range", min: 50, max: 600, step: 10 },
      { key: "opacity", label: "Opacity", type: "range", min: 0, max: 1, step: 0.05 },
      { key: "suffix", label: "Logo", type: "select", options: SUFFIX_OPTIONS },
    ];
  }

  measure(): { width: number; height: number } {
    const h = Number(this.props.height);
    const [, w] = renderSuffixLogo(String(this.props.suffix), 0, 0, h);
    return { width: w, height: h };
  }

  render(x: number, y: number): string {
    const { height, opacity, suffix } = this.props;
    const [logoSvg] = renderSuffixLogo(
      String(suffix),
      x,
      y,
      Number(height),
    );
    const idAttr = this.id ? ` data-element-id="${this.id}"` : "";
    if (!logoSvg) return `<g${idAttr}></g>`;
    return `<g${idAttr} opacity="${Number(opacity)}" clip-path="url(#card-clip)">${logoSvg}</g>`;
  }

  toJSON(): NodeState {
    const state: NodeState = { type: this.type, props: { ...this.props } };
    if (this.id) state.id = this.id;
    return state;
  }
}
