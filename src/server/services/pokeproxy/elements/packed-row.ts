/**
 * PackedRowElement — composite element that packs sub-elements horizontally.
 */

import type { CardElement, PropDef, ElementState, SubElement, SubElementState } from "./types.js";
import type { PackItem } from "./packing.js";
import { packRow } from "./packing.js";
import { createSubElement } from "./sub-elements.js";

export class PackedRowElement implements CardElement {
  readonly type = "packed-row";
  readonly id: string;
  props: Record<string, number | string>;
  children: SubElement[];

  constructor(id: string, props?: Record<string, number | string>, children?: SubElementState[]) {
    this.id = id;
    this.props = {
      anchorX: 718,
      anchorY: 10,
      direction: "rtl",
      fill: "",
      fillOpacity: 1,
      rx: 0,
      ...props,
    };
    this.children = (children ?? []).map(c => createSubElement(c));
  }

  propDefs(): PropDef[] {
    return [
      { key: "anchorX", label: "Anchor X", type: "number", min: -200, max: 900, step: 1, isPosition: true },
      { key: "anchorY", label: "Anchor Y", type: "number", min: -200, max: 1100, step: 1, isPosition: true },
      { key: "direction", label: "Direction", type: "select", options: ["ltr", "rtl"] },
      { key: "fill", label: "Fill", type: "color" },
      { key: "fillOpacity", label: "Fill Opacity", type: "range", min: 0, max: 1, step: 0.05 },
      { key: "rx", label: "Corner Radius", type: "number", min: 0, max: 30, step: 1 },
    ];
  }

  render(): string {
    if (this.children.length === 0) {
      return `<g data-element-id="${this.id}"></g>`;
    }

    const packItems: PackItem[] = this.children.map(child => {
      const { width, height } = child.measure();
      return {
        contentWidth: width,
        contentHeight: height,
        marginTop: Number(child.props.marginTop ?? 0),
        marginRight: Number(child.props.marginRight ?? 0),
        marginBottom: Number(child.props.marginBottom ?? 0),
        marginLeft: Number(child.props.marginLeft ?? 0),
        paddingTop: Number(child.props.paddingTop ?? 0),
        paddingRight: Number(child.props.paddingRight ?? 0),
        paddingBottom: Number(child.props.paddingBottom ?? 0),
        paddingLeft: Number(child.props.paddingLeft ?? 0),
        vAlign: (String(child.props.vAlign ?? "top")) as "top" | "middle" | "bottom",
      };
    });

    const direction = String(this.props.direction) as "ltr" | "rtl";
    const { positions, totalWidth, totalHeight } = packRow(packItems, direction);

    const parts: string[] = [];

    // Background rect
    const fill = String(this.props.fill ?? "");
    if (fill) {
      const fillOpacity = Number(this.props.fillOpacity ?? 1);
      const rx = Number(this.props.rx ?? 0);
      parts.push(`<rect width="${totalWidth}" height="${totalHeight}" rx="${rx}" fill="${fill}" opacity="${fillOpacity}"/>`);
    }

    for (let i = 0; i < this.children.length; i++) {
      const pos = positions[i];
      parts.push(`<g data-child-index="${i}">${this.children[i].render(pos.x, pos.y)}</g>`);
    }

    const ax = Number(this.props.anchorX);
    const ay = Number(this.props.anchorY);
    return `<g data-element-id="${this.id}" transform="translate(${ax},${ay})">\n${parts.join("\n")}\n</g>`;
  }

  toJSON(): ElementState {
    return {
      type: this.type,
      id: this.id,
      props: { ...this.props },
      children: this.children.map(c => c.toJSON()),
    };
  }
}
