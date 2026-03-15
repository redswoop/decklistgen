import type { TcgdexCard } from "../types/card.js";
import { isFullArt } from "./detect-fullart.js";

/** Template IDs that match template file names in data/templates/ */
export type TemplateName =
  | "basic-energy"
  | "pokemon-vstar"
  | "pokemon-fullart"
  | "trainer"
  | "pokemon-standard";

/** Suggest the best template for a card based on its metadata.
 *  Accepts TcgdexCard (or raw cached JSON which may include `effect`). */
export function suggestTemplate(card: TcgdexCard): TemplateName {
  const category = card.category ?? "Pokemon";
  const stage = card.stage ?? "";

  // Basic energy: category is Energy and no effect text (special energies have effect)
  if (category === "Energy" && !card.effect) return "basic-energy";
  if (category === "Trainer") return "trainer";
  if (stage === "VSTAR") return "pokemon-vstar";
  if (isFullArt(card)) return "pokemon-fullart";
  return "pokemon-standard";
}
