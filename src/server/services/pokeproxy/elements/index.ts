/**
 * Element registry — factory, defaults, and render helpers.
 */

import type { LayoutNode, NodeState } from "./types.js";
import { CARD_H } from "../constants.js";
import { BoxElement } from "./box.js";
import { TextElement } from "./text-element.js";
import { ImageElement } from "./image-element.js";

export type { LayoutNode, NodeState, PropDef, CardElement, ElementState, SubElement, SubElementState } from "./types.js";
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
  return [
    createNode({
      type: "image", id: "big-logo-1",
      props: { src: "logo", suffix: "VSTAR-big", height: 280, opacity: 0.85, clipToCard: 1, anchorX: -50, anchorY: -38 },
    }),
    createNode({
      type: "box",
      id: "hp-cluster-1",
      props: { anchorX: 514, anchorY: 42, direction: "row" },
      children: [
        { type: "text", props: { text: "HP", fontSize: 25, fontFamily: "title", fontWeight: "bold", fill: "#ffffff", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", wrap: 0, marginTop: 0, marginRight: 4, marginBottom: 4, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "bottom" }, bind: {} },
        { type: "text", props: { text: "280", fontSize: 52, fontFamily: "title", fontWeight: "bold", fill: "#ffffff", opacity: 1, stroke: "#000000", strokeWidth: 0, filter: "title-shadow", textAnchor: "start", wrap: 0, marginTop: 0, marginRight: 6, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "bottom" }, bind: { text: "hp" } },
        { type: "image", props: { src: "energy", energyType: "Fire", radius: 25, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "types[0]" } },
      ],
    }),
    createNode({
      type: "box",
      id: "name-cluster-1",
      props: { anchorX: 45, anchorY: 46, direction: "row" },
      children: [
        { type: "text", props: { text: "Arcanine", fontSize: 48, fontFamily: "title", fontWeight: "bold", fill: "#ffffff", opacity: 1, stroke: "#000000", strokeWidth: 2.5, filter: "title-shadow", textAnchor: "start", wrap: 0, marginTop: 0, marginRight: 0, marginBottom: 6, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "bottom" }, bind: { text: "_baseName" } },
        { type: "image", props: { src: "logo", suffix: "ex", height: 55, filter: "title-shadow", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 4, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "bottom" }, bind: { suffix: "_nameSuffix" } },
      ],
    }),
    createNode({
      type: "box",
      id: "evolves-from-1",
      props: { anchorX: 47, anchorY: 98, direction: "row" },
      children: [
        { type: "text", props: { text: "Evolves from", fontSize: 18, fontFamily: "body", fontWeight: "bold", fill: "#ffffff", opacity: 0.7, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", wrap: 0, grow: 0, hAlign: "start", marginTop: 0, marginRight: 6, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" } },
        { type: "text", props: { text: "Growlithe", fontSize: 18, fontFamily: "title", fontWeight: "bold", fill: "#ffffff", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", wrap: 0, grow: 0, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "evolveFrom" } },
      ],
    }),
    createNode({
      type: "box",
      id: "attack-block-1",
      props: {
        anchorX: 20, anchorY: 0, width: 710, direction: "column", vAnchor: "bottom",
        paddingTop: 4, paddingRight: 8, paddingBottom: 37, paddingLeft: 8,
        fill: "#e6a7a7", fillOpacity: 0.1, rx: 5,
      },
      children: [
        { type: "box", props: { direction: "row" }, children: [
          { type: "image", props: { src: "energy", energyType: "Fire", radius: 14, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "attacks[0].cost[0]" } },
          { type: "image", props: { src: "energy", energyType: "Fire", radius: 14, grow: 0, hAlign: "start", marginTop: 0, marginRight: 6, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "attacks[0].cost[1]" } },
          { type: "text", props: { text: "Raging Claws", fontSize: 28, fontFamily: "title", fontWeight: "bold", fill: "#ffffff", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", wrap: 0, grow: 1, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "attacks[0].name" } },
          { type: "text", props: { text: "30+", fontSize: 36, fontFamily: "title", fontWeight: "bold", fill: "#cc0000", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", wrap: 0, grow: 0, hAlign: "end", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "attacks[0].damage" } },
        ]},
        { type: "text", props: {
          text: "This attack does 10 more damage for each damage counter on this Pokémon.",
          fontSize: 27, fontFamily: "body", fontWeight: "bold", fill: "#ffffff", opacity: 1, filter: "title-shadow", wrap: 1, marginTop: 4,
        }, bind: { text: "attacks[0].effect" } },
        { type: "box", props: { direction: "row", marginTop: 6 }, children: [
          { type: "image", props: { src: "energy", energyType: "Fire", radius: 14, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "attacks[1].cost[0]" } },
          { type: "image", props: { src: "energy", energyType: "Fire", radius: 14, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "attacks[1].cost[1]" } },
          { type: "image", props: { src: "energy", energyType: "Fire", radius: 14, grow: 0, hAlign: "start", marginTop: 0, marginRight: 6, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "attacks[1].cost[2]" } },
          { type: "text", props: { text: "Bright Flame", fontSize: 28, fontFamily: "title", fontWeight: "bold", fill: "#222222", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", wrap: 0, grow: 1, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "attacks[1].name" } },
          { type: "text", props: { text: "250", fontSize: 36, fontFamily: "title", fontWeight: "bold", fill: "#cc0000", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", wrap: 0, grow: 0, hAlign: "end", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "attacks[1].damage" } },
        ]},
        { type: "text", props: {
          text: "Discard 2 {R} Energy from this Pokémon.",
          fontSize: 20, fontFamily: "body", fontWeight: "bold", fill: "#222222", opacity: 1, filter: "shadow", wrap: 1, marginTop: 4,
        }, bind: { text: "attacks[1].effect" } },
        { type: "box", props: { direction: "row", marginTop: 4 }, children: [
          { type: "text", props: { text: "Weak", fontSize: 14, fontFamily: "body", fontWeight: "bold", fill: "#888888", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", wrap: 0, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" } },
          { type: "image", props: { src: "energy", energyType: "Lightning", radius: 12, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "weaknesses[0].type" } },
          { type: "text", props: { text: "×2", fontSize: 22, fontFamily: "body", fontWeight: "bold", fill: "#222222", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", wrap: 0, grow: 0, hAlign: "start", marginTop: 0, marginRight: 16, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "weaknesses[0].value" } },
          { type: "text", props: { text: "Resist", fontSize: 14, fontFamily: "body", fontWeight: "bold", fill: "#888888", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", wrap: 0, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" } },
          { type: "image", props: { src: "energy", energyType: "Fighting", radius: 12, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "resistances[0].type" } },
          { type: "text", props: { text: "-30", fontSize: 22, fontFamily: "body", fontWeight: "bold", fill: "#222222", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", wrap: 0, grow: 1, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "resistances[0].value" } },
          { type: "text", props: { text: "Retreat", fontSize: 14, fontFamily: "body", fontWeight: "bold", fill: "#888888", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", wrap: 0, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" } },
          { type: "image", props: { src: "energy", energyType: "Colorless", radius: 12, grow: 0, hAlign: "start", marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" } },
          { type: "image", props: { src: "energy", energyType: "Colorless", radius: 12, grow: 0, hAlign: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" } },
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
