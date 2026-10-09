import type { Card } from "../../shared/types/card.js";
import type { DeckCard } from "../../shared/types/deck.js";
import type { BeautifyOptions } from "../../shared/types/beautify.js";
import { groupDeckCardsForBeautify } from "../../shared/utils/beautify-groups.js";
import { deduplicateByArt } from "../../shared/utils/variant-allocation.js";
import { getTopRarityVariants } from "../../shared/utils/rarity-rank.js";
import { shuffle, type Rng } from "../../shared/utils/hand-sim.js";

/**
 * Beautify a deck's card list: for each distinct card (name + mechanicsHash),
 * re-point its copies at nicer printings — either one "best" (highest rarity)
 * art or spread across every unique art ("diverse").
 *
 * Pure apart from the injected `getVariants` and `rng`, so the REST route, the
 * MCP tool and the tests all share one implementation. Mirrors the client
 * BeautifyDialog semantics: groups never leak into a same-name card with
 * different text, and a group with no eligible variant is left untouched.
 */
export interface BeautifyOutcome {
  cards: DeckCard[];
  /** Per-group summary for reporting what changed. */
  changes: Array<{ name: string; from: string[]; to: Array<{ cardId: string; count: number }>; skipped?: string }>;
}

export function beautifyDeckCards(
  cards: DeckCard[],
  getVariants: (cardId: string) => Card[],
  opts: BeautifyOptions,
  rng: Rng = Math.random,
): BeautifyOutcome {
  const excludeSet = new Set((opts.excludeRarities ?? []).map((r) => r.toLowerCase()));
  const excludePrintUnfriendly = opts.excludePrintUnfriendly ?? true;
  const changes: BeautifyOutcome["changes"] = [];

  let result = cards.map((c) => ({ ...c }));

  for (const group of groupDeckCardsForBeautify(cards)) {
    let variants = getVariants(group.cardId);
    if (excludePrintUnfriendly) variants = variants.filter((v) => !v.isPrintUnfriendly);
    if (excludeSet.size > 0) variants = variants.filter((v) => !excludeSet.has(v.rarity.toLowerCase()));
    variants = variants.filter((v) => !!v.imageBase);
    variants = deduplicateByArt(variants);

    const from = group.entries.map((e) => `${e.setCode}:${e.localId}`);
    if (variants.length === 0) {
      changes.push({ name: group.name, from, to: [], skipped: "no eligible variant" });
      continue;
    }

    let replacement: Array<{ card: Card; count: number }>;
    if (opts.mode === "best") {
      replacement = [{ card: getTopRarityVariants(variants)[0], count: group.totalCount }];
    } else {
      replacement = spreadRoundRobin(shuffle(variants, rng), group.totalCount);
    }

    const drop = new Set(group.entries.map((e) => `${e.setCode}\0${e.localId}`));
    result = result.filter((dc) => !drop.has(`${dc.card.setCode}\0${dc.card.localId}`));
    for (const r of replacement) {
      const existing = result.find((dc) => dc.card.setCode === r.card.setCode && dc.card.localId === r.card.localId);
      if (existing) existing.count += r.count;
      else result.push({ count: r.count, card: r.card });
    }
    changes.push({ name: group.name, from, to: replacement.map((r) => ({ cardId: r.card.id, count: r.count })) });
  }

  return { cards: result, changes };
}

export function spreadRoundRobin(variants: Card[], totalCount: number): Array<{ card: Card; count: number }> {
  if (variants.length === 0) return [];
  const out: Array<{ card: Card; count: number }> = [];
  const perVariant = Math.floor(totalCount / variants.length);
  let remainder = totalCount % variants.length;
  for (const variant of variants) {
    const count = perVariant + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    if (count > 0) out.push({ card: variant, count });
  }
  return out;
}
