import type { Era } from "./card.js";
import type { EffectTag } from "../utils/effect-tags.js";

export interface CardFilters {
  sets?: string[];
  era?: Era | "all";
  category?: "Pokemon" | "Trainer" | "Energy";
  trainerType?: string;
  rarities?: string[];
  energyTypes?: string[];
  specialAttributes?: SpecialAttribute[];
  isFullArt?: boolean;
  hasFoil?: boolean;
  nameSearch?: string;
  /**
   * Function tags the card must have — all of them. A bare prefix matches its
   * family ("search" matches search:pokemon). See utils/effect-tags.ts.
   */
  effectTags?: string[];
}

export type SpecialAttribute = "ex" | "V" | "VMAX" | "VSTAR" | "Ancient" | "Future" | "Tera";

export interface FilterOptions {
  rarities: string[];
  energyTypes: string[];
  sets: Array<{ code: string; name: string }>;
  trainerTypes: string[];
  availableAttributes: SpecialAttribute[];
  /** Function tags present on at least one loaded card, in registry order. */
  effectTags: EffectTag[];
}
