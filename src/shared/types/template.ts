import type { NodeState } from "./editor.js";

export interface CardTemplate {
  id: string;
  name: string;
  description?: string;
  elements: NodeState[];
}
