/**
 * Element widget system — typed props + SVG rendering for interactive editing.
 *
 * Recursive tree: one NodeState for serialization, one LayoutNode for runtime.
 * Containers (packed-row, stack) hold children; leaves (text, type-dot, etc.) don't.
 */

export interface PropDef {
  key: string;
  label: string;
  type: "number" | "range" | "select" | "text" | "color";
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  isPosition?: boolean;
}

export interface NodeState {
  type: string;
  id?: string;
  props: Record<string, number | string>;
  bind?: Record<string, string>;
  children?: NodeState[];
}

export interface LayoutNode {
  readonly type: string;
  id?: string;
  props: Record<string, number | string>;
  bind?: Record<string, string>;
  children?: LayoutNode[];
  propDefs(): PropDef[];
  measure(allocatedWidth?: number): { width: number; height: number };
  render(x: number, y: number, allocatedWidth?: number): string;
  toJSON(): NodeState;
}

// Backward-compat aliases
export type ElementState = NodeState;
export type SubElementState = NodeState;
export type CardElement = LayoutNode;
export type SubElement = LayoutNode;
