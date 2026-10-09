import type { EffectTag } from "../utils/effect-tags.js";

/**
 * Manual corrections to the inferred function tags, keyed by card name (without
 * any "(Professor Magnolia)" parenthetical). Prefer fixing a rule in
 * `utils/effect-tags.ts`; an entry here is for wording a rule can't reasonably
 * catch. Every entry should say why.
 */
export const EFFECT_TAG_OVERRIDES: Record<string, { add?: EffectTag[]; remove?: EffectTag[] }> = {
  // Searches for "Rare Fossil cards" — an Item, not "any card".
  "Cara Liss": { add: ["search:item"], remove: ["search:any"] },
  // "Choose a Trainer card from your discard pile … put that card into your hand"
  // is split across sentences by the opponent's yes/no.
  "Sordward & Shielbert": { add: ["recover"] },
};
