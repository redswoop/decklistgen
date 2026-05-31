import type { Card } from "../types/card.js";

/**
 * Build a deck's evolution lines (Basic → Stage 1 → Stage 2) for the setup
 * simulator. Pure — no Vue, no network.
 *
 * Each input card carries `chain`: the ordered list of card *names* from the
 * base Basic up to that card, resolved upstream (server-side) from TCGdex
 * `evolveFrom` data. We work entirely in names, so the chain stays correct even
 * for Rare-Candy lines where the deck omits the middle Stage 1 (the chain still
 * names the Stage 1, we just notice it's absent from the deck).
 */

export type NormStage = "Basic" | "Stage1" | "Stage2";

/** A `Card` plus its resolved evolution chain (basic→self, by name) and rules text. */
export interface SimCard extends Card {
  chain?: string[];
  /** Trainer rules text / Special Energy text, for effect-based rule inference. */
  effect?: string;
  /** Pokémon ability text. */
  abilities?: Array<{ name: string; effect: string }>;
}

export interface EvolutionLine {
  /** Stable key = final card name. */
  id: string;
  /** Display label, e.g. "Charizard ex (Stage 2)". */
  label: string;
  finalStage: NormStage;
  /** Final card is an ex / V / VMAX / VSTAR. */
  isExLine: boolean;
  finalName: string;
  /** Representative final-stage card (for image / flags). */
  finalCard: Card;
  /** Name of the line's Basic, or null when unresolved (missing chain data). */
  basicName: string | null;
  /** Stage 1 name *if that Stage 1 is present in the deck*, else null. */
  stage1Name: string | null;
  basicCopies: number;
  stage1Copies: number;
  finalCopies: number;
  /** Stage 2 line whose Stage 1 is absent from the deck — only Rare Candy bridges it. */
  requiresRareCandy: boolean;
  warnings: LineWarning[];
}

export interface LineWarning {
  kind: "missing-evolve-from" | "broken-chain" | "no-basic";
  cardName: string;
  detail: string;
}

export interface EvolutionAnalysis {
  lines: EvolutionLine[];
  warnings: LineWarning[];
}

interface Node {
  name: string;
  stage: NormStage;
  copies: number;
  cardIds: string[];
  chain: string[];
  card: Card;
}

/** Normalize TCGdex stage strings into the three line stages. */
export function normStage(stage?: string): NormStage {
  const s = (stage ?? "").toLowerCase();
  if (s === "stage2") return "Stage2";
  // VMAX / VSTAR evolve from a V (a Basic), so they behave like a Stage 1 step.
  if (s === "stage1" || s === "vmax" || s === "vstar") return "Stage1";
  return "Basic";
}

function stageLabel(stage: NormStage): string {
  return stage === "Stage1" ? "Stage 1" : stage === "Stage2" ? "Stage 2" : "Basic";
}

function isExLikeCard(c: Card): boolean {
  return c.isEx || c.isV || c.isVmax || c.isVstar;
}

/** Build evolution lines from a flattened deck (one entry per physical card). */
export function buildEvolutionLines(cards: SimCard[]): EvolutionAnalysis {
  // Group Pokémon by name.
  const byName = new Map<string, Node>();
  for (const c of cards) {
    if (c.category !== "Pokemon") continue;
    const existing = byName.get(c.name);
    if (existing) {
      existing.copies++;
      existing.cardIds.push(c.id);
      // Keep the longest resolved chain (printings should agree).
      if ((c.chain?.length ?? 0) > existing.chain.length) existing.chain = c.chain ?? existing.chain;
    } else {
      byName.set(c.name, {
        name: c.name,
        stage: normStage(c.stage),
        copies: 1,
        cardIds: [c.id],
        chain: c.chain && c.chain.length > 0 ? c.chain : [c.name],
        card: c,
      });
    }
  }

  // A name is "consumed" if it is an ancestor (non-final entry) of some node's chain.
  const consumed = new Set<string>();
  for (const node of byName.values()) {
    for (let i = 0; i < node.chain.length - 1; i++) consumed.add(node.chain[i]);
  }

  const lines: EvolutionLine[] = [];
  const deckWarnings: LineWarning[] = [];

  for (const node of byName.values()) {
    if (consumed.has(node.name)) continue; // not a final node

    const warnings: LineWarning[] = [];
    const chain = node.chain;
    const finalStage = node.stage;

    let basicName: string | null;
    let stage1Name: string | null = null;

    if (finalStage === "Basic") {
      basicName = node.name;
    } else {
      // Need a resolved chain down to a Basic.
      basicName = chain.length > 1 ? chain[0] : null;
      if (basicName === null) {
        warnings.push({
          kind: "missing-evolve-from",
          cardName: node.name,
          detail: `Couldn't resolve what ${node.name} evolves from; its Basic is unknown.`,
        });
      }
      // Stage 1 step (only meaningful for Stage 2 lines, and only if in the deck).
      if (finalStage === "Stage2") {
        const candidate = chain.length >= 2 ? chain[chain.length - 2] : null;
        if (candidate && byName.has(candidate)) stage1Name = candidate;
      } else {
        // finalStage === "Stage1": the final card IS the Stage 1.
        stage1Name = node.name;
      }
    }

    const basicCopies = basicName ? byName.get(basicName)?.copies ?? 0 : 0;
    const stage1Copies =
      stage1Name && stage1Name !== node.name ? byName.get(stage1Name)?.copies ?? 0 : finalStage === "Stage1" ? node.copies : 0;
    const finalCopies = node.copies;

    if (finalStage !== "Basic" && basicName && basicCopies === 0) {
      warnings.push({
        kind: "no-basic",
        cardName: node.name,
        detail: `${node.name} needs ${basicName} in play, but no ${basicName} is in the deck.`,
      });
    }

    const requiresRareCandy = finalStage === "Stage2" && stage1Copies === 0;

    const line: EvolutionLine = {
      id: node.name,
      label: `${node.name} (${stageLabel(finalStage)})`,
      finalStage,
      isExLine: isExLikeCard(node.card),
      finalName: node.name,
      finalCard: node.card,
      basicName,
      stage1Name: stage1Name && stage1Name !== node.name ? stage1Name : null,
      basicCopies,
      stage1Copies,
      finalCopies,
      requiresRareCandy,
      warnings,
    };
    lines.push(line);
    deckWarnings.push(...warnings);
  }

  lines.sort((a, b) => lineScore(b) - lineScore(a) || lineCopies(b) - lineCopies(a) || a.finalName.localeCompare(b.finalName));

  return { lines, warnings: deckWarnings };
}

function lineCopies(l: EvolutionLine): number {
  return l.basicCopies + l.stage1Copies + l.finalCopies;
}

/** Priority score: Stage2-ex > Stage2 > Basic-ex/V > Stage1 > plain Basic. */
function lineScore(l: EvolutionLine): number {
  let s = l.finalStage === "Stage2" ? 300 : l.finalStage === "Stage1" ? 150 : l.isExLine ? 200 : 10;
  if (l.isExLine) s += 50;
  return s;
}

/** The deck's likely key attacker line(s): top scorers, up to 3. */
export function pickAutoTargets(analysis: EvolutionAnalysis): EvolutionLine[] {
  return analysis.lines.slice(0, 3);
}
