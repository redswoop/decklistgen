import type { NodeState } from "./editor.js";
import type { TemplateName } from "../utils/suggest-template.js";

export interface CardTemplate {
  id: string;
  name: string;
  description?: string;
  elements: NodeState[];
}

/** Slot identifier — the kind of card a template renders. Aliased to TemplateName
 *  while the five-slot union is the source of truth; phase 4 will widen this to string
 *  when sets can declare custom slot types. */
export type SlotId = TemplateName;

/** Persisted manifest stored at <set-dir>/set.json. */
export interface TemplateSetManifest {
  id: string;
  name: string;
  description?: string;
  /** Inherit slot/card templates from this set when not present locally. */
  extends?: string;
}

/** A template set as loaded from disk and ready for resolution.
 *  Built by the template-set-store after merging builtin files with their shadow overlays. */
export interface LoadedSet {
  manifest: TemplateSetManifest;
  /** Where this set lives: "builtin" sets ship in the image, "user" sets live in the data volume. */
  origin: "builtin" | "user";
  /** True when one or more files in this builtin set have been shadowed in production. */
  hasShadow?: boolean;
  /** slotId -> template */
  slotTemplates: Record<string, CardTemplate>;
  /** TCGdex card id -> template */
  cardTemplates: Record<string, CardTemplate>;
}

/** Lightweight set descriptor returned by listing endpoints (no template bodies). */
export interface TemplateSetSummary {
  id: string;
  name: string;
  description?: string;
  extends?: string;
  origin: "builtin" | "user";
  hasShadow?: boolean;
  slotIds: string[];
  cardIds: string[];
}

/** Server policy controlling whether/how shipped sets can be edited. */
export type BuiltinEditMode = "direct" | "shadow" | "locked";
