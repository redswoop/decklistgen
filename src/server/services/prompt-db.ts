/**
 * Prompt database — resolves the Klein prompt for a given card.
 *
 * Default: everything gets the expand prompt. Basic energy is skipped.
 * Per-card overrides are stored in data/card-prompts.json.
 */

import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const EXPAND_PROMPT =
  "Expand the illustration from the reference image into a large, detailed scene. " +
  "Remove all text, headers, and other non-illustrative elements.";

const CARD_PROMPTS_PATH = join(import.meta.dir, "../../../data/card-prompts.json");

export interface PromptResult {
  ruleName: string;
  prompt: string | null;
  skip: boolean;
}

/** Card-specific prompt overrides: { cardId: promptText } */
let overrides: Record<string, string> = {};
let lastMtime = 0;

function loadOverrides() {
  try {
    overrides = JSON.parse(readFileSync(CARD_PROMPTS_PATH, "utf-8"));
    console.log(`[prompt-db] Loaded ${Object.keys(overrides).length} card overrides`);
  } catch {
    overrides = {};
  }
}

function reloadIfChanged() {
  try {
    const mt = statSync(CARD_PROMPTS_PATH).mtimeMs;
    if (mt !== lastMtime) {
      lastMtime = mt;
      loadOverrides();
    }
  } catch {}
}

// Initial load
if (existsSync(CARD_PROMPTS_PATH)) {
  loadOverrides();
  try { lastMtime = statSync(CARD_PROMPTS_PATH).mtimeMs; } catch {}
}

/**
 * Find the prompt for a card.
 * Priority: card-specific override > energy skip > expand prompt.
 */
export function getPromptForCard(card: Record<string, unknown>): PromptResult {
  reloadIfChanged();

  const cardId = card.id as string;

  // Card-specific override
  if (cardId && overrides[cardId]) {
    return { ruleName: `card:${cardId}`, prompt: overrides[cardId], skip: false };
  }

  // Basic energy gets the same expand prompt as everything else
  // (cleaned artwork is used by the basic-energy template)

  // Everything else gets expand prompt
  return { ruleName: "default", prompt: EXPAND_PROMPT, skip: false };
}

/**
 * Save a card-specific prompt override.
 */
export function saveCardPrompt(cardId: string, prompt: string): void {
  reloadIfChanged();
  overrides[cardId] = prompt;
  writeFileSync(CARD_PROMPTS_PATH, JSON.stringify(overrides, null, 2) + "\n");
  lastMtime = statSync(CARD_PROMPTS_PATH).mtimeMs;
}

/** Get card IDs that have custom prompt overrides. */
export function getOverrideCardIds(): Set<string> {
  reloadIfChanged();
  return new Set(Object.keys(overrides));
}
