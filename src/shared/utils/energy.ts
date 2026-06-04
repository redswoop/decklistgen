import type { Card, CardDetail } from "../types/card.js";

/**
 * Energy cards split into two kinds:
 *   - special energy → carries rule `effect` text (Jet, Luminous, …). Renders
 *     via the trainer template and gets its own print filter bucket.
 *   - basic energy   → no effect (Grass, Basic Lightning, …).
 *
 * The two predicates take different inputs by design:
 *   - special-energy detection needs the `effect` text, which lives on the
 *     lazily-fetched {@link CardDetail}.
 *   - basic-energy detection reads the card's own `mechanicsHash` (the server
 *     stamps `"basic"`), so it works without a CardDetail fetch.
 *
 * For a `category: "Energy"` card the two are complements: a basic energy has
 * no effect and `mechanicsHash === "basic"`; a special energy has effect text
 * and a non-"basic" hash. Keep both definitions here so they can't drift apart.
 */
export function isSpecialEnergy(card: Card, detail?: CardDetail): boolean {
  return card.category === "Energy" && !!detail?.effect;
}

export function isBasicEnergy(card: Card): boolean {
  return card.category === "Energy" && card.mechanicsHash === "basic";
}
