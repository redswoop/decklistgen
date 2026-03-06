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
