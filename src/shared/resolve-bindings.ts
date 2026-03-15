import type { NodeState } from "./types/editor.js";

/** Resolve a dotted/bracketed path against a data object. */
export function resolveBinding(path: string, data: Record<string, unknown>): unknown {
  if (!data || !path) return undefined;
  const parts = path.replace(/\[/g, ".").replace(/\]/g, "").split(".");
  let val: unknown = data;
  for (const part of parts) {
    if (val == null) return undefined;
    val = (val as Record<string, unknown>)[part];
  }
  return val;
}

/** Check if a value is "truthy" for showIf purposes. Empty arrays count as falsy. */
export function isTruthy(val: unknown): boolean {
  if (val == null || val === "" || val === 0 || val === false) return false;
  if (Array.isArray(val)) return val.length > 0;
  return true;
}

/** Build a binding context for a repeater item. Item properties shadow parent context. */
function buildItemContext(
  item: unknown,
  index: number,
  parentContext: Record<string, unknown>,
): Record<string, unknown> {
  const ctx: Record<string, unknown> = { ...parentContext };
  if (item != null && typeof item === "object" && !Array.isArray(item)) {
    Object.assign(ctx, item as Record<string, unknown>);
  }
  ctx.$item = item;
  ctx.$index = index;
  return ctx;
}

/**
 * Apply bindings, expand repeaters, and filter showIf.
 * Returns a new tree of concrete elements (no repeaters remain).
 * The input is NOT mutated.
 */
export function applyBindingsToTree(
  elements: NodeState[],
  data: Record<string, unknown>,
): NodeState[] {
  const copy: NodeState[] = JSON.parse(JSON.stringify(elements));
  return processNodes(copy, data);
}

/** Process a list of nodes: filter showIf, expand repeaters, resolve bindings. */
function processNodes(
  nodes: NodeState[],
  context: Record<string, unknown>,
): NodeState[] {
  const result: NodeState[] = [];

  for (let origIdx = 0; origIdx < nodes.length; origIdx++) {
    const node = nodes[origIdx];

    // showIf check
    if (node.showIf) {
      const val = resolveBinding(node.showIf, context);
      if (!isTruthy(val)) continue;
    }

    // Repeater expansion
    if (node.type === "repeater" && node.itemTemplate) {
      const itemsPath = node.bind?.items ?? "";
      const items = resolveBinding(itemsPath, context);
      if (!Array.isArray(items) || items.length === 0) continue;

      const expandedChildren: NodeState[] = [];
      for (let i = 0; i < items.length; i++) {
        const itemCtx = buildItemContext(items[i], i, context);
        const instance: NodeState = JSON.parse(JSON.stringify(node.itemTemplate));
        processNode(instance, itemCtx);
        expandedChildren.push(instance);
      }

      // Replace repeater with a box containing expanded items
      // Preserve original template index so SVG child indices match the template tree
      const wrapperBox: NodeState = {
        type: "box",
        props: { direction: "column", ...node.props, _templateIndex: origIdx },
        children: expandedChildren,
      };
      if (node.id) wrapperBox.id = node.id;
      result.push(wrapperBox);
    } else {
      node.props._templateIndex = origIdx;
      processNode(node, context);
      result.push(node);
    }
  }

  return result;
}

/** Resolve bindings on a single node and recurse into children. */
function processNode(node: NodeState, context: Record<string, unknown>) {
  if (node.bind) {
    for (const propKey of Object.keys(node.bind)) {
      if (propKey === "items") continue; // repeater-specific, not a prop
      const val = resolveBinding(node.bind[propKey], context);
      if (typeof val === "string" || typeof val === "number") {
        node.props[propKey] = val;
      }
    }
  }
  if (node.children) {
    node.children = processNodes(node.children, context);
  }
}
