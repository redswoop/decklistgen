/**
 * Element registry — factory, defaults, and render helpers.
 */

import type { LayoutNode, NodeState } from "./types.js";
import { join } from "node:path";
import { CARD_H } from "../constants.js";
import { BoxElement } from "./box.js";
import { TextElement } from "./text-element.js";
import { ImageElement } from "./image-element.js";

export type { LayoutNode, NodeState, PropDef } from "./types.js";
export { BoxElement } from "./box.js";
export { TextElement } from "./text-element.js";
export { ImageElement } from "./image-element.js";
export { packRow, buildPackItems } from "./packing.js";

/** Unified factory — recursively instantiates a LayoutNode tree from serialized state. */
export function createNode(state: NodeState): LayoutNode {
  // Recursively instantiate children before passing to container constructors
  const children = state.children?.map(c => createNode(c));

  switch (state.type) {
    // ── New canonical types ──
    case "box":
      return new BoxElement(state.props, children, state.bind, state.id);
    case "text":
      return new TextElement(state.props, state.bind);
    case "image":
      return new ImageElement(state.props, state.bind, state.id);

    // ── Repeater — should be expanded before createNode; treat as empty box if not ──
    case "repeater":
      console.warn(`createNode: repeater "${state.id ?? "?"}" was not expanded before rendering — treating as empty box`);
      return new BoxElement(state.props, children ?? [], state.bind, state.id);

    // ── Backward-compat aliases ──
    case "packed-row":
    case "packed-row-item": {
      const dir = String(state.props.direction ?? "ltr");
      const direction = dir === "rtl" ? "row-reverse" : "row";
      const props = { ...state.props, direction };
      return new BoxElement(props, children, state.bind, state.id);
    }
    case "stack": {
      const props = { ...state.props, direction: "column" };
      return new BoxElement(props, children, state.bind, state.id);
    }
    case "wrapped-text": {
      const props = { ...state.props, wrap: 1 };
      return new TextElement(props, state.bind);
    }
    case "type-dot": {
      const props = { ...state.props, src: "energy" };
      return new ImageElement(props, state.bind);
    }
    case "suffix-logo": {
      const props = { ...state.props, src: "logo" };
      return new ImageElement(props, state.bind);
    }
    case "big-logo": {
      const props = {
        ...state.props,
        src: "logo",
        clipToCard: 1,
        // Map x/y to anchorX/anchorY if present (BigLogoElement used x/y)
        anchorX: state.props.x ?? state.props.anchorX ?? 0,
        anchorY: state.props.y ?? state.props.anchorY ?? 0,
      };
      return new ImageElement(props, state.bind, state.id);
    }
    default:
      throw new Error(`Unknown element type: ${state.type}`);
  }
}

/** Backward-compat wrapper around createNode. */
export function createElement(state: NodeState): LayoutNode {
  return createNode(state);
}

export function createDefaultElements(): LayoutNode[] {
  // Load from the pokemon-fullart template file
  // elements/ → pokeproxy/ → services/ → server/ → src/ → project root
  const templatePath = join(import.meta.dir, "../../../../../data/templates/pokemon-fullart.json");
  try {
    const raw = require("node:fs").readFileSync(templatePath, "utf-8");
    const tmpl = JSON.parse(raw);
    return tmpl.elements.map((s: NodeState) => createNode(s));
  } catch {
    // Minimal fallback
    return [
      createNode({ type: "box", id: "fallback", props: { anchorX: 30, anchorY: 50, direction: "row" }, children: [
        { type: "text", props: { text: "Template not found", fontSize: 24, fontFamily: "title", fontWeight: "bold", fill: "#ff0000" } },
      ]}),
    ];
  }
}

export function renderElements(elements: LayoutNode[]): string {
  return elements.map(node => {
    let x = Number(node.props.anchorX ?? node.props.x ?? 0);
    let y = Number(node.props.anchorY ?? node.props.y ?? 0);

    if (String(node.props.vAnchor) === "bottom") {
      const { height } = node.measure();
      y = CARD_H - y - height;
    }

    const svg = node.render(x, y);
    if (Number(node.props._hidden)) {
      return `<g visibility="hidden">${svg}</g>`;
    }
    return svg;
  }).join("\n");
}
