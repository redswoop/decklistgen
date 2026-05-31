import type { Card } from "../types/card.js";

/**
 * Name-based recognition of the support cards the setup simulator's bot knows
 * how to play. These are all plain Trainer cards in the data (no special
 * metadata), so we match on `Card.name`. This list is intentionally small and
 * explicit: a card the bot doesn't recognize is simply treated as inert filler,
 * which keeps the simulation honest (it never over-credits an effect it can't
 * actually model).
 */

function normName(c: Card): string {
  return c.name.trim().toLowerCase();
}

// --- Rare Candy --------------------------------------------------------------

/** Rare Candy: evolve a Basic directly into its Stage 2, skipping Stage 1. */
export function isRareCandy(c: Card): boolean {
  return normName(c) === "rare candy";
}

// --- Ball search items -------------------------------------------------------

export type BallKind = "quick" | "nest" | "level" | "ultra";

export interface BallSpec {
  kind: BallKind;
  /** Cards discarded from hand as a play cost. */
  discard: number;
  /** What the ball is allowed to fetch. */
  fetch: "basic" | "pokemon-hp-le-90" | "any-pokemon";
}

const BALLS: Record<string, BallSpec> = {
  "quick ball": { kind: "quick", discard: 1, fetch: "basic" },
  "nest ball": { kind: "nest", discard: 0, fetch: "basic" },
  "level ball": { kind: "level", discard: 0, fetch: "pokemon-hp-le-90" },
  "ultra ball": { kind: "ultra", discard: 2, fetch: "any-pokemon" },
};

/** Returns the ball's search profile, or null if the card isn't a known ball. */
export function ballSpec(c: Card): BallSpec | null {
  return BALLS[normName(c)] ?? null;
}

/** Whether a `fetch` restriction allows pulling a given Pokemon `Card`. */
export function ballCanFetch(spec: BallSpec, target: Card): boolean {
  if (target.category !== "Pokemon") return false;
  switch (spec.fetch) {
    case "basic":
      return (target.stage ?? "").toLowerCase() === "basic" || !target.stage;
    case "pokemon-hp-le-90":
      return (target.hp ?? Infinity) <= 90;
    case "any-pokemon":
      return true;
  }
}

// --- Draw / search supporters ------------------------------------------------

export type BotSupporter = "professors-research" | "iono" | "arven";

const SUPPORTERS: Record<string, BotSupporter> = {
  "professor's research": "professors-research",
  "iono": "iono",
  "arven": "arven",
};

/** Returns which understood supporter this card is, or null. */
export function botSupporter(c: Card): BotSupporter | null {
  return SUPPORTERS[normName(c)] ?? null;
}

// --- Battle VIP Pass ---------------------------------------------------------

/**
 * Battle VIP Pass — an Item, but playable only on your first turn; searches up
 * to 2 Basic Pokémon and benches them. Handled in the item phase (it does not
 * consume the supporter for the turn).
 */
export function isBattleVipPass(c: Card): boolean {
  return normName(c) === "battle vip pass";
}
