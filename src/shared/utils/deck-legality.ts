import type { Card } from "../types/card.js";
import { isBasicEnergy } from "./energy.js";

/**
 * Deck-legality rules engine.
 *
 * Checks a deck against the TCG construction rules that apply to the eras
 * this app covers (SV / SWSH / ME):
 *   - exactly 60 cards
 *   - max 4 copies per card NAME (reprints across sets share the limit;
 *     basic energy is exempt)
 *   - max 1 Radiant Pokemon total per deck (combined across all Radiants)
 *   - max 1 ACE SPEC card total per deck (combined across all ACE SPECs)
 *
 * Pure: takes (card, count) entries, returns issues. Severity "error" means
 * the deck breaks a hard rule; "warning" means it's merely unfinished
 * (wrong size), which is normal mid-build.
 */

export interface DeckEntry {
  card: Card;
  count: number;
}

export type LegalityRule = "deck-size" | "copy-limit" | "radiant" | "ace-spec";

export interface LegalityIssue {
  rule: LegalityRule;
  severity: "error" | "warning";
  message: string;
  /** ids of the offending cards; empty for deck-wide issues like size */
  cardIds: string[];
}

export const LEGAL_DECK_SIZE = 60;
const MAX_COPIES_PER_NAME = 4;

// Old working decks restored from localStorage can predate the rarity field.
function isRadiant(card: Card): boolean {
  return (card.rarity ?? "").toLowerCase() === "radiant rare";
}

function isAceSpec(card: Card): boolean {
  return (card.rarity ?? "").toLowerCase() === "ace spec rare";
}

function listNames(entries: DeckEntry[]): string {
  return entries.map((e) => e.card.name).join(", ");
}

/** One-of-a-kind classes: at most 1 card of the class per deck, combined. */
function checkSingleton(
  entries: DeckEntry[],
  rule: LegalityRule,
  label: string,
): LegalityIssue | null {
  const total = entries.reduce((n, e) => n + e.count, 0);
  if (total <= 1) return null;
  return {
    rule,
    severity: "error",
    message: `${total} ${label} cards (${listNames(entries)}) — only 1 ${label} card allowed per deck`,
    cardIds: entries.map((e) => e.card.id),
  };
}

export function checkDeckLegality(entries: DeckEntry[]): LegalityIssue[] {
  const live = entries.filter((e) => e.count > 0);
  const issues: LegalityIssue[] = [];

  const radiants = live.filter((e) => isRadiant(e.card));
  const radiantIssue = checkSingleton(radiants, "radiant", "Radiant");
  if (radiantIssue) issues.push(radiantIssue);

  const aceSpecs = live.filter((e) => isAceSpec(e.card));
  const aceSpecIssue = checkSingleton(aceSpecs, "ace-spec", "ACE SPEC");
  if (aceSpecIssue) issues.push(aceSpecIssue);

  // 4-copy limit applies per name so reprints from different sets combine.
  // Basic energy is exempt; Radiant/ACE SPEC are covered by stricter rules above.
  const byName = new Map<string, { count: number; cardIds: string[] }>();
  for (const e of live) {
    if (isBasicEnergy(e.card) || isRadiant(e.card) || isAceSpec(e.card)) continue;
    const group = byName.get(e.card.name) ?? { count: 0, cardIds: [] };
    group.count += e.count;
    group.cardIds.push(e.card.id);
    byName.set(e.card.name, group);
  }
  for (const [name, group] of byName) {
    if (group.count > MAX_COPIES_PER_NAME) {
      issues.push({
        rule: "copy-limit",
        severity: "error",
        message: `${group.count}× ${name} — max ${MAX_COPIES_PER_NAME} copies per name`,
        cardIds: group.cardIds,
      });
    }
  }

  const total = live.reduce((n, e) => n + e.count, 0);
  if (total !== LEGAL_DECK_SIZE) {
    const diff = Math.abs(LEGAL_DECK_SIZE - total);
    issues.push({
      rule: "deck-size",
      severity: "warning",
      message:
        total < LEGAL_DECK_SIZE
          ? `${total}/${LEGAL_DECK_SIZE} cards — add ${diff} more`
          : `${total}/${LEGAL_DECK_SIZE} cards — remove ${diff}`,
      cardIds: [],
    });
  }

  return issues;
}
