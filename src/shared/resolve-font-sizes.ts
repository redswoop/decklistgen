/**
 * Resolve $token font size references in an element tree.
 * Walks elements, children, and itemTemplate recursively.
 * String values starting with "$" are looked up in the size map and replaced with numbers.
 * Raw numbers pass through unchanged.
 */
import type { NodeState } from "./types/editor.js";

export function resolveFontSizes(
  elements: NodeState[],
  sizeMap: Record<string, number>,
): void {
  for (const el of elements) {
    resolveNode(el, sizeMap);
  }
}

function resolveNode(node: NodeState, sizeMap: Record<string, number>): void {
  const fs = node.props.fontSize;
  if (typeof fs === "string" && fs.startsWith("$")) {
    const token = fs.slice(1);
    node.props.fontSize = sizeMap[token] ?? sizeMap.default ?? 24;
  }

  if (node.children) {
    for (const child of node.children) {
      resolveNode(child, sizeMap);
    }
  }

  if (node.itemTemplate) {
    resolveNode(node.itemTemplate, sizeMap);
  }
}
