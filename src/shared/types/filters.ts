export interface CardFilters {
  sets?: string[];
  era?: "sv" | "swsh";
  category?: "Pokemon" | "Trainer" | "Energy";
  trainerType?: string;
  rarities?: string[];
  energyTypes?: string[];
  specialAttributes?: SpecialAttribute[];
  isFullArt?: boolean;
  hasFoil?: boolean;
  nameSearch?: string;
}

export type SpecialAttribute = "ex" | "V" | "VMAX" | "VSTAR" | "Ancient" | "Future" | "Tera";

export interface FilterOptions {
  rarities: string[];
  energyTypes: string[];
  sets: Array<{ code: string; name: string }>;
  trainerTypes: string[];
}
