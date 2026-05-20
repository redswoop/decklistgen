import type { TcgdexCard } from "../types/card.js";
import type { CardTemplate, LoadedSet } from "../types/template.js";
import { suggestTemplate } from "./suggest-template.js";

/** The terminal fallback set id. */
export const DEFAULT_SET_ID = "default";

export interface ResolveContext {
  /** Highest-priority: per-card override (e.g. on a DeckCard entry). */
  cardSetId?: string;
  /** Per-deck default. */
  deckSetId?: string;
  /** Global default (from data/active-template-set.json or similar). */
  globalSetId: string;
  /** Override the slot suggester. Render-time logic (fullart promotion etc.)
   *  computes the final slot and passes it here. */
  slotOverride?: string;
}

export interface ResolvedTemplate {
  template: CardTemplate;
  /** Which set actually provided the template (after walking the extends chain). */
  resolvedFromSetId: string;
  /** Whether the resolution matched a card-specific template or a slot template. */
  matchKind: "card" | "slot";
  /** The slot the card maps to (always populated, even on card-specific match). */
  slot: string;
}

/** Resolve a card to a template via the per-card → per-deck → global → extends-walk chain.
 *  `sets` is the in-memory map produced by template-set-store. */
export function resolveTemplate(
  card: TcgdexCard,
  ctx: ResolveContext,
  sets: Map<string, LoadedSet>,
): ResolvedTemplate {
  const startSetId = ctx.cardSetId ?? ctx.deckSetId ?? ctx.globalSetId;
  return resolveInSet(card, startSetId, sets, new Set(), ctx.slotOverride);
}

function resolveInSet(
  card: TcgdexCard,
  setId: string,
  sets: Map<string, LoadedSet>,
  seen: Set<string>,
  slotOverride?: string,
): ResolvedTemplate {
  if (seen.has(setId)) {
    throw new Error(`Template set extends cycle: ${[...seen, setId].join(" -> ")}`);
  }
  seen.add(setId);

  const set = sets.get(setId);
  if (!set) {
    if (setId !== DEFAULT_SET_ID && !seen.has(DEFAULT_SET_ID)) {
      return resolveInSet(card, DEFAULT_SET_ID, sets, seen, slotOverride);
    }
    throw new Error(`Unknown template set: ${setId}`);
  }

  const slot = slotOverride ?? suggestTemplate(card);

  const cardMatch = set.cardTemplates[card.id];
  if (cardMatch) {
    return { template: cardMatch, resolvedFromSetId: setId, matchKind: "card", slot };
  }

  const slotMatch = set.slotTemplates[slot];
  if (slotMatch) {
    return { template: slotMatch, resolvedFromSetId: setId, matchKind: "slot", slot };
  }

  if (set.manifest.extends) {
    return resolveInSet(card, set.manifest.extends, sets, seen, slotOverride);
  }

  if (setId !== DEFAULT_SET_ID && !seen.has(DEFAULT_SET_ID)) {
    return resolveInSet(card, DEFAULT_SET_ID, sets, seen, slotOverride);
  }

  throw new Error(`No template for card ${card.id} (slot ${slot}) in set ${setId} or fallback chain`);
}
