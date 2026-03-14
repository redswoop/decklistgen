/**
 * BoxElement — unified container with direction prop.
 * Merges PackedRowElement (horizontal) + StackElement (vertical).
 */

import type { LayoutNode, PropDef, NodeState } from "./types.js";
import { packRow, buildPackItems } from "./packing.js";

export class BoxElement implements LayoutNode {
  readonly type = "box";
  id?: string;
  props: Record<string, number | string>;
  bind?: Record<string, string>;
  children: LayoutNode[];

  constructor(props?: Record<string, number | string>, children?: LayoutNode[], bind?: Record<string, string>, id?: string) {
    if (id) this.id = id;
    this.props = {
      anchorX: 0,
      anchorY: 0,
      direction: "row",
      width: 0,
      gap: 0,
      marginTop: 0,
      marginRight: 0,
      marginBottom: 0,
      marginLeft: 0,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      vAnchor: "top",
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
      { key: "direction", label: "Direction", type: "select", options: ["row", "row-reverse", "column"] },
      { key: "width", label: "Width", type: "number", min: 0, max: 900, step: 1 },
      { key: "gap", label: "Gap", type: "number", min: 0, max: 50, step: 1 },
      { key: "marginTop", label: "Margin Top", type: "number", min: -50, max: 50, step: 1 },
      { key: "marginRight", label: "Margin Right", type: "number", min: -50, max: 50, step: 1 },
      { key: "marginBottom", label: "Margin Bottom", type: "number", min: -50, max: 50, step: 1 },
      { key: "marginLeft", label: "Margin Left", type: "number", min: -50, max: 50, step: 1 },
      { key: "paddingTop", label: "Pad Top", type: "number", min: 0, max: 50, step: 1 },
      { key: "paddingRight", label: "Pad Right", type: "number", min: 0, max: 50, step: 1 },
      { key: "paddingBottom", label: "Pad Bottom", type: "number", min: 0, max: 50, step: 1 },
      { key: "paddingLeft", label: "Pad Left", type: "number", min: 0, max: 50, step: 1 },
      { key: "vAnchor", label: "V-Anchor", type: "select", options: ["top", "bottom"] },
      { key: "fill", label: "Fill", type: "color" },
      { key: "fillOpacity", label: "Fill Opacity", type: "range", min: 0, max: 1, step: 0.05 },
      { key: "rx", label: "Corner Radius", type: "number", min: 0, max: 30, step: 1 },
    ];
  }

  measure(allocatedWidth?: number): { width: number; height: number } {
    const direction = String(this.props.direction);
    if (direction === "column") {
      return this._measureColumn(allocatedWidth);
    }
    return this._measureRow(allocatedWidth);
  }

  render(x: number, y: number, allocatedWidth?: number): string {
    const direction = String(this.props.direction);
    if (direction === "column") {
      return this._renderColumn(x, y);
    }
    return this._renderRow(x, y, allocatedWidth);
  }

  // ── Row layout (row / row-reverse) ──

  private _measureRow(allocatedWidth?: number): { width: number; height: number } {
    if (this.children.length === 0) return { width: 0, height: 0 };

    const packItems = buildPackItems(this.children);
    const packDir = String(this.props.direction) === "row-reverse" ? "rtl" : "ltr";

    const padT = Number(this.props.paddingTop ?? 0);
    const padR = Number(this.props.paddingRight ?? 0);
    const padB = Number(this.props.paddingBottom ?? 0);
    const padL = Number(this.props.paddingLeft ?? 0);

    const rawWidth = Number(this.props.width ?? 0);
    const containerWidth = rawWidth > 0 ? rawWidth : allocatedWidth;
    const innerWidth = containerWidth != null ? Math.max(0, containerWidth - padL - padR) : undefined;
    const { totalWidth, totalHeight } = packRow(packItems, packDir, innerWidth);

    return {
      width: padL + totalWidth + padR,
      height: padT + totalHeight + padB,
    };
  }

  private _renderRow(x: number, y: number, allocatedWidth?: number): string {
    const idAttr = this.id ? ` data-element-id="${this.id}"` : "";
    const mL = Number(this.props.marginLeft ?? 0);
    const mT = Number(this.props.marginTop ?? 0);

    if (this.children.length === 0) {
      return `<g${idAttr}></g>`;
    }

    const packItems = buildPackItems(this.children);
    const packDir = String(this.props.direction) === "row-reverse" ? "rtl" : "ltr";

    const padT = Number(this.props.paddingTop ?? 0);
    const padR = Number(this.props.paddingRight ?? 0);
    const padB = Number(this.props.paddingBottom ?? 0);
    const padL = Number(this.props.paddingLeft ?? 0);

    const rawWidth = Number(this.props.width ?? 0);
    const containerWidth = rawWidth > 0 ? rawWidth : allocatedWidth;
    const innerWidth = containerWidth != null ? Math.max(0, containerWidth - padL - padR) : undefined;
    const { positions, totalWidth, totalHeight } = packRow(packItems, packDir, innerWidth);

    const parts: string[] = [];

    // Background rect
    const bgW = padL + totalWidth + padR;
    const bgH = padT + totalHeight + padB;
    const fill = String(this.props.fill ?? "");
    if (fill) {
      const fillOpacity = Number(this.props.fillOpacity ?? 1);
      const rx = Number(this.props.rx ?? 0);
      parts.push(`<rect width="${bgW}" height="${bgH}" rx="${rx}" fill="${fill}" opacity="${fillOpacity}"/>`);
    }

    for (let i = 0; i < this.children.length; i++) {
      const pos = positions[i];
      parts.push(`<g data-child-index="${i}">${this.children[i].render(pos.x + padL, pos.y + padT)}</g>`);
    }

    return `<g${idAttr} transform="translate(${x + mL},${y + mT})">\n${parts.join("\n")}\n</g>`;
  }

  // ── Column layout ──

  private _measureColumn(allocatedWidth?: number): { width: number; height: number } {
    const totalWidth = Number(this.props.width ?? allocatedWidth ?? 0);
    const padT = Number(this.props.paddingTop ?? 0);
    const padR = Number(this.props.paddingRight ?? 0);
    const padB = Number(this.props.paddingBottom ?? 0);
    const padL = Number(this.props.paddingLeft ?? 0);
    const gap = Number(this.props.gap ?? 0);
    const innerWidth = Math.max(0, totalWidth - padL - padR);

    let cursorY = 0;
    for (let i = 0; i < this.children.length; i++) {
      const child = this.children[i];
      const { height: childH } = child.measure(innerWidth);

      const childMarginTop = Number(child.props.marginTop ?? 0);
      const childMarginBottom = Number(child.props.marginBottom ?? 0);
      const childPadTop = Number(child.props.paddingTop ?? 0);
      const childPadBottom = Number(child.props.paddingBottom ?? 0);

      const outerH = childMarginTop + childPadTop + childH + childPadBottom + childMarginBottom;
      cursorY += outerH;
      if (i < this.children.length - 1) cursorY += gap;
    }

    return { width: totalWidth, height: padT + cursorY + padB };
  }

  private _renderColumn(x: number, y: number): string {
    const mL = Number(this.props.marginLeft ?? 0);
    const mT = Number(this.props.marginTop ?? 0);
    const idAttr = this.id ? ` data-element-id="${this.id}"` : "";

    if (this.children.length === 0) {
      return `<g${idAttr}></g>`;
    }

    const totalWidth = Number(this.props.width ?? 0);
    const padT = Number(this.props.paddingTop ?? 0);
    const padR = Number(this.props.paddingRight ?? 0);
    const padB = Number(this.props.paddingBottom ?? 0);
    const padL = Number(this.props.paddingLeft ?? 0);
    const gap = Number(this.props.gap ?? 0);
    const innerWidth = Math.max(0, totalWidth - padL - padR);

    // Pass 1: measure each child with allocatedWidth
    const measurements = this.children.map(child =>
      child.measure(innerWidth),
    );

    // Pass 2: stack vertically
    const parts: string[] = [];
    let cursorY = 0;

    for (let i = 0; i < this.children.length; i++) {
      const child = this.children[i];
      const { width: childW, height: childH } = measurements[i];

      const childMarginTop = Number(child.props.marginTop ?? 0);
      const childMarginBottom = Number(child.props.marginBottom ?? 0);
      const childPadTop = Number(child.props.paddingTop ?? 0);
      const childPadBottom = Number(child.props.paddingBottom ?? 0);

      const contentY = cursorY + childMarginTop + childPadTop;

      // hAlign within innerWidth
      const hAlign = String(child.props.hAlign ?? "start");
      let contentX: number;
      if (hAlign === "center") {
        contentX = (innerWidth - childW) / 2;
      } else if (hAlign === "end") {
        contentX = innerWidth - childW;
      } else {
        contentX = 0;
      }

      parts.push(`<g data-child-index="${i}">${child.render(contentX + padL, contentY + padT, innerWidth)}</g>`);

      const outerH = childMarginTop + childPadTop + childH + childPadBottom + childMarginBottom;
      cursorY += outerH;
      if (i < this.children.length - 1) cursorY += gap;
    }

    // Background rect
    const bgW = totalWidth;
    const bgH = padT + cursorY + padB;
    const fill = String(this.props.fill ?? "");
    if (fill) {
      const fillOpacity = Number(this.props.fillOpacity ?? 1);
      const rx = Number(this.props.rx ?? 0);
      parts.unshift(`<rect width="${bgW}" height="${bgH}" rx="${rx}" fill="${fill}" opacity="${fillOpacity}"/>`);
    }

    const translateY = y + mT;
    return `<g${idAttr} transform="translate(${x + mL},${translateY})">\n${parts.join("\n")}\n</g>`;
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
