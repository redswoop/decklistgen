import type { Card } from "../types/card.js";
import { isBasicEnergy } from "./energy.js";

/**
 * A print plan: how many copies of each deck card go on the sheet. Keyed by the
 * deck entry's base card id (`DeckCard.card.id`, never the art override), which
 * is unique per deck entry and what the print loader looks up.
 *
 * Pure math for the deck grid's print mode — the composable holds refs, the URL
 * grammar carries the result. Nothing here touches Vue or the DOM.
 */
export type PrintCounts = Record<string, number>;

export interface PrintPlanEntry {
  /** Base card id of the deck entry. */
  id: string;
  /** Copies in the deck — the ceiling for the print count. */
  deckCount: number;
}

/** One bucket per print filter, matching `shouldPrintCard`'s partitions. */
export type PrintCategory =
  | "pokemon" | "supporters" | "items" | "tools" | "stadiums"
  | "specialenergy" | "basicenergy" | "other";

const CATEGORY_LABELS: Record<PrintCategory, string> = {
  pokemon: "Pokémon",
  supporters: "Supporters",
  items: "Items",
  tools: "Tools",
  stadiums: "Stadiums",
  specialenergy: "Special Energy",
  basicenergy: "Basic Energy",
  other: "Other",
};

/** Display order for print-category group headers. */
export const PRINT_CATEGORY_ORDER: PrintCategory[] = [
  "pokemon", "supporters", "items", "tools", "stadiums", "specialenergy", "basicenergy", "other",
];

/**
 * Classify a card into its print bucket without a CardDetail: basic energy is
 * read off `mechanicsHash === "basic"` (see energy.ts), so anything else in the
 * Energy category is special.
 */
export function printCategoryOf(card: Card): PrintCategory {
  if (card.category === "Pokemon") return "pokemon";
  if (card.category === "Trainer") {
    switch (card.trainerType) {
      case "Supporter": return "supporters";
      case "Item": return "items";
      case "Tool": return "tools";
      case "Stadium": return "stadiums";
      default: return "other";
    }
  }
  if (card.category === "Energy") {
    return isBasicEnergy(card) ? "basicenergy" : "specialenergy";
  }
  return "other";
}

export function printCategoryLabel(category: PrintCategory): string {
  return CATEGORY_LABELS[category];
}

function clamp(n: number, max: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.floor(n)));
}

/** Every card at its full deck count. */
export function fullPrintCounts(entries: PrintPlanEntry[]): PrintCounts {
  const out: PrintCounts = {};
  for (const e of entries) out[e.id] = e.deckCount;
  return out;
}

/** One copy of every card (a proof sheet). */
export function oneEachPrintCounts(entries: PrintPlanEntry[]): PrintCounts {
  const out: PrintCounts = {};
  for (const e of entries) out[e.id] = e.deckCount > 0 ? 1 : 0;
  return out;
}

/**
 * Resolve stored overrides against the current deck: unknown ids are dropped,
 * missing ids default to their deck count, everything is clamped to
 * [0, deckCount]. The result always has exactly one entry per deck card.
 */
export function resolvePrintCounts(entries: PrintPlanEntry[], overrides: PrintCounts): PrintCounts {
  const out: PrintCounts = {};
  for (const e of entries) {
    const raw = overrides[e.id];
    out[e.id] = raw === undefined ? e.deckCount : clamp(raw, e.deckCount);
  }
  return out;
}

/** Return a new counts map with `id` set to `n` (clamped to its deck count). */
export function setPrintCount(
  counts: PrintCounts,
  entries: PrintPlanEntry[],
  id: string,
  n: number,
): PrintCounts {
  const entry = entries.find((e) => e.id === id);
  if (!entry) return counts;
  return { ...counts, [id]: clamp(n, entry.deckCount) };
}

/** Set a whole set of ids to full deck count (`on`) or zero. */
export function setPrintGroup(
  counts: PrintCounts,
  entries: PrintPlanEntry[],
  ids: Iterable<string>,
  on: boolean,
): PrintCounts {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const out = { ...counts };
  for (const id of ids) {
    const entry = byId.get(id);
    if (!entry) continue;
    out[id] = on ? entry.deckCount : 0;
  }
  return out;
}

export type PrintGroupState = "all" | "none" | "mixed" | "empty";

/**
 * Three-state summary of a group for its header checkbox: "all" when every card
 * is at full deck count, "none" when every card is at zero, "mixed" otherwise.
 * "empty" when the group has no cards.
 */
export function printGroupState(
  counts: PrintCounts,
  entries: PrintPlanEntry[],
  ids: Iterable<string>,
): PrintGroupState {
  const byId = new Map(entries.map((e) => [e.id, e]));
  let seen = 0;
  let full = 0;
  let zero = 0;
  for (const id of ids) {
    const entry = byId.get(id);
    if (!entry) continue;
    seen++;
    const n = counts[id] ?? entry.deckCount;
    if (n === 0) zero++;
    if (n >= entry.deckCount) full++;
  }
  if (seen === 0) return "empty";
  if (full === seen) return "all";
  if (zero === seen) return "none";
  return "mixed";
}

/** Total copies that will print. */
export function totalPrintCopies(counts: PrintCounts): number {
  let total = 0;
  for (const n of Object.values(counts)) total += n;
  return total;
}

/**
 * Only what changed since the last print: `deckCount − lastPrinted`, floored at
 * zero. A card that wasn't printed last time prints in full; one that shrank
 * prints nothing (you can't un-print a proxy).
 */
export function sinceLastPrintCounts(entries: PrintPlanEntry[], lastPrinted: PrintCounts): PrintCounts {
  const out: PrintCounts = {};
  for (const e of entries) {
    const prev = lastPrinted[e.id] ?? 0;
    out[e.id] = Math.max(0, e.deckCount - prev);
  }
  return out;
}

/**
 * Sparse URL encoding for the `counts` param: only ids whose print count differs
 * from the deck count, as `id:n` pairs joined by commas. Empty string when the
 * plan is "print everything", so the common URL stays short.
 */
export function encodePrintCounts(counts: PrintCounts, entries: PrintPlanEntry[]): string {
  const parts: string[] = [];
  for (const e of entries) {
    const n = counts[e.id];
    if (n === undefined || n === e.deckCount) continue;
    parts.push(`${e.id}:${n}`);
  }
  return parts.join(",");
}

/** Parse a `counts` param back into overrides; malformed pairs are ignored. */
export function decodePrintCounts(raw: string | null | undefined): PrintCounts {
  const out: PrintCounts = {};
  if (!raw) return out;
  for (const part of raw.split(",")) {
    const idx = part.lastIndexOf(":");
    if (idx <= 0) continue;
    const id = part.slice(0, idx);
    const n = Number(part.slice(idx + 1));
    if (!Number.isInteger(n) || n < 0) continue;
    out[id] = n;
  }
  return out;
}
