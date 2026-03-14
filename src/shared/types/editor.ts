import type { NodeState, PropDef } from "../../server/services/pokeproxy/elements/types.js";

export type { PropDef, NodeState };

export interface EditorElement extends NodeState {
  _hidden?: boolean;
  _collapsed?: boolean;
  children?: EditorElement[];
}
