/**
 * Customized cards aggregation service.
 *
 * Scans cache/ for clean images, card-settings.json for proxy settings,
 * and prompt-db.ts for card-specific overrides. Unions all three sets
 * and returns enriched card data with staleness detection and deck membership.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getAllCardSettings, getCardSettings } from "./card-settings.js";
import { getPromptForCard, getOverrideCardIds } from "./prompt-db.js";
import { listDecks, getDeck } from "./deck-store.js";
import { getCard, loadSet, isSetLoaded } from "./card-store.js";
import { REVERSE_SET_MAP } from "../../shared/constants/set-codes.js";
import type { Card } from "../../shared/types/card.js";
import type {
  CustomizedCard,
  CustomizedCardsResponse,
  CleanMeta,
  DeckMembership,
} from "../../shared/types/customized-card.js";

const CACHE_DIR = join(import.meta.dir, "../../../cache");

function cachePath(cardId: string, suffix: string): string {
  return join(CACHE_DIR, `${cardId}${suffix}`);
}

/** Load card data from cache JSON or card store (same logic as proxy.ts). */
function loadCardData(cardId: string): Record<string, unknown> | null {
  const jsonPath = cachePath(cardId, ".json");
  if (existsSync(jsonPath)) {
    try {
      return JSON.parse(readFileSync(jsonPath, "utf-8"));
    } catch {}
  }
  const card = getCard(cardId);
  if (!card) return null;
  return {
    id: card.id,
    localId: card.localId,
    name: card.name,
    category: card.category,
    hp: card.hp,
    types: card.energyTypes,
    stage: card.stage,
    retreat: card.retreat,
    rarity: card.rarity,
    trainerType: card.trainerType,
    set: { name: card.setName, id: card.setId },
  };
}

/** Convert card-store Card to the shared Card type for API responses. */
function storeCardToCard(sc: ReturnType<typeof getCard>): Card | null {
  if (!sc) return null;
  return sc;
}

/** Try to load a card's set if not already loaded. */
async function ensureCardLoaded(cardId: string): Promise<void> {
  if (getCard(cardId)) return;
  const setId = cardId.replace(/-[^-]+$/, "");
  const setCode = REVERSE_SET_MAP[setId];
  if (setCode && !isSetLoaded(setCode)) {
    await loadSet(setCode);
  }
}

// Simple TTL cache
let cachedResult: CustomizedCardsResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30_000; // 30 seconds

export function invalidateCustomizedCardsCache(): void {
  cachedResult = null;
  cacheTimestamp = 0;
}

export async function getCustomizedCards(userId?: string): Promise<CustomizedCardsResponse> {
  const now = Date.now();
  if (cachedResult && now - cacheTimestamp < CACHE_TTL) {
    return cachedResult;
  }

  // 1. Scan cache/ for *_clean.png
  const cleanCardIds = new Set<string>();
  try {
    const files = readdirSync(CACHE_DIR);
    for (const file of files) {
      if (file.endsWith("_clean.png")) {
        cleanCardIds.add(file.replace("_clean.png", ""));
      }
    }
  } catch {}

  // 2. Get all card settings (user-scoped if userId provided)
  const allSettings = userId ? getAllCardSettings(userId) : {};
  const settingsCardIds = new Set(Object.keys(allSettings));

  // 3. Get card-specific prompt overrides
  const overrideCardIds = getOverrideCardIds();

  // 4. Union all three sets
  const allCardIds = new Set([...cleanCardIds, ...settingsCardIds, ...overrideCardIds]);

  // 5. Load deck membership data (user-scoped if userId provided)
  const deckMembershipMap = new Map<string, DeckMembership[]>();
  if (userId) {
    try {
      const deckSummaries = await listDecks(userId);
      for (const summary of deckSummaries) {
        const deck = await getDeck(summary.id, userId);
        if (!deck) continue;
        for (const dc of deck.cards) {
          const cardId = dc.card.id;
          if (!deckMembershipMap.has(cardId)) {
            deckMembershipMap.set(cardId, []);
          }
          deckMembershipMap.get(cardId)!.push({
            deckId: deck.id,
            deckName: deck.name,
            count: dc.count,
          });
        }
      }
    } catch {}
  }

  // 6. Build result for each card
  const cards: CustomizedCard[] = [];
  let totalClean = 0;
  let totalSettings = 0;
  let totalStale = 0;

  for (const cardId of allCardIds) {
    // Ensure the card's set is loaded so we can get card data
    await ensureCardLoaded(cardId);

    const card = storeCardToCard(getCard(cardId));
    if (!card) continue; // Can't resolve card data — skip

    const hasClean = cleanCardIds.has(cardId);
    const hasComposite = existsSync(cachePath(cardId, "_composite.png"));
    const hasSettings = settingsCardIds.has(cardId);
    const hasPromptOverride = overrideCardIds.has(cardId);

    // Load clean metadata
    let cleanMeta: CleanMeta | null = null;
    const metaPath = cachePath(cardId, "_clean_meta.json");
    if (existsSync(metaPath)) {
      try {
        cleanMeta = JSON.parse(readFileSync(metaPath, "utf-8"));
      } catch {}
    }

    // Compute staleness: compare current prompt/rule with what was used
    let isStale = false;
    let staleSummary: string | null = null;

    if (cleanMeta && hasClean) {
      const cardData = loadCardData(cardId);
      if (cardData) {
        const currentPrompt = getPromptForCard(cardData);
        if (currentPrompt.ruleName !== cleanMeta.rule) {
          isStale = true;
          staleSummary = `rule changed: ${cleanMeta.rule} → ${currentPrompt.ruleName}`;
        } else if (currentPrompt.prompt && currentPrompt.prompt !== cleanMeta.prompt) {
          isStale = true;
          staleSummary = `prompt text changed (rule: ${currentPrompt.ruleName})`;
        }
      }
    }

    if (hasClean) totalClean++;
    if (hasSettings) totalSettings++;
    if (isStale) totalStale++;

    cards.push({
      card,
      hasClean,
      hasComposite,
      cleanMeta,
      hasSettings,
      settings: hasSettings ? allSettings[cardId] : null,
      hasPromptOverride,
      isStale,
      staleSummary,
      deckMembership: deckMembershipMap.get(cardId) ?? [],
    });
  }

  // Sort: stale first, then by card name
  cards.sort((a, b) => {
    if (a.isStale !== b.isStale) return a.isStale ? -1 : 1;
    return a.card.name.localeCompare(b.card.name);
  });

  const result: CustomizedCardsResponse = {
    cards,
    totalClean,
    totalSettings,
    totalStale,
  };

  cachedResult = result;
  cacheTimestamp = now;

  return result;
}

/** Delete all cache artifacts for a card (clean, composite, meta, svg). */
export async function deleteCardArtifacts(cardId: string): Promise<void> {
  const { unlink } = await import("node:fs/promises");
  const suffixes = ["_clean.png", "_composite.png", "_clean_meta.json", ".svg"];
  for (const suffix of suffixes) {
    const path = cachePath(cardId, suffix);
    if (existsSync(path)) {
      try {
        await unlink(path);
      } catch {}
    }
  }
  invalidateCustomizedCardsCache();
}
