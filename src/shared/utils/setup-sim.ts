import {
  shuffle,
  isMulliganHand,
  DEFAULT_MAX_MULLIGANS,
  type Rng,
  type PlayOrder,
} from "./hand-sim.js";
import { buildEvolutionLines, normStage, type EvolutionLine, type SimCard } from "./evolution-lines.js";
import { classifyCard, classifyAbility, type SetupRule, type AbilityRule, type Capability, type PokeRestrict } from "./setup-rules.js";

/**
 * Monte Carlo "how many turns until this line sets up?" simulator.
 *
 * Each game shuffles the deck, mulligans, sets aside 6 prizes, then plays out
 * turns with a greedy bot whose only goal is to put the target line's final
 * stage into play as fast as legally possible. "Set up" = the final-stage card
 * is in play; energy is not modeled.
 *
 * The bot plays support cards by their inferred *capability* (see setup-rules.ts)
 * rather than a hardcoded name list: it benches Basics, searches for the next
 * evolution piece, draws to dig, and uses Rare Candy — all derived from each
 * card's printed effect text. It obeys evolution timing (no evolving the turn a
 * Pokémon entered play; no evolving on the first turn). Pure & deterministic
 * given a seeded RNG.
 */

export const DEFAULT_SETUP_ITERATIONS = 3000;
export const DEFAULT_SETUP_TURNS = 5;
const HAND_SIZE = 7;
const PRIZE_COUNT = 6;
const MAX_LINE_BASICS_IN_PLAY = 2;
const MAX_BENCH = 5;

export interface SetupSimOptions {
  deck: SimCard[];
  line: EvolutionLine;
  iterations?: number;
  maxTurns?: number;
  order?: PlayOrder;
  rng?: Rng;
  maxMulligans?: number;
}

export interface SetupSimResult {
  iterations: number;
  deckSize: number;
  order: PlayOrder;
  maxTurns: number;
  lineId: string;
  lineLabel: string;
  perTurnSetup: number[];
  cumulativeSetup: number[];
  avgSetupTurn: number;
  neverSetUpRate: number;
  mulliganRate: number;
  unsatisfiable: boolean;
}

// --- Game state --------------------------------------------------------------

export interface BenchSlot {
  name: string;
  enteredTurn: number;
  /** Turn this Pokémon's once-per-turn ability was last used. */
  abilityUsedTurn?: number;
}

export interface GameState {
  hand: SimCard[];
  deck: SimCard[]; // library, top = index 0
  discard: SimCard[];
  bench: BenchSlot[];
  turn: number;
  order: PlayOrder;
  supporterUsed: boolean;
  /** name → inferred setup rule (built once per deck). */
  rules?: Map<string, SetupRule | null>;
  /** name → inferred ability rule (built once per deck). */
  abilityRules?: Map<string, AbilityRule | null>;
  /** The line being measured — used for ability-usefulness + on-bench context. */
  target?: EvolutionLine;
  /** Secondary lines the bot sets up purely for their draw/search abilities. */
  engineLines?: EvolutionLine[];
  /** Lowercased Basic names to bench because some ability needs them in play (e.g. Solrock for Lunatone). */
  enginePartners?: Set<string>;
}

/** Engine lines + partners the bot maintains alongside the target. */
export interface EngineSpec {
  engineLines: EvolutionLine[];
  enginePartners: Set<string>;
}

const ENGINE_LINE_CAP = 2;

/**
 * Pick the deck's best draw/search ability engines (lines whose ability-bearer
 * has a useful ability), plus any Basics those abilities require in play.
 */
export function selectEngines(deck: SimCard[], target: EvolutionLine, abilityRules: Map<string, AbilityRule | null>): EngineSpec {
  const { lines } = buildEvolutionLines(deck);
  const scored: Array<{ line: EvolutionLine; ar: AbilityRule; score: number }> = [];
  for (const line of lines) {
    if (line.id === target.id) continue;
    const ar = abilityRules.get(line.finalName) ?? null;
    if (!ar) continue;
    const c = ar.cap;
    const isDrawSearch =
      c.type === "draw" || c.type === "draw-to" || c.type === "search-pokemon" || c.type === "search-line" || c.type === "search-supporter";
    if (!isDrawSearch) continue;
    const value = c.type === "draw" ? c.amount : c.type === "draw-to" ? c.size : 4; // rough draw-equivalent
    scored.push({ line, ar, score: value * Math.max(1, line.finalCopies) });
  }
  scored.sort((a, b) => b.score - a.score || a.line.finalName.localeCompare(b.line.finalName));
  const engineLines = scored.slice(0, ENGINE_LINE_CAP).map((s) => s.line);

  const enginePartners = new Set<string>();
  for (const s of scored.slice(0, ENGINE_LINE_CAP)) {
    if (s.ar.requiresInPlay) enginePartners.add(s.ar.requiresInPlay);
  }
  return { engineLines, enginePartners };
}

function buildRuleMap(deck: SimCard[]): Map<string, SetupRule | null> {
  const m = new Map<string, SetupRule | null>();
  for (const c of deck) if (!m.has(c.name)) m.set(c.name, classifyCard(c));
  return m;
}

function buildAbilityMap(deck: SimCard[]): Map<string, AbilityRule | null> {
  const m = new Map<string, AbilityRule | null>();
  for (const c of deck) if (!m.has(c.name)) m.set(c.name, classifyAbility(c));
  return m;
}

function ruleFor(state: GameState, card: SimCard): SetupRule | null {
  const r = state.rules?.get(card.name);
  return r !== undefined ? r : classifyCard(card);
}

function abilityRuleByName(state: GameState, name: string): AbilityRule | null {
  return state.abilityRules?.get(name) ?? null;
}

// --- Small queries -----------------------------------------------------------

function handHasName(state: GameState, name: string | null): boolean {
  return !!name && state.hand.some((c) => c.name === name);
}
function isCandy(state: GameState, card: SimCard): boolean {
  return ruleFor(state, card)?.cap.type === "rare-candy";
}
function anyRareCandyAccessible(state: GameState): boolean {
  return state.hand.some((c) => isCandy(state, c)) || state.deck.some((c) => isCandy(state, c));
}

/** Where `name` sits on the target line: final=3, stage1=2, basic=1, off-line=0. */
function pathRank(line: EvolutionLine, name: string): number {
  if (name === line.finalName) return 3;
  if (line.stage1Name && name === line.stage1Name) return 2;
  if (line.basicName && name === line.basicName) return 1;
  return 0;
}
function bestOnPathSlot(state: GameState, line: EvolutionLine): BenchSlot | null {
  let best: BenchSlot | null = null;
  let bestRank = 0;
  for (const slot of state.bench) {
    const r = pathRank(line, slot.name);
    if (r > bestRank) {
      bestRank = r;
      best = slot;
    }
  }
  return best;
}
function successReached(state: GameState, line: EvolutionLine): boolean {
  return state.bench.some((s) => s.name === line.finalName);
}
function lineBasicsInPlay(state: GameState, line: EvolutionLine): number {
  return state.bench.filter((s) => pathRank(line, s.name) >= 1).length;
}

// --- What Pokémon the bot wants next -----------------------------------------

export type NeededPiece =
  | { kind: "basic"; name: string }
  | { kind: "stage1"; name: string }
  | { kind: "final"; name: string }
  | { kind: "done" };

export function nextNeededPiece(state: GameState, line: EvolutionLine): NeededPiece {
  if (successReached(state, line)) return { kind: "done" };
  const best = bestOnPathSlot(state, line);

  if (!best) {
    if (!line.basicName) return { kind: "done" };
    return { kind: "basic", name: line.basicName };
  }
  if (best.name === line.finalName) return { kind: "done" };
  if (line.stage1Name && best.name === line.stage1Name) return { kind: "final", name: line.finalName };

  // Best is the Basic.
  if (line.finalStage === "Stage1") return { kind: "final", name: line.finalName };
  if (line.stage1Name && !anyRareCandyAccessible(state)) {
    if (!handHasName(state, line.stage1Name)) return { kind: "stage1", name: line.stage1Name };
    return { kind: "final", name: line.finalName };
  }
  return { kind: "final", name: line.finalName };
}

// --- Discard-cost payment ----------------------------------------------------

/** Protect line pieces and any card the bot can actually use (has a setup rule). */
function isProtected(card: SimCard, line: EvolutionLine): boolean {
  if (card.name === line.basicName || card.name === line.stage1Name || card.name === line.finalName) return true;
  return classifyCard(card) !== null;
}

export function pickDiscards(
  hand: readonly SimCard[],
  n: number,
  line: EvolutionLine,
  exclude?: SimCard,
): SimCard[] | null {
  if (n <= 0) return [];
  const fodder: SimCard[] = [];
  for (const c of hand) {
    if (c === exclude) continue;
    if (isProtected(c, line)) continue;
    fodder.push(c);
    if (fodder.length === n) return fodder;
  }
  return null;
}

// --- Card movement -----------------------------------------------------------

function removeFromHand(state: GameState, card: SimCard): void {
  const i = state.hand.indexOf(card);
  if (i >= 0) state.hand.splice(i, 1);
}
function discardFromHand(state: GameState, card: SimCard): void {
  removeFromHand(state, card);
  state.discard.push(card);
}
function moveDeckCardToHand(state: GameState, card: SimCard): void {
  const i = state.deck.indexOf(card);
  if (i >= 0) {
    state.deck.splice(i, 1);
    state.hand.push(card);
  }
}
function drawN(state: GameState, n: number): void {
  const count = Math.max(0, Math.min(n, state.deck.length));
  for (let i = 0; i < count; i++) state.hand.push(state.deck.shift()!);
}

function cardMatchesRestrict(card: SimCard, restrict: PokeRestrict, maxHp?: number, energyType?: string): boolean {
  if (card.category !== "Pokemon") return false;
  if (maxHp != null && (card.hp ?? Infinity) > maxHp) return false;
  if (energyType && !card.energyTypes.includes(energyType)) return false; // typed search (e.g. Fighting Gong)
  switch (restrict) {
    case "any":
      return true;
    case "basic":
      return normStage(card.stage) === "Basic";
    case "evolution":
      return normStage(card.stage) !== "Basic";
    case "non-rule-box":
      return !(card.isEx || card.isV || card.isVmax || card.isVstar);
  }
}

// --- Capability scoring & application ----------------------------------------

/** Can a deck card matching `name` + restriction be fetched? */
function deckFetchTarget(state: GameState, name: string, restrict: PokeRestrict, maxHp?: number, energyType?: string): SimCard | undefined {
  return state.deck.find((c) => c.name === name && cardMatchesRestrict(c, restrict, maxHp, energyType));
}

/** Would playing this Item actually advance the line right now (right type, target in deck)? */
function itemCanHelp(state: GameState, line: EvolutionLine, card: SimCard): boolean {
  const r = ruleFor(state, card);
  if (!r || r.source !== "item") return false;
  const cap = r.cap;
  const need = nextNeededPiece(state, line);
  switch (cap.type) {
    case "rare-candy":
      return line.finalStage === "Stage2" && !!line.basicName && (line.requiresRareCandy || anyRareCandyAccessible(state));
    case "bench-basics":
      return (
        !!line.basicName &&
        lineBasicsInPlay(state, line) < MAX_LINE_BASICS_IN_PLAY &&
        !!deckFetchTarget(state, line.basicName, "basic", cap.maxHp, cap.energyType)
      );
    case "search-line":
      return need.kind !== "done";
    case "search-pokemon":
      return need.kind !== "done" && !!deckFetchTarget(state, need.name, cap.restrict, cap.maxHp, cap.energyType);
    default:
      return false;
  }
}

/** A deck Item the bot could fetch (via Arven/Petrel) that genuinely helps the line. */
function usefulSearchItemInDeck(state: GameState, line: EvolutionLine): SimCard | undefined {
  return state.deck.find((c) => itemCanHelp(state, line, c));
}

/** A best draw/search Supporter sitting in the deck (for search-supporter to grab). */
function deckHasUsefulSupporter(state: GameState): boolean {
  return state.deck.some((c) => {
    const r = ruleFor(state, c);
    return r?.source === "supporter" && (r.cap.type === "draw" || r.cap.type === "draw-to" || r.cap.type === "search-pokemon" || r.cap.type === "search-line");
  });
}

/**
 * How useful is playing this rule right now? 0 = don't. Drives both the
 * one-Supporter-per-turn choice and the unlimited item plays.
 */
function ruleScore(state: GameState, line: EvolutionLine, card: SimCard, rule: SetupRule): number {
  // Can't pay the discard cost → can't play.
  if (rule.discard > 0 && !pickDiscards(state.hand, rule.discard, line, card)) return 0;

  const need = nextNeededPiece(state, line);
  const cap = rule.cap;
  switch (cap.type) {
    case "rare-candy":
      return 0; // applied in the evolve phase, never "played" as an action
    case "bench-basics": {
      if (!line.basicName) return 0;
      if (lineBasicsInPlay(state, line) >= MAX_LINE_BASICS_IN_PLAY) return 0;
      const target = deckFetchTarget(state, line.basicName, "basic", cap.maxHp, cap.energyType);
      if (!target) return 0;
      return lineBasicsInPlay(state, line) === 0 ? 88 : 32; // first basic vs backup
    }
    case "search-line":
      return need.kind === "done" ? 0 : 95;
    case "search-pokemon": {
      if (need.kind === "done") return 0;
      if (handHasName(state, need.name)) return 0; // already hold it
      return deckFetchTarget(state, need.name, cap.restrict, cap.maxHp, cap.energyType) ? 90 : 0;
    }
    case "search-trainer": {
      // Fetch Rare Candy on a Candy path, else a search Item that finds the next piece.
      const onCandyPath = line.finalStage === "Stage2" && (line.requiresRareCandy || anyRareCandyAccessible(state));
      if (onCandyPath && !state.hand.some((c) => isCandy(state, c)) && state.deck.some((c) => isCandy(state, c))) return 80;
      if (need.kind !== "done" && usefulSearchItemInDeck(state, line)) return 50;
      return 8;
    }
    case "search-supporter":
      return !state.supporterUsed && deckHasUsefulSupporter(state) ? 45 : 0;
    case "draw":
    case "draw-to": {
      // Dig when we can't act on the next piece from hand; avoid shuffling a usable piece away.
      const canAct = need.kind !== "done" && handHasName(state, need.name);
      if (canAct) return cap.type === "draw" && cap.shuffleHand ? 0 : 8;
      return 55;
    }
  }
}

function shuffleHandIntoDeck(state: GameState, rng: Rng): void {
  state.deck = shuffle([...state.deck, ...state.hand], rng);
  state.hand = [];
}

/** Apply a rule's effect. The card has already been chosen; resolves cost + effect. */
function applyRule(state: GameState, line: EvolutionLine, card: SimCard, rule: SetupRule, rng: Rng, log: string[]): void {
  discardFromHand(state, card);
  if (rule.discard > 0) {
    const cost = pickDiscards(state.hand, rule.discard, line);
    if (cost) for (const d of cost) discardFromHand(state, d);
  }
  if (rule.source === "supporter") state.supporterUsed = true;
  if (rule.coinFlip && rng() >= 0.5) {
    log.push(`T${state.turn}: ${card.name} (flip — failed)`);
    return;
  }
  runCapability(state, line, rule.cap, rng, log, card.name);
}

/** Apply a capability's effect (shared by Trainer rules and Pokémon abilities). */
function runCapability(state: GameState, line: EvolutionLine, cap: Capability, rng: Rng, log: string[], label: string): void {
  switch (cap.type) {
    case "rare-candy":
      break; // handled in the evolve phase
    case "bench-basics": {
      let n = 0;
      // Target line's basics first.
      if (line.basicName) {
        while (n < cap.count && state.bench.length < MAX_BENCH && lineBasicsInPlay(state, line) < MAX_LINE_BASICS_IN_PLAY) {
          const t = deckFetchTarget(state, line.basicName, "basic", cap.maxHp, cap.energyType);
          if (!t) break;
          state.deck.splice(state.deck.indexOf(t), 1);
          state.bench.push({ name: t.name, enteredTurn: state.turn });
          n++;
        }
        if (n > 0) log.push(`T${state.turn}: ${label} → benched ${n}× ${line.basicName}`);
      }
      // Spill into engine-line basics / partners with any remaining count + bench room.
      while (n < cap.count && state.bench.length < MAX_BENCH) {
        const t = engineBenchTargetInDeck(state, cap.maxHp, cap.energyType);
        if (!t) break;
        state.deck.splice(state.deck.indexOf(t), 1);
        pushBench(state, t.name, rng, log, ` (engine, via ${label})`);
        n++;
      }
      break;
    }
    case "search-line": {
      for (const name of [line.basicName, line.stage1Name, line.finalName]) {
        if (!name || handHasName(state, name)) continue;
        const t = state.deck.find((c) => c.name === name);
        if (t) moveDeckCardToHand(state, t);
      }
      log.push(`T${state.turn}: ${label} → searched the line`);
      break;
    }
    case "search-pokemon": {
      const need = nextNeededPiece(state, line);
      if (need.kind !== "done" && !handHasName(state, need.name)) {
        const t = deckFetchTarget(state, need.name, cap.restrict, cap.maxHp, cap.energyType);
        if (t) {
          moveDeckCardToHand(state, t);
          log.push(`T${state.turn}: ${label} → ${t.name}`);
        }
      }
      break;
    }
    case "search-trainer": {
      const onCandyPath = line.finalStage === "Stage2" && (line.requiresRareCandy || anyRareCandyAccessible(state));
      const target = onCandyPath
        ? state.deck.find((c) => isCandy(state, c)) ?? usefulSearchItemInDeck(state, line)
        : usefulSearchItemInDeck(state, line);
      if (target) {
        moveDeckCardToHand(state, target);
        log.push(`T${state.turn}: ${label} → ${target.name}`);
      }
      break;
    }
    case "search-supporter": {
      const sup = state.deck.find((c) => {
        const r = ruleFor(state, c);
        return r?.source === "supporter" && (r.cap.type === "draw" || r.cap.type === "draw-to" || r.cap.type === "search-pokemon" || r.cap.type === "search-line");
      });
      if (sup) {
        moveDeckCardToHand(state, sup);
        log.push(`T${state.turn}: ${label} → ${sup.name}`);
      }
      break;
    }
    case "draw": {
      if (cap.shuffleHand) shuffleHandIntoDeck(state, rng);
      drawN(state, cap.amount);
      log.push(`T${state.turn}: ${label} (draw ${cap.amount})`);
      break;
    }
    case "draw-to": {
      drawN(state, Math.max(0, cap.size - state.hand.length));
      log.push(`T${state.turn}: ${label} (draw to ${cap.size})`);
      break;
    }
  }
}

// --- Turn phases -------------------------------------------------------------

export function benchLineBasic(state: GameState, line: EvolutionLine, log: string[]): void {
  if (!line.basicName) return;
  if (bestOnPathSlot(state, line)) return;
  const basic = state.hand.find((c) => c.name === line.basicName);
  if (basic) {
    removeFromHand(state, basic);
    state.bench.push({ name: basic.name, enteredTurn: state.turn });
    log.push(`T${state.turn}: bench ${basic.name}`);
  }
}

/** Push a Pokémon onto the bench and fire its on-bench ability (Meowth-style). */
function pushBench(state: GameState, name: string, rng: Rng, log: string[], suffix = ""): BenchSlot {
  const slot: BenchSlot = { name, enteredTurn: state.turn };
  state.bench.push(slot);
  log.push(`T${state.turn}: bench ${name}${suffix}`);
  const ar = abilityRuleByName(state, name);
  if (ar?.trigger === "on-bench" && state.target) applyAbility(state, state.target, slot, ar, rng, log);
  return slot;
}

/** A deck Basic the bot wants benched for an engine line or partner (target already handled). */
function engineBenchTargetInDeck(state: GameState, maxHp?: number, energyType?: string): SimCard | undefined {
  for (const line of state.engineLines ?? []) {
    if (!line.basicName || bestOnPathSlot(state, line)) continue;
    const t = state.deck.find((c) => c.name === line.basicName && cardMatchesRestrict(c, "basic", maxHp, energyType));
    if (t) return t;
  }
  for (const name of state.enginePartners ?? []) {
    if (state.bench.some((s) => s.name.toLowerCase() === name)) continue;
    const t = state.deck.find((c) => c.name.toLowerCase() === name && cardMatchesRestrict(c, "basic", maxHp, energyType));
    if (t) return t;
  }
  return undefined;
}

/** Set up the bot's ability engines: bench + evolve each engine line, bench partners. */
function advanceEngines(state: GameState, rng: Rng, log: string[]): void {
  for (const line of state.engineLines ?? []) {
    if (state.bench.length < MAX_BENCH && line.basicName && !bestOnPathSlot(state, line)) {
      const basic = state.hand.find((c) => c.name === line.basicName);
      if (basic) {
        removeFromHand(state, basic);
        pushBench(state, basic.name, rng, log, " (engine)");
      }
    }
    doEvolutions(state, line, log); // evolve toward the ability bearer (Bibarel, Delphox, …)
  }
  for (const name of state.enginePartners ?? []) {
    if (state.bench.length >= MAX_BENCH) break;
    if (state.bench.some((s) => s.name.toLowerCase() === name)) continue;
    const card = state.hand.find((c) => c.name.toLowerCase() === name && normStage(c.stage) === "Basic");
    if (card) {
      removeFromHand(state, card);
      pushBench(state, card.name, rng, log, " (partner)");
    }
  }
}

function abilityUsefulNow(state: GameState, line: EvolutionLine, ar: AbilityRule): boolean {
  const need = nextNeededPiece(state, line);
  const c = ar.cap;
  switch (c.type) {
    case "draw":
    case "draw-to":
      return need.kind !== "done";
    case "search-pokemon":
      return need.kind !== "done" && !handHasName(state, need.name) && !!deckFetchTarget(state, need.name, c.restrict, c.maxHp, c.energyType);
    case "search-line":
      return need.kind !== "done";
    case "search-supporter":
      return !state.supporterUsed && deckHasUsefulSupporter(state);
    default:
      return false;
  }
}

/** Apply a Pokémon's ability (conditions permitting). Returns whether it fired. */
function applyAbility(state: GameState, line: EvolutionLine, slot: BenchSlot, ar: AbilityRule, rng: Rng, log: string[]): boolean {
  if (ar.requiresInPlay && !state.bench.some((s) => s.name.toLowerCase() === ar.requiresInPlay)) return false;
  if (ar.requiresEnergy) {
    const energy = state.hand.find((c) => c.category === "Energy");
    if (!energy) return false;
    discardFromHand(state, energy);
  }
  runCapability(state, line, ar.cap, rng, log, `${slot.name} ability`);
  slot.abilityUsedTurn = state.turn;
  return true;
}

/** Use in-play once-per-turn abilities. mode "draw" only draws; "any" also runs searches. */
function useAbilities(state: GameState, line: EvolutionLine, mode: "draw" | "any", rng: Rng, log: string[]): void {
  for (const slot of state.bench) {
    const ar = abilityRuleByName(state, slot.name);
    if (!ar || ar.trigger !== "active-turn" || slot.abilityUsedTurn === state.turn) continue;
    const isDraw = ar.cap.type === "draw" || ar.cap.type === "draw-to";
    if (mode === "draw" && !isDraw) continue;
    if (!abilityUsefulNow(state, line, ar)) continue;
    applyAbility(state, line, slot, ar, rng, log);
  }
}

/** Play the single most useful Supporter in hand (one per turn). */
function playSupporter(state: GameState, line: EvolutionLine, rng: Rng, log: string[]): void {
  if (state.supporterUsed) return;
  let best: { card: SimCard; rule: SetupRule; score: number } | null = null;
  for (const card of state.hand) {
    const rule = ruleFor(state, card);
    if (!rule || rule.source !== "supporter") continue;
    const score = ruleScore(state, line, card, rule);
    if (score > 0 && (!best || score > best.score)) best = { card, rule, score };
  }
  if (best) applyRule(state, line, best.card, best.rule, rng, log);
}

/** Play useful Items (no per-turn limit) until none helps. */
function playItems(state: GameState, line: EvolutionLine, rng: Rng, log: string[]): void {
  for (let guard = 0; guard < 12; guard++) {
    let best: { card: SimCard; rule: SetupRule; score: number } | null = null;
    for (const card of state.hand) {
      const rule = ruleFor(state, card);
      if (!rule || rule.source !== "item") continue;
      const score = ruleScore(state, line, card, rule);
      if (score > 0 && (!best || score > best.score)) best = { card, rule, score };
    }
    if (!best) break;
    applyRule(state, line, best.card, best.rule, rng, log);
  }
}

export function doEvolutions(state: GameState, line: EvolutionLine, log: string[]): void {
  if (state.turn <= 1) return;
  const slot = bestOnPathSlot(state, line);
  if (!slot) return;
  if (slot.name === line.finalName) return;
  if (state.turn <= slot.enteredTurn) return;

  if (slot.name === line.basicName) {
    const candy = state.hand.find((c) => isCandy(state, c));
    const finalCard = state.hand.find((c) => c.name === line.finalName);
    if (line.finalStage === "Stage2" && candy && finalCard) {
      discardFromHand(state, candy);
      removeFromHand(state, finalCard);
      slot.name = line.finalName;
      slot.enteredTurn = state.turn;
      log.push(`T${state.turn}: Rare Candy → ${line.finalName}`);
      return;
    }
    if (line.stage1Name && handHasName(state, line.stage1Name)) {
      const s1 = state.hand.find((c) => c.name === line.stage1Name)!;
      removeFromHand(state, s1);
      slot.name = line.stage1Name;
      slot.enteredTurn = state.turn;
      log.push(`T${state.turn}: evolve → ${line.stage1Name}`);
      return;
    }
    if (line.finalStage === "Stage1" && finalCard) {
      removeFromHand(state, finalCard);
      slot.name = line.finalName;
      slot.enteredTurn = state.turn;
      log.push(`T${state.turn}: evolve → ${line.finalName}`);
      return;
    }
  } else if (line.stage1Name && slot.name === line.stage1Name) {
    const finalCard = state.hand.find((c) => c.name === line.finalName);
    if (finalCard) {
      removeFromHand(state, finalCard);
      slot.name = line.finalName;
      slot.enteredTurn = state.turn;
      log.push(`T${state.turn}: evolve → ${line.finalName}`);
    }
  }
}

// --- One game ----------------------------------------------------------------

export interface GameOutcome {
  setupTurn: number | null;
  wasMulligan: boolean;
  log: string[];
}

/** Precomputed-once-per-run context, so we don't re-classify the deck every game. */
export interface SimContext {
  rules: Map<string, SetupRule | null>;
  abilityRules: Map<string, AbilityRule | null>;
  engineSpec: EngineSpec;
}

export function buildSimContext(deck: SimCard[], target: EvolutionLine): SimContext {
  const rules = buildRuleMap(deck);
  const abilityRules = buildAbilityMap(deck);
  return { rules, abilityRules, engineSpec: selectEngines(deck, target, abilityRules) };
}

export function simulateOneGame(
  fullDeck: SimCard[],
  line: EvolutionLine,
  rng: Rng,
  maxTurns: number,
  order: PlayOrder,
  maxMulligans: number = DEFAULT_MAX_MULLIGANS,
  ctx?: SimContext,
): GameOutcome {
  const log: string[] = [];
  const { rules, abilityRules, engineSpec } = ctx ?? buildSimContext(fullDeck, line);

  let library = shuffle(fullDeck, rng);
  let hand = library.slice(0, HAND_SIZE);
  library = library.slice(HAND_SIZE);
  const wasMulligan = isMulliganHand(hand);

  let mull = 0;
  while (isMulliganHand(hand) && mull < maxMulligans) {
    mull++;
    library = shuffle(fullDeck, rng);
    hand = library.slice(0, HAND_SIZE);
    library = library.slice(HAND_SIZE);
  }
  if (isMulliganHand(hand)) return { setupTurn: null, wasMulligan, log };

  const prizeCount = Math.min(PRIZE_COUNT, library.length);
  library = library.slice(0, library.length - prizeCount);

  const state: GameState = {
    hand,
    deck: library,
    discard: [],
    bench: [],
    turn: 0,
    order,
    supporterUsed: false,
    rules,
    abilityRules,
    target: line,
    engineLines: engineSpec.engineLines,
    enginePartners: engineSpec.enginePartners,
  };

  for (let t = 1; t <= maxTurns; t++) {
    state.turn = t;
    state.supporterUsed = false;
    drawN(state, t === 1 && order === "first" ? 0 : 1);
    benchLineBasic(state, line, log); // bench the target basic early so search can target evolution pieces
    advanceEngines(state, rng, log); // bench + evolve ability engines (Genesect, Bibarel, Lunatone+Solrock…)
    useAbilities(state, line, "draw", rng, log); // dig with draw abilities
    playSupporter(state, line, rng, log);
    playItems(state, line, rng, log);
    advanceEngines(state, rng, log); // engines drawn this turn
    useAbilities(state, line, "any", rng, log); // search abilities grab the needed piece
    doEvolutions(state, line, log);
    benchLineBasic(state, line, log); // bench anything searched up this turn
    if (successReached(state, line)) return { setupTurn: t, wasMulligan, log };
  }
  return { setupTurn: null, wasMulligan, log };
}

// --- Aggregate ---------------------------------------------------------------

function computeUnsatisfiable(deck: SimCard[], line: EvolutionLine): boolean {
  if (!line.basicName || line.basicCopies === 0) return true;
  if (line.finalStage !== "Basic" && line.finalCopies === 0) return true;
  if (line.finalStage === "Stage2" && line.stage1Copies === 0) {
    const rules = buildRuleMap(deck);
    const hasCandy = deck.some((c) => rules.get(c.name)?.cap.type === "rare-candy");
    if (!hasCandy) return true;
  }
  return false;
}

export function runSetupSim(opts: SetupSimOptions): SetupSimResult {
  const iterations = opts.iterations ?? DEFAULT_SETUP_ITERATIONS;
  const maxTurns = opts.maxTurns ?? DEFAULT_SETUP_TURNS;
  const order = opts.order ?? "first";
  const rng = opts.rng ?? Math.random;
  const maxMulligans = opts.maxMulligans ?? DEFAULT_MAX_MULLIGANS;
  const deck = opts.deck;
  const line = opts.line;
  const deckSize = deck.length;

  const perTurnCounts = new Array<number>(maxTurns).fill(0);
  let never = 0;
  let mulligans = 0;
  let successSum = 0;
  let successN = 0;

  if (deckSize > 0) {
    const ctx = buildSimContext(deck, line); // classify the deck + pick engine lines once
    for (let i = 0; i < iterations; i++) {
      const { setupTurn, wasMulligan } = simulateOneGame(deck, line, rng, maxTurns, order, maxMulligans, ctx);
      if (wasMulligan) mulligans++;
      if (setupTurn === null) never++;
      else {
        perTurnCounts[setupTurn - 1]++;
        successSum += setupTurn;
        successN++;
      }
    }
  }

  const n = deckSize > 0 ? iterations : 1;
  const perTurnSetup = perTurnCounts.map((c) => c / n);
  const cumulativeSetup: number[] = [];
  let running = 0;
  for (const p of perTurnSetup) {
    running += p;
    cumulativeSetup.push(running);
  }

  return {
    iterations: deckSize > 0 ? iterations : 0,
    deckSize,
    order,
    maxTurns,
    lineId: line.id,
    lineLabel: line.label,
    perTurnSetup,
    cumulativeSetup,
    avgSetupTurn: successN > 0 ? successSum / successN : 0,
    neverSetUpRate: deckSize > 0 ? never / iterations : 1,
    mulliganRate: deckSize > 0 ? mulligans / iterations : 0,
    unsatisfiable: computeUnsatisfiable(deck, line),
  };
}
