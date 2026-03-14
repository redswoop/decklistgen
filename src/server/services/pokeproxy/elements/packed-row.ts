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
      width: 0,
      marginTop: 0,
      marginRight: 0,
      marginBottom: 0,
      marginLeft: 0,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
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
      { key: "width", label: "Width", type: "number", min: 0, max: 900, step: 1 },
      { key: "marginTop", label: "Margin Top", type: "number", min: -50, max: 50, step: 1 },
      { key: "marginRight", label: "Margin Right", type: "number", min: -50, max: 50, step: 1 },
      { key: "marginBottom", label: "Margin Bottom", type: "number", min: -50, max: 50, step: 1 },
      { key: "marginLeft", label: "Margin Left", type: "number", min: -50, max: 50, step: 1 },
      { key: "paddingTop", label: "Pad Top", type: "number", min: 0, max: 50, step: 1 },
      { key: "paddingRight", label: "Pad Right", type: "number", min: 0, max: 50, step: 1 },
      { key: "paddingBottom", label: "Pad Bottom", type: "number", min: 0, max: 50, step: 1 },
      { key: "paddingLeft", label: "Pad Left", type: "number", min: 0, max: 50, step: 1 },
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
        grow: Number(child.props.grow ?? 0),
        hAlign: (String(child.props.hAlign ?? "start")) as "start" | "center" | "end",
      };
    });

    const direction = String(this.props.direction) as "ltr" | "rtl";

    // Container padding — insets children from the background edge
    const padT = Number(this.props.paddingTop ?? 0);
    const padR = Number(this.props.paddingRight ?? 0);
    const padB = Number(this.props.paddingBottom ?? 0);
    const padL = Number(this.props.paddingLeft ?? 0);

    // Inner width available for children = width minus container padding
    const rawWidth = Number(this.props.width ?? 0);
    const innerWidth = rawWidth > 0 ? Math.max(0, rawWidth - padL - padR) : undefined;
    const { positions, totalWidth, totalHeight } = packRow(packItems, direction, innerWidth);

    const parts: string[] = [];

    // Background rect — includes container padding
    const bgW = padL + totalWidth + padR;
    const bgH = padT + totalHeight + padB;
    const fill = String(this.props.fill ?? "");
    if (fill) {
      const fillOpacity = Number(this.props.fillOpacity ?? 1);
      const rx = Number(this.props.rx ?? 0);
      parts.push(`<rect width="${bgW}" height="${bgH}" rx="${rx}" fill="${fill}" opacity="${fillOpacity}"/>`);
    }

    // Children offset by container padding
    for (let i = 0; i < this.children.length; i++) {
      const pos = positions[i];
      parts.push(`<g data-child-index="${i}">${this.children[i].render(pos.x + padL, pos.y + padT)}</g>`);
    }

    // Container margin offsets the translate from the anchor
    const mL = Number(this.props.marginLeft ?? 0);
    const mT = Number(this.props.marginTop ?? 0);
    const ax = Number(this.props.anchorX) + mL;
    const ay = Number(this.props.anchorY) + mT;
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
