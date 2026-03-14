/**
 * Element registry — factory, defaults, and render helpers.
 */

import type { LayoutNode, NodeState } from "./types.js";
import { CARD_H } from "../constants.js";
import { BigLogoElement } from "./big-logo.js";
import { PackedRowElement } from "./packed-row.js";
import { StackElement } from "./stack.js";
import { TextItem, TypeDotItem, SuffixLogoItem, WrappedTextItem } from "./sub-elements.js";

export type { LayoutNode, NodeState, PropDef, CardElement, ElementState, SubElement, SubElementState } from "./types.js";
export { BigLogoElement } from "./big-logo.js";
export { PackedRowElement } from "./packed-row.js";
export { StackElement } from "./stack.js";
export { TextItem, TypeDotItem, SuffixLogoItem, WrappedTextItem } from "./sub-elements.js";
export { packRow, buildPackItems } from "./packing.js";

/** Unified factory — recursively instantiates a LayoutNode tree from serialized state. */
export function createNode(state: NodeState): LayoutNode {
  // Recursively instantiate children before passing to container constructors
  const children = state.children?.map(c => createNode(c));

  switch (state.type) {
    case "packed-row":
    case "packed-row-item":  // backward compat alias
      return new PackedRowElement(state.props, children, state.bind, state.id);
    case "stack":
      return new StackElement(state.props, children, state.bind, state.id);
    case "big-logo":
      return new BigLogoElement(state.props, state.id);
    case "text":
      return new TextItem(state.props, state.bind);
    case "type-dot":
      return new TypeDotItem(state.props, state.bind);
    case "suffix-logo":
      return new SuffixLogoItem(state.props, state.bind);
    case "wrapped-text":
      return new WrappedTextItem(state.props, state.bind);
    default:
      throw new Error(`Unknown element type: ${state.type}`);
  }
}

/** Backward-compat wrapper around createNode. */
export function createElement(state: NodeState): LayoutNode {
  return createNode(state);
}

export function createDefaultElements(): LayoutNode[] {
  return [
    createNode({ type: "big-logo", id: "big-logo-1", props: { x: -50, y: -38, height: 280, opacity: 0.85, suffix: "VSTAR-big" } }),
    createNode({
      type: "packed-row",
      id: "hp-cluster-1",
      props: { anchorX: 514, anchorY: 42, direction: "ltr" },
      children: [
        { type: "text", props: { text: "HP", fontSize: 25, fontFamily: "title", fontWeight: "bold", fill: "#ffffff", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", marginTop: 0, marginRight: 4, marginBottom: 4, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "bottom" }, bind: {} },
        { type: "text", props: { text: "280", fontSize: 52, fontFamily: "title", fontWeight: "bold", fill: "#ffffff", opacity: 1, stroke: "#000000", strokeWidth: 0, filter: "title-shadow", textAnchor: "start", marginTop: 0, marginRight: 6, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "bottom" }, bind: { text: "hp" } },
        { type: "type-dot", props: { energyType: "Fire", radius: 25, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "types[0]" } },
      ],
    }),
    createNode({
      type: "packed-row",
      id: "name-cluster-1",
      props: { anchorX: 45, anchorY: 46, direction: "ltr" },
      children: [
        { type: "text", props: { text: "Arcanine", fontSize: 48, fontFamily: "title", fontWeight: "bold", fill: "#ffffff", opacity: 1, stroke: "#000000", strokeWidth: 2.5, filter: "title-shadow", textAnchor: "start", marginTop: 0, marginRight: 0, marginBottom: 6, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "bottom" }, bind: { text: "_baseName" } },
        { type: "suffix-logo", props: { suffix: "ex", height: 55, filter: "title-shadow", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 4, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "bottom" }, bind: { suffix: "_nameSuffix" } },
      ],
    }),
    createNode({
      type: "stack",
      id: "attack-block-1",
      props: {
        anchorX: 20, anchorY: 0, width: 710, vAnchor: "bottom",
        paddingTop: 4, paddingRight: 8, paddingBottom: 37, paddingLeft: 8,
        fill: "#e6a7a7", fillOpacity: 0.1, rx: 5,
      },
      children: [
        { type: "packed-row", props: { direction: "ltr" }, children: [
          { type: "type-dot", props: { energyType: "Fire", radius: 14, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "attacks[0].cost[0]" } },
          { type: "type-dot", props: { energyType: "Fire", radius: 14, grow: 0, hAlign: "start", marginTop: 0, marginRight: 6, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "attacks[0].cost[1]" } },
          { type: "text", props: { text: "Raging Claws", fontSize: 28, fontFamily: "title", fontWeight: "bold", fill: "#ffffff", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", grow: 1, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "attacks[0].name" } },
          { type: "text", props: { text: "30+", fontSize: 36, fontFamily: "title", fontWeight: "bold", fill: "#cc0000", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", grow: 0, hAlign: "end", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "attacks[0].damage" } },
        ]},
        { type: "wrapped-text", props: {
          text: "This attack does 10 more damage for each damage counter on this Pokémon.",
          fontSize: 27, fontFamily: "body", fontWeight: "bold", fill: "#ffffff", opacity: 1, filter: "title-shadow", marginTop: 4,
        }, bind: { text: "attacks[0].effect" } },
        { type: "packed-row", props: { direction: "ltr", marginTop: 6 }, children: [
          { type: "type-dot", props: { energyType: "Fire", radius: 14, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "attacks[1].cost[0]" } },
          { type: "type-dot", props: { energyType: "Fire", radius: 14, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "attacks[1].cost[1]" } },
          { type: "type-dot", props: { energyType: "Fire", radius: 14, grow: 0, hAlign: "start", marginTop: 0, marginRight: 6, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "attacks[1].cost[2]" } },
          { type: "text", props: { text: "Bright Flame", fontSize: 28, fontFamily: "title", fontWeight: "bold", fill: "#222222", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", grow: 1, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "attacks[1].name" } },
          { type: "text", props: { text: "250", fontSize: 36, fontFamily: "title", fontWeight: "bold", fill: "#cc0000", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", grow: 0, hAlign: "end", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "attacks[1].damage" } },
        ]},
        { type: "wrapped-text", props: {
          text: "Discard 2 {R} Energy from this Pokémon.",
          fontSize: 20, fontFamily: "body", fontWeight: "bold", fill: "#222222", opacity: 1, filter: "shadow", marginTop: 4,
        }, bind: { text: "attacks[1].effect" } },
        { type: "packed-row", props: { direction: "ltr", marginTop: 4 }, children: [
          { type: "type-dot", props: { energyType: "Lightning", radius: 12, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "weaknesses[0].type" } },
          { type: "text", props: { text: "×2", fontSize: 22, fontFamily: "body", fontWeight: "bold", fill: "#222222", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", grow: 0, hAlign: "start", marginTop: 0, marginRight: 16, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "weaknesses[0].value" } },
          { type: "type-dot", props: { energyType: "Fighting", radius: 12, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "resistances[0].type" } },
          { type: "text", props: { text: "-30", fontSize: 22, fontFamily: "body", fontWeight: "bold", fill: "#222222", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", grow: 0, hAlign: "start", marginTop: 0, marginRight: 16, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "resistances[0].value" } },
          { type: "type-dot", props: { energyType: "Colorless", radius: 12, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" } },
          { type: "type-dot", props: { energyType: "Colorless", radius: 12, grow: 0, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" } },
        ]},
      ],
    }),
  ];
}

export function renderElements(elements: LayoutNode[]): string {
  return elements.map(node => {
    let x = Number(node.props.anchorX ?? node.props.x ?? 0);
    let y = Number(node.props.anchorY ?? node.props.y ?? 0);

    if (String(node.props.vAnchor) === "bottom") {
      const { height } = node.measure();
      y = CARD_H - y - height;
    }

    return node.render(x, y);
  }).join("\n");
}
