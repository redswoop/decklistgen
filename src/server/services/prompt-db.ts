/**
 * Prompt database — maps card properties to Klein cleaning prompts.
 *
 * Loads rules from data/prompts.json. Rules are evaluated top-to-bottom,
 * first match wins. Supports matching on card ID, category, fullart status,
 * suffix (ex/V/VMAX/VSTAR), rarity, trainerType, and name substring.
 */

import { readFileSync, writeFileSync, watchFile, statSync } from "node:fs";
import { join } from "node:path";
import { isFullArt } from "../../shared/utils/detect-fullart.js";
import type { TcgdexCard } from "../../shared/types/card.js";

const PROMPTS_PATH = join(import.meta.dir, "../../../data/prompts.json");

interface MatchCriteria {
  id?: string;
  category?: string;
  isFullArt?: boolean;
  suffix?: string;
  rarity?: string;
  trainerType?: string;
  energyType?: string;
  name?: string;
}

interface PromptRule {
  name: string;
  match: MatchCriteria;
  prompt?: string;
  skip?: boolean;
}

interface PromptDb {
  rules: PromptRule[];
}

export interface PromptResult {
  ruleName: string;
  prompt: string | null; // null means skip (e.g. energy)
  skip: boolean;
}

let db: PromptDb = { rules: [] };
let lastMtime = 0;

function loadDb() {
  try {
    const raw = readFileSync(PROMPTS_PATH, "utf-8");
    db = JSON.parse(raw) as PromptDb;
    console.log(`[prompt-db] Loaded ${db.rules.length} rules from prompts.json`);
  } catch (e: any) {
    console.error(`[prompt-db] Failed to load prompts.json: ${e.message}`);
  }
}

function reloadIfChanged() {
  try {
    const mt = statSync(PROMPTS_PATH).mtimeMs;
    if (mt !== lastMtime) {
      lastMtime = mt;
      loadDb();
    }
  } catch {}
}

// Initial load
loadDb();
try {
  lastMtime = statSync(PROMPTS_PATH).mtimeMs;
} catch {}

// Watch for changes (poll every 2s)
watchFile(PROMPTS_PATH, { interval: 2000 }, () => {
  reloadIfChanged();
});

/**
 * Detect the suffix of a Pokemon card (ex, V, VMAX, VSTAR).
 */
function getSuffix(card: Record<string, unknown>): string {
  const name = (card.name as string) ?? "";
  const stage = (card.stage as string) ?? "";
  const suffix = (card.suffix as string) ?? "";

  if (stage === "VMAX") return "VMAX";
  if (stage === "VSTAR") return "VSTAR";
  if (suffix === "ex" || suffix === "EX" || name.toLowerCase().endsWith(" ex")) return "ex";
  if (suffix === "V" || (name.endsWith(" V") && !name.endsWith(" IV"))) return "V";
  if (suffix === "VMAX") return "VMAX";
  if (suffix === "VSTAR") return "VSTAR";
  return "";
}

function matchesRule(rule: PromptRule, card: Record<string, unknown>): boolean {
  const m = rule.match;

  if (m.id !== undefined) {
    if ((card.id as string) !== m.id) return false;
  }

  if (m.category !== undefined) {
    if ((card.category as string) !== m.category) return false;
  }

  if (m.isFullArt !== undefined) {
    if (isFullArt(card as unknown as TcgdexCard) !== m.isFullArt) return false;
  }

  if (m.suffix !== undefined) {
    if (getSuffix(card) !== m.suffix) return false;
  }

  if (m.rarity !== undefined) {
    const cardRarity = ((card.rarity as string) ?? "").toLowerCase();
    if (!cardRarity.includes(m.rarity.toLowerCase())) return false;
  }

  if (m.trainerType !== undefined) {
    if ((card.trainerType as string) !== m.trainerType) return false;
  }

  if (m.energyType !== undefined) {
    if ((card.energyType as string) !== m.energyType) return false;
  }

  if (m.name !== undefined) {
    const cardName = ((card.name as string) ?? "").toLowerCase();
    if (!cardName.includes(m.name.toLowerCase())) return false;
  }

  return true;
}

/**
 * Find the best prompt for a card by evaluating rules top-to-bottom.
 */
export function getPromptForCard(card: Record<string, unknown>): PromptResult {
  reloadIfChanged();

  for (const rule of db.rules) {
    if (matchesRule(rule, card)) {
      return {
        ruleName: rule.name,
        prompt: rule.skip ? null : (rule.prompt ?? null),
        skip: !!rule.skip,
      };
    }
  }

  return {
    ruleName: "no-match",
    prompt: null,
    skip: false,
  };
}

/** Get all rules (for debugging / gallery display). */
export function getAllRules(): PromptRule[] {
  reloadIfChanged();
  return db.rules;
}

/**
 * Save a card-specific prompt. Upserts a rule with match: { id: cardId }
 * at the top of the rules list (before pattern rules).
 */
export function saveCardPrompt(cardId: string, prompt: string): void {
  reloadIfChanged();

  const ruleName = `card:${cardId}`;
  const existingIdx = db.rules.findIndex((r) => r.name === ruleName);

  const rule: PromptRule = {
    name: ruleName,
    match: { id: cardId },
    prompt,
  };

  if (existingIdx >= 0) {
    db.rules[existingIdx] = rule;
  } else {
    // Insert before the first non-card-specific rule
    const insertIdx = db.rules.findIndex((r) => !r.name.startsWith("card:"));
    if (insertIdx >= 0) {
      db.rules.splice(insertIdx, 0, rule);
    } else {
      db.rules.push(rule);
    }
  }

  writeFileSync(PROMPTS_PATH, JSON.stringify(db, null, 2) + "\n");
  lastMtime = statSync(PROMPTS_PATH).mtimeMs;
}
