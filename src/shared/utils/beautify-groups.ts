import type { DeckCard } from "../types/deck.js";

export interface PrintingKey {
  setCode: string;
  localId: string;
}

/** One Beautify unit: every deck stack that is the *same card* (name + mechanicsHash). */
export interface BeautifyGroup {
  name: string;
  mechanicsHash: string;
  /** Sum of the member stacks' counts; the replacement gets exactly this many copies. */
  totalCount: number;
  /** Any member's id — a variants lookup from it yields this group's printings. */
  cardId: string;
  /** The exact stacks to remove when the replacement lands. */
  entries: PrintingKey[];
}

/**
 * Group deck stacks for Beautify by name AND mechanicsHash, never by name alone.
 * Same-name cards with different text (Raikou 30CC 012 vs MEG 048) are different
 * cards: each gets its own group, so beautifying one can't silently turn into
 * the other.
 */
export function groupDeckCardsForBeautify(deckCards: DeckCard[]): BeautifyGroup[] {
  const groups = new Map<string, BeautifyGroup>();
  for (const dc of deckCards) {
    if (dc.count <= 0) continue;
    const { name, mechanicsHash, id, setCode, localId } = dc.card;
    const key = `${name}\0${mechanicsHash}`;
    const group = groups.get(key);
    if (group) {
      group.totalCount += dc.count;
      group.entries.push({ setCode, localId });
    } else {
      groups.set(key, {
        name, mechanicsHash, totalCount: dc.count, cardId: id,
        entries: [{ setCode, localId }],
      });
    }
  }
  return [...groups.values()];
}
