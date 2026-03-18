/**
 * BoxElement — unified container with direction prop.
 * Merges PackedRowElement (horizontal) + StackElement (vertical).
 */

import type { LayoutNode, PropDef, NodeState } from "./types.js";
import { packRow, buildPackItems } from "./packing.js";
import { PROP_DEFS } from "@shared/constants/prop-defs.js";
import { CARD_W, CARD_H } from "../constants.js";
import { getCardIdPrefix } from "../svg-frame.js";
import { getGradient } from "../gradient-store.js";

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
      hAnchor: "left",
      fill: "",
      fillOpacity: 1,
      stroke: "",
      strokeWidth: 0,
      rx: 0,
      filter: "none",
      ...props,
    };
    this.children = children ?? [];
    if (bind) this.bind = bind;
  }

  propDefs(): PropDef[] {
    return PROP_DEFS.box;
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
      return this._renderColumn(x, y, allocatedWidth);
    }
    return this._renderRow(x, y, allocatedWidth);
  }

  private _bgElement(w: number, h: number, absX?: number, absY?: number): string | null {
    const fill = String(this.props.fill ?? "");
    const stroke = String(this.props.stroke ?? "");
    if (!fill && !stroke) return null;

    // When a valid fillGradient is active, the gradient layer handles the bg — skip solid rect
    const fillGradientName = String(this.props.fillGradient ?? "");
    if (fillGradientName && fill && getGradient(fillGradientName)) return null;

    const rx = Number(this.props.rx ?? 0);
    const filter = String(this.props.filter ?? "none");

    // Glass blur: clip the background image into the box bounds, blur it, overlay a tinted rect
    if (filter === "glass-blur" && absX != null && absY != null) {
      const p = getCardIdPrefix();
      const uid = this.id ?? Math.random().toString(36).slice(2, 8);
      const clipId = `${p}glass-clip-${uid}`;
      const filterId = `${p}glass-blur-${uid}`;
      const blurRadius = Number(this.props.blurRadius ?? 18);
      const fillOpacity = Number(this.props.fillOpacity ?? 1);
      const parts: string[] = [];
      parts.push(`<defs>`);
      parts.push(`<clipPath id="${clipId}"><rect width="${w}" height="${h}"${rx ? ` rx="${rx}"` : ""}/></clipPath>`);
      parts.push(`<filter id="${filterId}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${blurRadius}"/></filter>`);
      parts.push(`</defs>`);
      parts.push(`<g clip-path="url(#${clipId})">`);
      parts.push(`<use href="#${p}bg-image" x="${-absX}" y="${-absY}" width="${CARD_W}" height="${CARD_H}" filter="url(#${filterId})"/>`);
      parts.push(`<rect width="${w}" height="${h}" fill="${fill}" opacity="${fillOpacity}"${rx ? ` rx="${rx}"` : ""}/>`);
      parts.push(`</g>`);
      if (stroke) {
        const sw = Number(this.props.strokeWidth ?? 1);
        parts.push(`<rect width="${w}" height="${h}"${rx ? ` rx="${rx}"` : ""} fill="none" stroke="${stroke}" stroke-width="${sw}"/>`);
      }
      return parts.join("\n");
    }

    // Standard solid rect
    let attrs = `width="${w}" height="${h}"`;
    if (rx) attrs += ` rx="${rx}"`;
    if (fill) {
      const fillOpacity = Number(this.props.fillOpacity ?? 1);
      attrs += ` fill="${fill}" opacity="${fillOpacity}"`;
    } else {
      attrs += ` fill="none"`;
    }
    if (stroke) {
      const sw = Number(this.props.strokeWidth ?? 1);
      attrs += ` stroke="${stroke}" stroke-width="${sw}"`;
    }
    return `<rect ${attrs}/>`;
  }

  /**
   * Gradient layer — rendered as a separate <g> BEFORE the box's content <g>,
   * so the gradient rect doesn't share a compositing group with children.
   */
  private _gradientLayer(w: number, h: number, absX: number, absY: number): string | null {
    const fillGradientName = String(this.props.fillGradient ?? "");
    const fill = String(this.props.fill ?? "");
    if (!fillGradientName || !fill) return null;

    const gradDef = getGradient(fillGradientName);
    if (!gradDef) return null;

    const p = getCardIdPrefix();
    const uid = this.id ?? Math.random().toString(36).slice(2, 8);
    const gradId = `${p}grad-${uid}`;
    const rx = Number(this.props.rx ?? 0);
    const stops = gradDef.stops.map(s =>
      `<stop offset="${s.offset}" stop-color="${fill}" stop-opacity="${s.opacity}"/>`,
    ).join("");
    const parts: string[] = [];
    parts.push(`<g transform="translate(${absX},${absY})">`);
    parts.push(`<defs><linearGradient id="${gradId}" x1="${gradDef.x1}" y1="${gradDef.y1}" x2="${gradDef.x2}" y2="${gradDef.y2}">${stops}</linearGradient></defs>`);
    let rectAttrs = `width="${w}" height="${h}" fill="url(#${gradId})"`;
    if (rx) rectAttrs += ` rx="${rx}"`;
    parts.push(`<rect ${rectAttrs}/>`);
    parts.push(`</g>`);
    return parts.join("\n");
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

    // Background element (solid rect or glass blur)
    const absX = x + mL;
    const absY = y + mT;
    const bgW = padL + totalWidth + padR;
    const bgH = padT + totalHeight + padB;

    // Gradient layer — separate <g> rendered before content to avoid shared compositing
    const gradLayer = this._gradientLayer(bgW, bgH, absX, absY);

    const contentParts: string[] = [];
    const bg = this._bgElement(bgW, bgH, absX, absY);
    if (bg) contentParts.push(bg);

    for (let i = 0; i < this.children.length; i++) {
      const pos = positions[i];
      const ci = Number(this.children[i].props._templateIndex ?? i);
      const vis = Number(this.children[i].props._hidden) ? ' visibility="hidden"' : "";
      contentParts.push(`<g data-child-index="${ci}"${vis}>${this.children[i].render(pos.x + padL, pos.y + padT)}</g>`);
    }

    if (gradLayer) parts.push(gradLayer);
    parts.push(`<g${idAttr} transform="translate(${absX},${absY})">\n${contentParts.join("\n")}\n</g>`);
    return parts.join("\n");
  }

  // ── Column layout ──

  private _measureColumn(allocatedWidth?: number): { width: number; height: number } {
    const rawWidth = Number(this.props.width ?? 0);
    const totalWidth = rawWidth > 0 ? rawWidth : (allocatedWidth ?? 0);
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

      // Box.measure() already includes its own padding/margin, so don't add them again
      const isBox = child.type === "box";
      const childMarginTop = isBox ? 0 : Number(child.props.marginTop ?? 0);
      const childMarginBottom = isBox ? 0 : Number(child.props.marginBottom ?? 0);
      const childPadTop = isBox ? 0 : Number(child.props.paddingTop ?? 0);
      const childPadBottom = isBox ? 0 : Number(child.props.paddingBottom ?? 0);

      const outerH = childMarginTop + childPadTop + childH + childPadBottom + childMarginBottom;
      cursorY += outerH;
      if (i < this.children.length - 1) cursorY += gap;
    }

    return { width: totalWidth, height: padT + cursorY + padB };
  }

  private _renderColumn(x: number, y: number, allocatedWidth?: number): string {
    const mL = Number(this.props.marginLeft ?? 0);
    const mT = Number(this.props.marginTop ?? 0);
    const idAttr = this.id ? ` data-element-id="${this.id}"` : "";

    if (this.children.length === 0) {
      return `<g${idAttr}></g>`;
    }

    const rawWidth = Number(this.props.width ?? 0);
    const totalWidth = rawWidth > 0 ? rawWidth : (allocatedWidth ?? 0);
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

      // Box handles its own margin/padding in render(), so don't add them here
      const isBox = child.type === "box";
      const childMarginTop = isBox ? 0 : Number(child.props.marginTop ?? 0);
      const childMarginBottom = isBox ? 0 : Number(child.props.marginBottom ?? 0);
      const childPadTop = isBox ? 0 : Number(child.props.paddingTop ?? 0);
      const childPadBottom = isBox ? 0 : Number(child.props.paddingBottom ?? 0);

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

      const ci = Number(child.props._templateIndex ?? i);
      const vis = Number(child.props._hidden) ? ' visibility="hidden"' : "";
      parts.push(`<g data-child-index="${ci}"${vis}>${child.render(contentX + padL, contentY + padT, innerWidth)}</g>`);

      const outerH = childMarginTop + childPadTop + childH + childPadBottom + childMarginBottom;
      cursorY += outerH;
      if (i < this.children.length - 1) cursorY += gap;
    }

    // Background element (solid rect or glass blur)
    const absX = x + mL;
    const absY = y + mT;
    const bgW = totalWidth;
    const bgH = padT + cursorY + padB;
    const bg = this._bgElement(bgW, bgH, absX, absY);
    if (bg) parts.unshift(bg);

    // Gradient layer — separate <g> rendered before content to avoid shared compositing
    const gradLayer = this._gradientLayer(bgW, bgH, absX, absY);
    const outer: string[] = [];
    if (gradLayer) outer.push(gradLayer);
    outer.push(`<g${idAttr} transform="translate(${absX},${absY})">\n${parts.join("\n")}\n</g>`);
    return outer.join("\n");
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
