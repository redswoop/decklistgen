/**
 * Layout resolver — takes an unresolved tree and computes absolute positions.
 * Game-agnostic: knows only about boxes, text, icons, images, lines, shapes, logos.
 */

import type { LayoutNode, BoxNode, ResolvedNode, Insets } from "./types.js";
import { normalizeInsets } from "./types.js";
import { measureWidth } from "../text.js";
import { renderSuffixLogo } from "../logos.js";

/** Measure the intrinsic (content-based) size of a leaf node. */
function measureNode(node: LayoutNode, availW: number): { w: number; h: number } {
  switch (node.type) {
    case "text": {
      const w = node.flex ? availW : measureWidth(node.font, node.content, node.fontSize);
      const h = Math.floor(node.fontSize * 1.25);
      return { w, h };
    }
    case "icon":
      return { w: node.radius * 2, h: node.radius * 2 };
    case "image":
      return { w: availW, h: node.height ?? 0 };
    case "line":
      return { w: availW, h: 1 };
    case "shape":
      return { w: node.size * 2, h: node.size * 2 };
    case "logo": {
      const [, logoW] = renderSuffixLogo(node.logoKey, 0, 0, node.height);
      return { w: logoW, h: node.height };
    }
    case "box": {
      const r = resolveBox(node, 0, 0, availW, node.height ?? 0);
      // For rows without explicit width, return intrinsic content width
      // so they don't eat all available space in a parent row.
      if (node.direction === "row" && node.width == null && r.children && r.children.length > 0) {
        const pad = normalizeInsets(node.padding);
        const g = node.gap ?? 0;
        let cw = 0;
        for (const rc of r.children) cw += rc.width;
        cw += g * (r.children.length - 1);
        return { w: cw + pad.left + pad.right, h: r.h };
      }
      return { w: r.w, h: r.h };
    }
    default:
      return { w: 0, h: 0 };
  }
}

function resolveBox(box: BoxNode, x: number, y: number, availW: number, availH: number): ResolvedNode & { w: number; h: number } {
  const pad = normalizeInsets(box.padding);
  const dir = box.direction ?? "column";
  const gap = box.gap ?? 0;
  const contentW = (box.width ?? availW) - pad.left - pad.right;
  const contentX = x + pad.left;
  const contentY = y + pad.top;

  const children = box.children;
  const resolved: ResolvedNode[] = [];

  if (dir === "column") {
    // First pass: measure non-flex children
    let fixedH = 0;
    let flexTotal = 0;
    const measured: Array<{ h: number; flex: number }> = [];

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const flex = (child.type === "box" || child.type === "image" || child.type === "text") ? (child.flex ?? 0) : 0;
      if (flex > 0) {
        flexTotal += flex;
        measured.push({ h: 0, flex });
      } else {
        let h: number;
        if (child.type === "box" && child.height != null) {
          h = child.height;
        } else {
          h = measureNode(child, contentW).h;
        }
        measured.push({ h, flex: 0 });
        fixedH += h;
      }
      if (i < children.length - 1) fixedH += gap;
    }

    // Available height for flex children
    const contentH = box.height != null
      ? (box.height - pad.top - pad.bottom)
      : (availH > 0 ? availH - pad.top - pad.bottom : 0);
    const flexSpace = Math.max(0, contentH - fixedH);

    // Second pass: position children
    let cy = contentY;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const m = measured[i];
      let childH: number;
      if (m.flex > 0) {
        childH = flexTotal > 0 ? Math.floor(flexSpace * m.flex / flexTotal) : 0;
        // Apply min/max constraints
        if (child.type === "box") {
          if (child.minHeight != null) childH = Math.max(childH, child.minHeight);
          if (child.maxHeight != null) childH = Math.min(childH, child.maxHeight);
        }
      } else {
        childH = m.h;
      }

      const r = resolveChild(child, contentX, cy, contentW, childH);
      resolved.push(r);
      cy += childH + gap;
    }

    const computedH = cy - contentY - (children.length > 0 ? gap : 0) + pad.top + pad.bottom;
    const totalH = box.height ?? (availH > 0 ? availH : computedH);
    const w = box.width ?? availW;
    return { node: box, x, y, width: w, height: totalH, children: resolved, w, h: totalH };
  } else {
    // Row layout
    // First pass: measure non-flex children
    let fixedW = 0;
    let flexTotal = 0;
    const measured: Array<{ w: number; h: number; flex: number }> = [];

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const flex = (child.type === "box" || child.type === "text") ? (child.flex ?? 0) : 0;
      if (flex > 0) {
        flexTotal += flex;
        measured.push({ w: 0, h: 0, flex });
      } else {
        const m = measureNode(child, contentW);
        measured.push({ w: m.w, h: m.h, flex: 0 });
        fixedW += m.w;
      }
      if (i < children.length - 1) fixedW += gap;
    }

    const flexSpace = Math.max(0, contentW - fixedW);
    const rowH = box.height != null
      ? (box.height - pad.top - pad.bottom)
      : Math.max(...measured.map(m => m.h), 0);

    // Second pass: position children
    let cx = contentX;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const m = measured[i];
      let childW: number;
      if (m.flex > 0) {
        childW = flexTotal > 0 ? Math.floor(flexSpace * m.flex / flexTotal) : 0;
      } else {
        childW = m.w;
      }

      // Cross-axis alignment
      let childY = contentY;
      const childH = m.flex > 0 ? rowH : m.h;
      const align = box.align ?? "start";
      if (align === "center") {
        childY = contentY + Math.floor((rowH - childH) / 2);
      } else if (align === "baseline") {
        // Align text baselines (at 80% of bounding box height).
        // Non-text nodes bottom-align to the reference baseline.
        // Flex children (spacers) don't participate.
        const refBaseline = Math.max(0, ...children.map((c, j) => {
          if (c.type !== "text" || measured[j].flex > 0) return 0;
          return Math.floor(measured[j].h * 0.8);
        }));

        // Compute uncentered Y for each child relative to 0
        const childYOffsets: number[] = [];
        for (let j = 0; j < children.length; j++) {
          const c = children[j];
          const mj = measured[j];
          if (mj.flex > 0) {
            childYOffsets.push(0);
          } else if (c.type === "text") {
            childYOffsets.push(refBaseline - Math.floor(mj.h * 0.8));
          } else {
            childYOffsets.push(refBaseline - mj.h);
          }
        }

        // Center the group vertically in the row
        let minOff = 0, maxOff = 0;
        for (let j = 0; j < children.length; j++) {
          if (measured[j].flex > 0) continue;
          minOff = Math.min(minOff, childYOffsets[j]);
          maxOff = Math.max(maxOff, childYOffsets[j] + measured[j].h);
        }
        const contentHeight = maxOff - minOff;
        const centerOffset = Math.floor((rowH - contentHeight) / 2) - minOff;

        childY = contentY + childYOffsets[i] + centerOffset;
      }

      const r = resolveChild(child, cx, childY, childW, childH);
      resolved.push(r);
      cx += childW + gap;
    }

    const totalH = box.height ?? (rowH + pad.top + pad.bottom);
    const w = box.width ?? availW;
    return { node: box, x, y, width: w, height: totalH, children: resolved, w, h: totalH };
  }
}

function resolveChild(child: LayoutNode, x: number, y: number, w: number, h: number): ResolvedNode {
  if (child.type === "box") {
    return resolveBox(child, x, y, w, h);
  }
  return { node: child, x, y, width: w, height: h };
}

/** Resolve a layout tree, computing absolute positions for all nodes. */
export function resolve(root: BoxNode, width: number, height: number): ResolvedNode {
  return resolveBox(root, 0, 0, width, height);
}
