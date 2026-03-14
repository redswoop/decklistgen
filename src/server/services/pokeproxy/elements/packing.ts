/**
 * Packed-row layout engine — arranges items horizontally with padding,
 * vertical alignment, and flexbox-like grow distribution.
 */

import type { LayoutNode } from "./types.js";

export interface PackItem {
  contentWidth: number;
  contentHeight: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  vAlign: "top" | "middle" | "bottom";
  grow: number;
  hAlign: "start" | "center" | "end";
}

export interface PackResult {
  /** Content origin (top-left of content area) per item, in original array order */
  positions: Array<{ x: number; y: number }>;
  totalWidth: number;
  totalHeight: number;
}

/**
 * Pack items into a horizontal row.
 * Returns content origins for each item relative to the row's top-left corner.
 *
 * When containerWidth is specified and exceeds the natural total width,
 * extra space is distributed to items proportional to their `grow` weight.
 * Each item's `hAlign` controls where content sits within its allocated slot.
 */
export function packRow(
  items: PackItem[],
  direction: "ltr" | "rtl",
  containerWidth?: number,
): PackResult {
  if (items.length === 0) {
    return { positions: [], totalWidth: 0, totalHeight: 0 };
  }

  // outerHeight = margin + padding + content
  const outerHeights = items.map(it =>
    it.marginTop + it.paddingTop + it.contentHeight + it.paddingBottom + it.marginBottom,
  );
  const rowHeight = Math.max(...outerHeights);

  // Natural outer widths
  const naturalOuters = items.map(it =>
    it.marginLeft + it.paddingLeft + it.contentWidth + it.paddingRight + it.marginRight,
  );
  const naturalTotal = naturalOuters.reduce((a, b) => a + b, 0);

  // Distribute extra space to grow items
  const extraSpace = (containerWidth != null && containerWidth > naturalTotal)
    ? containerWidth - naturalTotal
    : 0;
  const totalGrow = items.reduce((sum, it) => sum + it.grow, 0);

  const allocatedContentWidths = items.map(it => {
    if (extraSpace > 0 && totalGrow > 0 && it.grow > 0) {
      return it.contentWidth + extraSpace * (it.grow / totalGrow);
    }
    return it.contentWidth;
  });

  // Pack in LTR order (reverse for RTL)
  const order = direction === "rtl" ? [...items].reverse() : items;
  const orderAllocW = direction === "rtl"
    ? [...allocatedContentWidths].reverse()
    : allocatedContentWidths;
  const orderedPositions: Array<{ x: number; y: number }> = [];

  let cursor = 0;
  for (let i = 0; i < order.length; i++) {
    const item = order[i];
    const allocW = orderAllocW[i];
    const outerH = item.marginTop + item.paddingTop + item.contentHeight + item.paddingBottom + item.marginBottom;

    // Horizontal: position content within allocated slot
    const slotLeft = cursor + item.marginLeft + item.paddingLeft;
    let contentX: number;
    if (item.hAlign === "center") {
      contentX = slotLeft + (allocW - item.contentWidth) / 2;
    } else if (item.hAlign === "end") {
      contentX = slotLeft + (allocW - item.contentWidth);
    } else {
      contentX = slotLeft;
    }

    // Vertical alignment
    let contentY: number;
    if (item.vAlign === "top") {
      contentY = item.marginTop + item.paddingTop;
    } else if (item.vAlign === "bottom") {
      contentY = rowHeight - item.marginBottom - item.paddingBottom - item.contentHeight;
    } else {
      // middle
      contentY = (rowHeight - outerH) / 2 + item.marginTop + item.paddingTop;
    }

    orderedPositions.push({ x: contentX, y: contentY });
    cursor += item.marginLeft + item.paddingLeft + allocW + item.paddingRight + item.marginRight;
  }

  // For RTL, reverse positions back to match original array order
  if (direction === "rtl") {
    orderedPositions.reverse();
  }

  return {
    positions: orderedPositions,
    totalWidth: containerWidth != null ? Math.max(containerWidth, cursor) : cursor,
    totalHeight: rowHeight,
  };
}

/** Build PackItem[] from LayoutNode children by calling each child's measure(). */
export function buildPackItems(children: LayoutNode[]): PackItem[] {
  return children.map(child => {
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
}
