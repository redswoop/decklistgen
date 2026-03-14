/**
 * PackedRowElement — packs children horizontally with flexbox-like layout.
 * Works at any depth in the element tree.
 */

import type { LayoutNode, PropDef, NodeState } from "./types.js";
import { packRow, buildPackItems } from "./packing.js";

export class PackedRowElement implements LayoutNode {
  readonly type = "packed-row";
  id?: string;
  props: Record<string, number | string>;
  bind?: Record<string, string>;
  children: LayoutNode[];

  constructor(props?: Record<string, number | string>, children?: LayoutNode[], bind?: Record<string, string>, id?: string) {
    if (id) this.id = id;
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
    this.children = children ?? [];
    if (bind) this.bind = bind;
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

  measure(allocatedWidth?: number): { width: number; height: number } {
    if (this.children.length === 0) return { width: 0, height: 0 };

    const packItems = buildPackItems(this.children);
    const direction = String(this.props.direction) as "ltr" | "rtl";

    const padT = Number(this.props.paddingTop ?? 0);
    const padR = Number(this.props.paddingRight ?? 0);
    const padB = Number(this.props.paddingBottom ?? 0);
    const padL = Number(this.props.paddingLeft ?? 0);

    const rawWidth = Number(this.props.width ?? 0);
    const containerWidth = rawWidth > 0 ? rawWidth : allocatedWidth;
    const innerWidth = containerWidth != null ? Math.max(0, containerWidth - padL - padR) : undefined;
    const { totalWidth, totalHeight } = packRow(packItems, direction, innerWidth);

    return {
      width: padL + totalWidth + padR,
      height: padT + totalHeight + padB,
    };
  }

  render(x: number, y: number, allocatedWidth?: number): string {
    const idAttr = this.id ? ` data-element-id="${this.id}"` : "";

    if (this.children.length === 0) {
      return `<g${idAttr}></g>`;
    }

    const packItems = buildPackItems(this.children);
    const direction = String(this.props.direction) as "ltr" | "rtl";

    // Container padding — insets children from the background edge
    const padT = Number(this.props.paddingTop ?? 0);
    const padR = Number(this.props.paddingRight ?? 0);
    const padB = Number(this.props.paddingBottom ?? 0);
    const padL = Number(this.props.paddingLeft ?? 0);

    // Inner width available for children = width minus container padding
    const rawWidth = Number(this.props.width ?? 0);
    const containerWidth = rawWidth > 0 ? rawWidth : allocatedWidth;
    const innerWidth = containerWidth != null ? Math.max(0, containerWidth - padL - padR) : undefined;
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

    // Container margin offsets the translate from the given position
    const mL = Number(this.props.marginLeft ?? 0);
    const mT = Number(this.props.marginTop ?? 0);
    return `<g${idAttr} transform="translate(${x + mL},${y + mT})">\n${parts.join("\n")}\n</g>`;
  }

  toJSON(): NodeState {
    const state: NodeState = {
      type: this.type,
      props: { ...this.props },
      children: this.children.map(c => c.toJSON()),
    };
    if (this.id) state.id = this.id;
    if (this.bind) state.bind = { ...this.bind };
    return state;
  }
}
