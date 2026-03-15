/** Canonical element types used by the renderer. */
export type ElementType = "box" | "text" | "image" | "repeater";

/** Legacy type names accepted by the factory for backward compatibility. */
export type LegacyElementType =
  | "packed-row"
  | "packed-row-item"
  | "stack"
  | "wrapped-text"
  | "type-dot"
  | "suffix-logo"
  | "big-logo";

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
  type: ElementType | LegacyElementType;
  id?: string;
  props: Record<string, number | string>;
  bind?: Record<string, string>;
  children?: NodeState[];
  /** Binding path — element removed during expansion if value is falsy/empty. */
  showIf?: string;
  /** For type="repeater" only — cloned per item in the bound collection. */
  itemTemplate?: NodeState;
}

export interface EditorElement extends NodeState {
  _hidden?: boolean;
  _collapsed?: boolean;
  children?: EditorElement[];
  itemTemplate?: EditorElement;
}
