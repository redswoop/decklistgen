import type { Card } from "./card.js";

export interface DecklistEntry {
  setCode: string;
  localId: string;
  count: number;
  name: string;
}

export interface DecklistOutput {
  text: string;
  entries: DecklistEntry[];
}

export interface LimitlessPlayer {
  name: string;
  placing: number;
  record: { wins: number; losses: number; ties: number };
  deckName?: string;
}

export interface ImportResult {
  cards: Array<{ card: Card; count: number }>;
  unresolved: Array<{ name: string; set: string; number: string; count: number; category: string }>;
}
