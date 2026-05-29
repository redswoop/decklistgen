import type { Card } from "./card.js";

export interface CleanMeta {
  prompt: string;
  rule: string;
  seed: number;
  timestamp: string;
  cardId: string;
}

export interface DeckMembership {
  deckId: string;
  deckName: string;
  count: number;
}

export interface CustomizedCard {
  card: Card;
  hasClean: boolean;
  hasComposite: boolean;
  cleanMeta: CleanMeta | null;
  hasPromptOverride: boolean;
  isStale: boolean;
  staleSummary: string | null;
  deckMembership: DeckMembership[];
}

export interface CustomizedCardsResponse {
  cards: CustomizedCard[];
  totalClean: number;
  totalStale: number;
}
