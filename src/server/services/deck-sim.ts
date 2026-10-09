import type { Card } from "../../shared/types/card.js";
import type { DeckCard } from "../../shared/types/deck.js";
import { resolveEvolutionInfo } from "./evolution-chain.js";
import { buildEvolutionLines, type SimCard, type EvolutionLine, type LineWarning } from "../../shared/utils/evolution-lines.js";
import { runSetupSim, unsatisfiableReason, type SetupSimResult } from "../../shared/utils/setup-sim.js";
import { runMonteCarlo, makeRng, type PlayOrder, type SimResult } from "../../shared/utils/hand-sim.js";

/**
 * Server-side driver for the two deck simulators (the client runs the same
 * pure engines in the browser via useSetupSim / useTestHandStats). Used by the
 * MCP tools so a remote Claude can run the numbers and talk about them.
 *
 * Every result carries an `interpretation`: plain-language sentences derived
 * from the stats, so the caller doesn't have to re-derive what "cumulative
 * setup 0.62 ± 0.015 at T3" means.
 */

/** Flatten deck entries to one Card per physical copy. Classification uses `.card`, never `.artCard`. */
export function flattenDeck(cards: DeckCard[]): Card[] {
  return cards.filter((e) => e.count > 0).flatMap((e) => Array<Card>(e.count).fill(e.card));
}

/** Attach evolution chains + rules text (what GET /cards/evolutions returns) to a flattened deck. */
export async function buildSimDeck(cards: DeckCard[]): Promise<SimCard[]> {
  const flat = flattenDeck(cards);
  const ids = new Set<string>();
  for (const c of flat) if (c.category !== "Energy") ids.add(c.id);
  const infos = new Map<string, Awaited<ReturnType<typeof resolveEvolutionInfo>>>();
  for (const id of ids) infos.set(id, await resolveEvolutionInfo(id));
  return flat.map((c) => {
    const info = infos.get(c.id);
    if (!info) return { ...c };
    return { ...c, chain: info.chain, effect: info.effect, abilities: info.abilities };
  });
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const pctPm = (x: number, ci: number) => `${pct(x)} ±${(ci * 100).toFixed(ci * 100 < 1 ? 1 : 0)}%`;

// --- Opening hands -----------------------------------------------------------

export interface HandSimReport {
  stats: SimResult;
  interpretation: string[];
}

export function runDeckHandSim(cards: DeckCard[], opts: { order: PlayOrder; iterations?: number; turns?: number; seed?: number }): HandSimReport {
  const deck = flattenDeck(cards);
  const stats = runMonteCarlo({
    deck,
    order: opts.order,
    iterations: opts.iterations,
    turns: opts.turns,
    rng: opts.seed !== undefined ? makeRng(opts.seed) : undefined,
  });
  return { stats, interpretation: interpretHandSim(stats) };
}

export function interpretHandSim(s: SimResult): string[] {
  const out: string[] = [];
  if (s.deckSize === 0) return ["The deck is empty — nothing to simulate."];
  if (s.deckSize !== 60) out.push(`Simulated with ${s.deckSize} cards; a legal deck is 60, so these odds will shift as the list fills out.`);
  if (s.infiniteMulligan) {
    out.push("The deck has no Basic Pokémon, so every opening hand is a mulligan. It cannot be played as-is.");
    return out;
  }
  const basics = s.byCategory["Basic Pokémon"] ?? s.byCategory["Basic"];
  out.push(
    `Mulligan rate is ${pct(s.mulliganRate)} (${pct(s.oddsBasic)} of openers contain a Basic). ` +
      (s.mulliganRate > 0.15
        ? "That's high — most competitive lists sit under ~12%; add Basics or accept giving the opponent free cards."
        : s.mulliganRate > 0.1
          ? "That's on the high side of normal."
          : "That's a healthy Basic count."),
  );
  out.push(
    `${pct(s.oddsBasicAndSupporter)} of openers have both a Basic and a Supporter; ${pct(s.noSupporterOrItemRate)} of kept hands have neither a Supporter nor an Item ` +
      (s.noSupporterOrItemRate > 0.2 ? "(a lot of dead-ish starts — the Trainer count is thin)." : "(ignores Stadiums/Tools, so it slightly overstates dead hands)."),
  );
  if (basics && basics.length) {
    out.push(`By turn ${basics.length}, the chance of having seen at least one Basic is ${pct(basics[basics.length - 1])}.`);
  }
  const weak = s.byCard.filter((c) => c.copies >= 2 && c.byTurn[Math.min(1, c.byTurn.length - 1)] < 0.35);
  if (weak.length) {
    out.push(
      `Low early-access cards (under 35% to see by turn 2 despite 2+ copies): ${weak
        .slice(0, 5)
        .map((c) => `${c.name} (${c.copies}x, ${pct(c.byTurn[Math.min(1, c.byTurn.length - 1)])})`)
        .join(", ")}. Search/draw cards, not raw copies, are usually the fix.`,
    );
  }
  out.push("Per-card 'by turn N' odds are closed-form hypergeometric from a fresh shuffle; they do not account for draw/search effects, so a real engine deck will beat them.");
  return out;
}

// --- Setup ---------------------------------------------------------------------

export interface SetupLineReport {
  line: {
    id: string;
    label: string;
    finalStage: EvolutionLine["finalStage"];
    isExLine: boolean;
    finalName: string;
    basicName: string | null;
    stage1Name: string | null;
    basicCopies: number;
    stage1Copies: number;
    finalCopies: number;
    requiresRareCandy: boolean;
    warnings: LineWarning[];
  };
  result: SetupSimResult;
  cantReason: string | null;
  interpretation: string;
}

export interface SetupSimReport {
  deckSize: number;
  order: PlayOrder;
  turns: number;
  warnings: LineWarning[];
  lines: SetupLineReport[];
  interpretation: string[];
}

export async function runDeckSetupSim(
  cards: DeckCard[],
  opts: { order: PlayOrder; seed?: number; iterations?: number; turns?: number; lineIds?: string[] },
): Promise<SetupSimReport> {
  const deck = await buildSimDeck(cards);
  const analysis = buildEvolutionLines(deck);
  const turns = opts.turns ?? 5;
  const selected = opts.lineIds?.length
    ? analysis.lines.filter((l) => opts.lineIds!.some((id) => id.toLowerCase() === l.id.toLowerCase() || id.toLowerCase() === l.finalName.toLowerCase()))
    : analysis.lines;

  const lines: SetupLineReport[] = selected.map((line) => {
    const result = runSetupSim({
      deck,
      line,
      order: opts.order,
      maxTurns: turns,
      iterations: opts.iterations,
      rng: makeRng(opts.seed ?? 20260531),
    });
    const cantReason = unsatisfiableReason(deck, line);
    const { finalCard: _finalCard, ...rest } = line;
    return { line: rest, result, cantReason, interpretation: interpretLine(line, result, cantReason) };
  });

  return {
    deckSize: deck.length,
    order: opts.order,
    turns,
    warnings: analysis.warnings,
    lines,
    interpretation: interpretSetup(deck.length, lines, opts.order),
  };
}

function interpretLine(line: EvolutionLine, r: SetupSimResult, cantReason: string | null): string {
  if (cantReason) return `${line.finalName} can never set up: ${cantReason}.`;
  const last = r.cumulativeSetup.length - 1;
  const t2 = r.cumulativeSetup[Math.min(1, last)];
  const t3 = r.cumulativeSetup[Math.min(2, last)];
  const final = r.cumulativeSetup[last];
  const avg = r.avgSetupTurn > 0 ? `averages turn ${r.avgSetupTurn.toFixed(1)} when it does` : "";
  const parts = [
    `${line.finalName} is in play by T2 ${pctPm(t2, r.cumulativeCI[Math.min(1, last)])}, by T3 ${pctPm(t3, r.cumulativeCI[Math.min(2, last)])}, by T${last + 1} ${pctPm(final, r.cumulativeCI[last])}`,
  ];
  if (avg) parts.push(avg);
  if (r.neverSetUpRate > 0.05) parts.push(`fails to set up within ${r.maxTurns} turns ${pct(r.neverSetUpRate)} of the time`);
  if (line.requiresRareCandy) parts.push("relies entirely on Rare Candy (no Stage 1 in the deck)");
  return parts.join("; ") + ".";
}

function interpretSetup(deckSize: number, lines: SetupLineReport[], order: PlayOrder): string[] {
  const out: string[] = [];
  if (deckSize === 0) return ["The deck is empty — nothing to simulate."];
  if (deckSize !== 60) out.push(`Simulated with ${deckSize} cards; a legal deck is 60.`);
  out.push(`Going ${order === "first" ? "first" : "second"}. "Set up" means the line's final stage is in play — energy and attacking are out of scope.`);
  const live = lines.filter((l) => !l.cantReason);
  const dead = lines.filter((l) => l.cantReason);
  if (dead.length) out.push(`Broken lines: ${dead.map((l) => `${l.line.finalName} (${l.cantReason})`).join("; ")}.`);
  const key = live.filter((l) => l.line.finalStage !== "Basic" || l.line.isExLine);
  if (key.length) {
    const ranked = [...key].sort((a, b) => b.result.cumulativeSetup[2] - a.result.cumulativeSetup[2]);
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    out.push(`Fastest key line: ${best.line.finalName} at ${pct(best.result.cumulativeSetup[Math.min(2, best.result.cumulativeSetup.length - 1)])} by T3.`);
    if (worst !== best) out.push(`Slowest key line: ${worst.line.finalName} at ${pct(worst.result.cumulativeSetup[Math.min(2, worst.result.cumulativeSetup.length - 1)])} by T3.`);
    const stage2 = key.filter((l) => l.line.finalStage === "Stage2");
    for (const l of stage2) {
      const t3 = l.result.cumulativeSetup[Math.min(2, l.result.cumulativeSetup.length - 1)];
      if (t3 < 0.5) out.push(`${l.line.finalName} is under 50% by T3 — a Stage 2 that slow usually wants more Rare Candy, more Basics, or more search (Ultra Ball / Nest Ball / Poffin).`);
    }
  }
  out.push("Confidence intervals are Monte-Carlo sampling error only; they don't cover model simplifications (greedy bot, no opponent, abilities limited to draw/search).");
  return out;
}
