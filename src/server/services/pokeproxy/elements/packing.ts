/**
 * Packed-row layout engine — arranges items horizontally with padding and vertical alignment.
 */

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
 */
export function packRow(items: PackItem[], direction: "ltr" | "rtl"): PackResult {
  if (items.length === 0) {
    return { positions: [], totalWidth: 0, totalHeight: 0 };
  }

  // outerHeight = margin + padding + content
  const outerHeights = items.map(it =>
    it.marginTop + it.paddingTop + it.contentHeight + it.paddingBottom + it.marginBottom,
  );
  const rowHeight = Math.max(...outerHeights);

  // Pack in LTR order (reverse for RTL so cursor advances left-to-right on reversed array)
  const order = direction === "rtl" ? [...items].reverse() : items;
  const orderedPositions: Array<{ x: number; y: number }> = [];

  let cursor = 0;
  for (const item of order) {
    const outerH = item.marginTop + item.paddingTop + item.contentHeight + item.paddingBottom + item.marginBottom;
    const contentX = cursor + item.marginLeft + item.paddingLeft;

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
    cursor += item.marginLeft + item.paddingLeft + item.contentWidth + item.paddingRight + item.marginRight;
  }

  // For RTL, reverse positions back to match original array order
  if (direction === "rtl") {
    orderedPositions.reverse();
  }

  return {
    positions: orderedPositions,
    totalWidth: cursor,
    totalHeight: rowHeight,
  };
}
