/** Enriched card model used throughout the app */
export interface Card {
  id: string;              // "sv06.5-036"
  localId: string;         // "036"
  name: string;            // "Okidogi ex"
  imageUrl: string;
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
  abilities?: Array<{ name: string; effect: string }>;
  attacks?: Array<{ name: string; effect?: string }>;
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
