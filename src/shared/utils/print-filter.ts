import type { Card, CardDetail } from "../types/card.js";

/**
 * Energy cards split into two kinds, distinguished by rule text:
 *   - basic energy  → no `effect` (Grass Energy, Basic Lightning Energy …)
 *   - special energy → has `effect` (Jet Energy, Luminous Energy …)
 * Both carry `category: "Energy"` and no `trainerType`, so they are NEITHER
 * Pokémon nor Trainers — special energy gets its own print filter rather than
 * leaking into the Pokémon/Trainer exclusions.
 */
export function isSpecialEnergy(card: Card, detail?: CardDetail): boolean {
  return card.category === "Energy" && !!detail?.effect;
}

export function isBasicEnergy(card: Card, detail?: CardDetail): boolean {
  return card.category === "Energy" && !detail?.effect;
}

export interface PrintFilterOptions {
  /** Exclusion keys from the `exclude` URL param: pokemon, supporters, items,
   *  tools, stadiums, specialenergy. */
  exclude: Set<string>;
  /** Drop basic (effect-less) energy. Carried separately as `noBasicEnergy=1`. */
  noBasicEnergy: boolean;
}

/**
 * Decide whether a card belongs on the printed sheet given the active filters.
 * Each card falls into exactly one bucket — Pokémon, a Trainer subtype, special
 * energy, or basic energy — so no card is filtered by two different toggles.
 */
export function shouldPrintCard(
  card: Card,
  detail: CardDetail | undefined,
  opts: PrintFilterOptions,
): boolean {
  const { exclude, noBasicEnergy } = opts;

  if (card.category === "Pokemon") {
    return !exclude.has("pokemon");
  }

  if (card.category === "Trainer") {
    if (card.trainerType) {
      const key = card.trainerType.toLowerCase() + "s"; // Item → items, Tool → tools …
      if (exclude.has(key)) return false;
    }
    return true;
  }

  if (card.category === "Energy") {
    if (isSpecialEnergy(card, detail)) return !exclude.has("specialenergy");
    return !noBasicEnergy; // basic energy
  }

  return true;
}
