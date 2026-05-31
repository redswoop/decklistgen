import type { Card } from "../types/card.js";

/**
 * Pokémon TCG opening-hand / consistency simulation.
 *
 * Pure functions only — no Vue, no DOM. Operates purely on card *classification*
 * (category / trainerType / stage); no card-text effects are modeled. This is
 * fully accurate for what it measures (raw draw probabilities) and carries no
 * maintenance burden as new cards are released.
 *
 * RNG is injectable everywhere so tests are deterministic; production passes the
 * default `Math.random`.
 */

// --- RNG --------------------------------------------------------------------

/** Returns a float in [0, 1). Same contract as `Math.random`. */
export type Rng = () => number;

/** Mulberry32 — a tiny seedable PRNG, used so tests get reproducible shuffles. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Shuffle / draw ---------------------------------------------------------

/** Fisher–Yates over a copy. Never mutates the input. */
export function shuffle<T>(cards: readonly T[], rng: Rng = Math.random): T[] {
  const out = cards.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** Take the top `n` cards off `deck` (clamped to available). Returns the rest too. */
export function draw<T>(deck: readonly T[], n: number): { hand: T[]; rest: T[] } {
  const count = Math.max(0, Math.min(n, deck.length));
  return { hand: deck.slice(0, count), rest: deck.slice(count) };
}

// --- Classification predicates ---------------------------------------------
// All operate on the underlying `Card`, never an art override (cosmetic only).

export function isPokemon(c: Card): boolean {
  return c.category === "Pokemon";
}

/** A Basic Pokémon: category Pokemon with stage "Basic" or no stage set. */
export function isBasicPokemon(c: Card): boolean {
  if (c.category !== "Pokemon") return false;
  const stage = (c.stage ?? "").toLowerCase();
  return stage === "" || stage === "basic";
}

export function isSupporter(c: Card): boolean {
  return c.category === "Trainer" && c.trainerType === "Supporter";
}

export function isItem(c: Card): boolean {
  return c.category === "Trainer" && c.trainerType === "Item";
}

export function isEnergy(c: Card): boolean {
  return c.category === "Energy";
}

/** Basic (non-special) energy — keyed off the mechanics hash, not the name. */
export function isBasicEnergy(c: Card): boolean {
  return c.category === "Energy" && c.mechanicsHash === "basic";
}

/** A hand is a mulligan iff it contains zero Basic Pokémon. */
export function isMulliganHand(hand: readonly Card[]): boolean {
  return !hand.some(isBasicPokemon);
}

/**
 * Honest, narrow heuristic: a kept hand with no Supporter and no Item — i.e.
 * nothing obvious to develop the board turn 1. This intentionally ignores
 * Stadiums, Tools, and attacker viability, so do NOT label it "dead" in the UI;
 * label it exactly "no Supporter or Item".
 */
export function hasNoSupporterOrItem(hand: readonly Card[]): boolean {
  return !hand.some((c) => isSupporter(c) || isItem(c));
}

// --- Play order -------------------------------------------------------------

export type PlayOrder = "first" | "second";

/**
 * Cards drawn from the deck by the *start of turn `turn`*, excluding the opening
 * hand. The player going first skips their first-turn draw; the player going
 * second draws on turn 1.
 *
 *   going first:  by turn T you have drawn (T - 1)
 *   going second: by turn T you have drawn (T)
 */
export function extraDrawsByTurn(turn: number, order: PlayOrder): number {
  const t = Math.max(1, Math.floor(turn));
  return order === "second" ? t : t - 1;
}

// --- Dealing (shared by the interactive tester) -----------------------------

export interface DealResult {
  hand: Card[];
  rest: Card[];
  /** Whether the opening 7 (before any going-second draw) was a mulligan. */
  wasMulligan: boolean;
}

/**
 * Shuffle and deal an opening hand. The mulligan check is always against the
 * opening `handSize` cards; the going-second extra draw is applied afterward so
 * it never affects mulligan determination.
 */
export function dealOpeningHand(
  deck: readonly Card[],
  opts: { handSize?: number; order?: PlayOrder; rng?: Rng } = {},
): DealResult {
  const handSize = opts.handSize ?? DEFAULT_HAND_SIZE;
  const order = opts.order ?? "first";
  const rng = opts.rng ?? Math.random;

  if (deck.length === 0) return { hand: [], rest: [], wasMulligan: false };

  const shuffled = shuffle(deck, rng);
  const opening = draw(shuffled, handSize);
  const wasMulligan = isMulliganHand(opening.hand);

  if (order === "second") {
    const extra = draw(opening.rest, 1);
    return { hand: [...opening.hand, ...extra.hand], rest: extra.rest, wasMulligan };
  }
  return { hand: opening.hand, rest: opening.rest, wasMulligan };
}

// --- Hypergeometric (closed form) ------------------------------------------

const _logFact: number[] = [0, 0];
function logFactorial(n: number): number {
  for (let i = _logFact.length; i <= n; i++) {
    _logFact[i] = _logFact[i - 1] + Math.log(i);
  }
  return _logFact[n];
}

function logChoose(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

/** P(exactly k successes) drawing `draws` from a population with `successes` hits. */
export function hypergeometricPmf(
  population: number,
  successes: number,
  draws: number,
  k: number,
): number {
  if (population < 0 || successes < 0 || draws < 0 || k < 0) return 0;
  const d = Math.min(draws, population);
  if (k > successes || k > d) return 0;
  if (d - k > population - successes) return 0;
  const ln = logChoose(successes, k) + logChoose(population - successes, d - k) - logChoose(population, d);
  return Math.exp(ln);
}

/** P(at least k successes). */
export function hypergeometricAtLeast(
  population: number,
  successes: number,
  draws: number,
  k: number,
): number {
  if (k <= 0) return 1;
  const maxJ = Math.min(successes, Math.min(draws, population));
  let p = 0;
  for (let j = k; j <= maxJ; j++) {
    p += hypergeometricPmf(population, successes, draws, j);
  }
  return Math.min(1, p);
}

/**
 * Odds of seeing at least `k` copies of a card by a given turn, given the
 * opening hand plus `extraDraws` additional cards (see `extraDrawsByTurn`).
 */
export function oddsToSeeByTurn(
  deckSize: number,
  copies: number,
  handSize: number,
  extraDraws: number,
  k = 1,
): number {
  const draws = Math.min(deckSize, handSize + extraDraws);
  return hypergeometricAtLeast(deckSize, copies, draws, k);
}

// --- Monte Carlo runner -----------------------------------------------------

export const DEFAULT_HAND_SIZE = 7;
export const DEFAULT_TURNS = 4;
export const DEFAULT_ITERATIONS = 10000;
export const DEFAULT_MAX_MULLIGANS = 100;

export interface SimOptions {
  /** Flattened deck (one entry per physical card, using `.card` not `.artCard`). */
  deck: Card[];
  handSize?: number;
  /** Number of "by turn N" buckets to compute, N = 1..turns. */
  turns?: number;
  iterations?: number;
  rng?: Rng;
  maxMulligans?: number;
  order?: PlayOrder;
}

export interface ByCardOdds {
  cardId: string;
  name: string;
  copies: number;
  /** Index t-1 = odds of seeing >=1 copy by turn t. */
  byTurn: number[];
}

export interface SimResult {
  iterations: number;
  deckSize: number;
  handSize: number;
  turns: number;
  order: PlayOrder;
  /** Fraction of *first* opening hands that were a mulligan. */
  mulliganRate: number;
  /** Average number of mulligans before a keepable hand (capped). */
  avgMulligansPerGame: number;
  /**
   * Among *kept* hands, the fraction with no Supporter and no Item. Honest label:
   * "no Supporter or Item" — NOT a true dead-hand rate (ignores Stadium/Tool and
   * attacker viability).
   */
  noSupporterOrItemRate: number;
  /** Closed-form P(>=1 Basic in opening hand) = 1 - mulliganRate (in expectation). */
  oddsBasic: number;
  /** Monte-Carlo joint odds of >=1 Basic AND >=1 Supporter in the opening hand. */
  oddsBasicAndSupporter: number;
  /**
   * Per-card "see by turn N" curves, closed-form hypergeometric.
   *
   * NOTE: these ignore mulligan reshuffle conditioning — they answer "from a
   * single fresh shuffle" rather than "given the hand was kept". For normal
   * decks the difference is negligible, but for low-Basic decks these will
   * diverge slightly from a mulligan-respecting Monte-Carlo estimate. That
   * divergence is expected, not a bug.
   */
  byCard: ByCardOdds[];
  /** Same closed-form curves for useful categories. */
  byCategory: Record<string, number[]>;
  /** True when the deck has zero Basic Pokémon (every hand mulligans; loop capped). */
  infiniteMulligan: boolean;
}

function emptyResult(handSize: number, turns: number, order: PlayOrder): SimResult {
  return {
    iterations: 0,
    deckSize: 0,
    handSize,
    turns,
    order,
    mulliganRate: 0,
    avgMulligansPerGame: 0,
    noSupporterOrItemRate: 0,
    oddsBasic: 0,
    oddsBasicAndSupporter: 0,
    byCard: [],
    byCategory: {},
    infiniteMulligan: false,
  };
}

export function runMonteCarlo(opts: SimOptions): SimResult {
  const handSize = opts.handSize ?? DEFAULT_HAND_SIZE;
  const turns = opts.turns ?? DEFAULT_TURNS;
  const iterations = opts.iterations ?? DEFAULT_ITERATIONS;
  const rng = opts.rng ?? Math.random;
  const maxMulligans = opts.maxMulligans ?? DEFAULT_MAX_MULLIGANS;
  const order = opts.order ?? "first";
  const deck = opts.deck;
  const deckSize = deck.length;

  if (deckSize === 0) return emptyResult(handSize, turns, order);

  const basicsInDeck = deck.filter(isBasicPokemon).length;
  const infiniteMulligan = basicsInDeck === 0;

  // --- Monte Carlo over fresh shuffles ---
  let firstHandMulligans = 0;
  let basicAndSupporter = 0;
  let totalMulligans = 0;
  let keptHands = 0;
  let keptNoSupportOrItem = 0;

  for (let i = 0; i < iterations; i++) {
    let shuffled = shuffle(deck, rng);
    let hand = shuffled.slice(0, handSize);

    if (isMulliganHand(hand)) firstHandMulligans++;
    if (hand.some(isBasicPokemon) && hand.some(isSupporter)) basicAndSupporter++;

    // Resolve mulligans to a keepable hand (capped so a 0-Basic deck terminates).
    let mulligansThisGame = 0;
    while (isMulliganHand(hand) && mulligansThisGame < maxMulligans) {
      mulligansThisGame++;
      shuffled = shuffle(deck, rng);
      hand = shuffled.slice(0, handSize);
    }
    totalMulligans += mulligansThisGame;

    if (!isMulliganHand(hand)) {
      keptHands++;
      if (hasNoSupporterOrItem(hand)) keptNoSupportOrItem++;
    }
  }

  // --- Closed-form curves ---
  const byCard = buildByCard(deck, deckSize, handSize, turns, order);
  const byCategory = buildByCategory(deck, deckSize, handSize, turns, order);

  return {
    iterations,
    deckSize,
    handSize,
    turns,
    order,
    mulliganRate: firstHandMulligans / iterations,
    avgMulligansPerGame: totalMulligans / iterations,
    noSupporterOrItemRate: keptHands > 0 ? keptNoSupportOrItem / keptHands : 0,
    oddsBasic: hypergeometricAtLeast(deckSize, basicsInDeck, handSize, 1),
    oddsBasicAndSupporter: basicAndSupporter / iterations,
    byCard,
    byCategory,
    infiniteMulligan,
  };
}

function turnCurve(
  deckSize: number,
  copies: number,
  handSize: number,
  turns: number,
  order: PlayOrder,
): number[] {
  const curve: number[] = [];
  for (let t = 1; t <= turns; t++) {
    curve.push(oddsToSeeByTurn(deckSize, copies, handSize, extraDrawsByTurn(t, order)));
  }
  return curve;
}

function buildByCard(
  deck: Card[],
  deckSize: number,
  handSize: number,
  turns: number,
  order: PlayOrder,
): ByCardOdds[] {
  const groups = new Map<string, { card: Card; copies: number }>();
  for (const card of deck) {
    const g = groups.get(card.id);
    if (g) g.copies++;
    else groups.set(card.id, { card, copies: 1 });
  }
  return [...groups.values()]
    .map(({ card, copies }) => ({
      cardId: card.id,
      name: card.name,
      copies,
      byTurn: turnCurve(deckSize, copies, handSize, turns, order),
    }))
    .sort((a, b) => b.copies - a.copies || a.name.localeCompare(b.name));
}

function buildByCategory(
  deck: Card[],
  deckSize: number,
  handSize: number,
  turns: number,
  order: PlayOrder,
): Record<string, number[]> {
  const counts = {
    "Basic Pokémon": deck.filter(isBasicPokemon).length,
    Supporter: deck.filter(isSupporter).length,
    Item: deck.filter(isItem).length,
    "Basic Energy": deck.filter(isBasicEnergy).length,
    Energy: deck.filter(isEnergy).length,
  };
  const out: Record<string, number[]> = {};
  for (const [label, copies] of Object.entries(counts)) {
    if (copies > 0) out[label] = turnCurve(deckSize, copies, handSize, turns, order);
  }
  return out;
}
