/** Enriched card model used throughout the app */
export interface Card {
  id: string;              // "sv06.5-036"
  localId: string;         // "036"
  name: string;            // "Okidogi ex"
  imageBase: string;
  category: "Pokemon" | "Trainer" | "Energy";
  trainerType?: "Item" | "Supporter" | "Stadium" | "Tool";
  rarity: string;
  energyTypes: string[];   // ["Darkness"]
  setId: string;
  setCode: string;
  setName: string;
  era: "sv" | "swsh";
  hp?: number;
  stage?: string;
  retreat?: number;
  isFullArt: boolean;
  isEx: boolean;
  isV: boolean;
  isVmax: boolean;
  isVstar: boolean;
  isAncient: boolean;
  isFuture: boolean;
  isTera: boolean;
  hasFoil: boolean;
}

export interface CardAttack {
  name: string;
  cost: string[];
  damage?: string;
  effect?: string;
}

export interface CardAbility {
  name: string;
  type: string;  // "Ability", "Talent"
  effect: string;
}

export interface CardDetail extends Card {
  attacks: CardAttack[];
  abilities: CardAbility[];
  weaknesses: Array<{ type: string; value: string }>;
  resistances: Array<{ type: string; value: string }>;
  description?: string;
  evolveFrom?: string;
}

/** Raw card from TCGdex API */
export interface TcgdexCard {
  id: string;
  localId: string;
  name: string;
  image?: string;
  category?: string;
  trainerType?: string;
  rarity?: string;
  types?: string[];
  hp?: number;
  stage?: string;
  retreat?: number;
  variants?: {
    normal?: boolean;
    reverse?: boolean;
    holo?: boolean;
    firstEdition?: boolean;
  };
  set?: {
    id: string;
    name: string;
    cardCount?: { official?: number; total?: number };
  };
  abilities?: Array<{ name: string; type?: string; effect: string }>;
  attacks?: Array<{ name: string; cost?: string[]; damage?: string | number; effect?: string }>;
  weaknesses?: Array<{ type: string; value: string }>;
  resistances?: Array<{ type: string; value: string }>;
  description?: string;
  evolveFrom?: string;
}

/** Set info from TCGdex API */
export interface TcgdexSet {
  id: string;
  name: string;
  logo?: string;
  cardCount?: { official?: number; total?: number };
  cards?: Array<{ id: string; localId: string; name: string; image?: string }>;
}

/** Set info returned by our API */
export interface SetInfo {
  code: string;     // PTCGL code ("SFA")
  tcgdexId: string; // TCGdex ID ("sv06.5")
  name: string;     // "Shrouded Fable"
  era: "sv" | "swsh";
  cardCount?: number;
  loaded: boolean;
}
