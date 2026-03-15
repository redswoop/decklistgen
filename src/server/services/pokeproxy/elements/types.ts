/**
 * Element widget system — typed props + SVG rendering for interactive editing.
 *
 * Recursive tree: one NodeState for serialization, one LayoutNode for runtime.
 * Containers (packed-row, stack) hold children; leaves (text, type-dot, etc.) don't.
 */

export type { PropDef, NodeState, ElementType, LegacyElementType } from "@shared/types/editor.js";
import type { PropDef, NodeState } from "@shared/types/editor.js";

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
