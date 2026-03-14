/**
 * Element widget system — typed props + SVG rendering for interactive editing.
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

export interface SubElementState {
  type: "text" | "type-dot" | "suffix-logo";
  props: Record<string, number | string>;
  bind?: Record<string, string>;
}

export interface ElementState {
  type: string;
  id: string;
  props: Record<string, number | string>;
  children?: SubElementState[];
}

export interface SubElement {
  readonly type: "text" | "type-dot" | "suffix-logo";
  props: Record<string, number | string>;
  bind?: Record<string, string>;
  propDefs(): PropDef[];
  measure(): { width: number; height: number };
  render(x: number, y: number): string;
  toJSON(): SubElementState;
}

export interface CardElement {
  readonly type: string;
  readonly id: string;
  props: Record<string, number | string>;
  propDefs(): PropDef[];
  render(): string;
  toJSON(): ElementState;
}
