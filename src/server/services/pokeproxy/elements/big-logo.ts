/**
 * BigLogoElement — large decorative suffix logo (V/VSTAR) on fullart cards.
 */

import type { CardElement, PropDef, ElementState } from "./types.js";
import { renderSuffixLogo } from "../logos.js";

const SUFFIX_OPTIONS = ["V", "ex", "VSTAR", "VSTAR-big"];

export class BigLogoElement implements CardElement {
  readonly type = "big-logo";
  readonly id: string;
  props: Record<string, number | string>;

  constructor(id: string, props?: Record<string, number | string>) {
    this.id = id;
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

  render(): string {
    const { x, y, height, opacity, suffix } = this.props;
    const [logoSvg] = renderSuffixLogo(
      String(suffix),
      Number(x),
      Number(y),
      Number(height),
    );
    if (!logoSvg) return `<g data-element-id="${this.id}"></g>`;
    return `<g data-element-id="${this.id}" opacity="${Number(opacity)}" clip-path="url(#card-clip)">${logoSvg}</g>`;
  }

  toJSON(): ElementState {
    return { type: this.type, id: this.id, props: { ...this.props } };
  }
}
