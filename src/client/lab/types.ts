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

/*
 * Trainer card shape — separate from LabCard because the field set barely
 * overlaps (no HP, no retreat, no weakness/resistance, no suffix logo, no
 * evolves-from). The effect block is the bulk of the card and supports
 * any combination of: plain effect text, ability subsection, VSTAR Power
 * subsection (e.g. Forest Seal Stone Tool trainers), or attached-attack
 * subsection (some ACE SPEC Pokémon Tools).
 */

export type TrainerType = "Supporter" | "Item" | "Tool" | "Stadium";

/*
 * VSTAR Power on a trainer (or a Pokémon VSTAR) — presents as either a
 * labeled ability subsection or a labeled attack subsection inside the
 * effect block. Seal Stone tools use kind="ability"; Pokémon VSTAR cards
 * like Charizard VSTAR's "Star Blaze" use kind="attack" with a cost.
 */
export interface LabVStarPower {
  kind: "ability" | "attack";
  name: string;
  effect: string;
  cost?: EnergyType[];
  damage?: string;
}

export interface LabTrainerCard {
  name: string;
  trainerType: TrainerType;
  artUrl: string;
  illustrator?: string;
  effect?: string;
  ability?: LabAbility;
  vstarPower?: LabVStarPower;
  attacks?: LabAttack[];
  ruleText?: string;
}
