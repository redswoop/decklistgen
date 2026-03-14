/**
 * Element registry — factory, defaults, and render helpers.
 */

import type { CardElement, ElementState } from "./types.js";
import { BigLogoElement } from "./big-logo.js";
import { PackedRowElement } from "./packed-row.js";
import { TextItem, TypeDotItem, SuffixLogoItem } from "./sub-elements.js";

export type { CardElement, ElementState, PropDef, SubElement, SubElementState } from "./types.js";
export { BigLogoElement } from "./big-logo.js";
export { PackedRowElement } from "./packed-row.js";
export { TextItem, TypeDotItem, SuffixLogoItem, createSubElement } from "./sub-elements.js";
export { packRow } from "./packing.js";

const ELEMENT_TYPES: Record<string, new (id: string, props?: Record<string, number | string>) => CardElement> = {
  "big-logo": BigLogoElement,
};

export function createElement(state: ElementState): CardElement {
  if (state.type === "packed-row") {
    return new PackedRowElement(state.id, state.props, state.children);
  }
  const Ctor = ELEMENT_TYPES[state.type];
  if (!Ctor) throw new Error(`Unknown element type: ${state.type}`);
  return new Ctor(state.id, state.props);
}

export function createDefaultElements(): CardElement[] {
  return [
    new BigLogoElement("big-logo-1"),
    new PackedRowElement("hp-cluster-1", { anchorX: 538, anchorY: 25, direction: "ltr" }, [
      { type: "text", props: { text: "HP", fontSize: 18, fontFamily: "title", fontWeight: "bold", fill: "#000000", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", marginTop: 0, marginRight: 4, marginBottom: 4, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "bottom" }, bind: {} },
      { type: "text", props: { text: "130", fontSize: 50, fontFamily: "title", fontWeight: "bold", fill: "#000000", opacity: 1, stroke: "", strokeWidth: 0, filter: "none", textAnchor: "start", marginTop: 0, marginRight: 6, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "bottom" }, bind: { text: "hp" } },
      { type: "type-dot", props: { energyType: "Fire", radius: 28, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "types[0]" } },
    ]),
    new PackedRowElement("name-cluster-1", { anchorX: 30, anchorY: 62, direction: "ltr" }, [
      { type: "text", props: { text: "Leafeon", fontSize: 48, fontFamily: "title", fontWeight: "bold", fill: "#ffffff", opacity: 1, stroke: "#000000", strokeWidth: 2.5, filter: "title-shadow", textAnchor: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "bottom" }, bind: { text: "_baseName" } },
      { type: "suffix-logo", props: { suffix: "VSTAR", height: 55, filter: "title-shadow", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 4, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "bottom" }, bind: { suffix: "_nameSuffix" } },
    ]),
    new PackedRowElement("attack-1", { anchorX: 20, anchorY: 530, direction: "ltr", fill: "#333333", fillOpacity: 0.1, rx: 5 }, [
      { type: "type-dot", props: { energyType: "Grass", radius: 14, marginTop: 0, marginRight: 4, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "attacks[0].cost[0]" } },
      { type: "type-dot", props: { energyType: "Colorless", radius: 14, marginTop: 0, marginRight: 6, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { energyType: "attacks[0].cost[1]" } },
      { type: "text", props: { text: "Leaf Blade", fontSize: 28, fontFamily: "title", fontWeight: "bold", fill: "#222222", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "start", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "attacks[0].name" } },
      { type: "text", props: { text: "60", fontSize: 36, fontFamily: "title", fontWeight: "bold", fill: "#cc0000", opacity: 1, stroke: "", strokeWidth: 0, filter: "shadow", textAnchor: "end", marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, vAlign: "middle" }, bind: { text: "attacks[0].damage" } },
    ]),
  ];
}

export function renderElements(elements: CardElement[]): string {
  return elements.map(el => el.render()).join("\n");
}
