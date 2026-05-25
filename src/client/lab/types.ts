/**
 * Lab-local card shape. Decoupled from the full shared/types/card.ts on purpose:
 * the sandbox shouldn't depend on the production enrichment pipeline yet.
 */

export type EnergyType =
  | "Grass"
  | "Fire"
  | "Water"
  | "Lightning"
  | "Psychic"
  | "Fighting"
  | "Darkness"
  | "Metal"
  | "Fairy"
  | "Dragon"
  | "Colorless";

export type NameSuffix = "ex" | "V" | "VSTAR" | "VMAX";

export interface LabAttack {
  name: string;
  cost: EnergyType[];
  damage?: string;
  effect?: string;
}

export interface LabAbility {
  name: string;
  effect: string;
}

export interface LabCard {
  name: string;
  suffix?: NameSuffix;
  evolvesFrom?: string;
  type: EnergyType;
  hp: number;
  artUrl: string;
  ability?: LabAbility;
  attacks: LabAttack[];
  weakness?: { type: EnergyType; value: string };
  resistance?: { type: EnergyType; value: string };
  retreat: number;
  illustrator?: string;
}
