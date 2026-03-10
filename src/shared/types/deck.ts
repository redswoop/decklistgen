import type { Card } from "./card.js";

/** A card entry stored in a saved deck */
export interface DeckCard {
  count: number;
  card: Card;
}

/** A saved deck persisted on the server */
export interface SavedDeck {
  id: string;
  name: string;
  cards: DeckCard[];
  createdAt: string;
  updatedAt: string;
  importedAt?: string;
  importSource?: string;
  isPublic?: boolean;
  isListed?: boolean;
}

/** Lightweight summary for listing decks */
export interface DeckSummary {
  id: string;
  name: string;
  cardCount: number;
  uniqueCards: number;
  createdAt: string;
  updatedAt: string;
  importSource?: string;
  coverImage?: string;
  isPublic?: boolean;
  isListed?: boolean;
  ownerName?: string;
}
