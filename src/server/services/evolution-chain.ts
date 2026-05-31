import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getCard, findCardByName } from "./card-store.js";
import { ensureCardLoaded } from "./card-detail.js";
import { fetchCardEvolveFromByName } from "./tcgdex.js";

/**
 * Resolve a card's full evolution chain (basic → final) by NAME, for the setup
 * simulator. Works in names so it stays correct for Rare-Candy lines that omit
 * the middle Stage 1.
 *
 * Some sets ship with no `evolveFrom` data at all (e.g. the Mega Evolution set
 * me02.5 — Totodile/Croconaw/Mega Feraligatr ex are all null). We recover three
 * ways, cheapest first:
 *   1. the card's own cached `evolveFrom`,
 *   2. any *other cached printing* of the same name (a name→evolveFrom index
 *      built once from the cache dir),
 *   3. a cached TCGdex name lookup (network, last resort).
 * Mega Pokémon ("Mega X ex") carry no `evolveFrom`, but per the card text they
 * are "the mega evolved form of X", so their pre-evolution is X's pre-evolution.
 */

const CACHE_DIR = join(import.meta.dir, "../../../cache");

interface CachedCardFields {
  evolveFrom?: string;
  effect?: string;
  abilities?: Array<{ name?: string; effect?: string }>;
}

function readCachedCard(cardId: string): CachedCardFields {
  const p = join(CACHE_DIR, `${cardId}.json`);
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as CachedCardFields;
  } catch {
    return {};
  }
}

/** Read `evolveFrom` straight from a card's cached TCGdex JSON (no network). */
export function getCardEvolveFrom(cardId: string): string | undefined {
  return readCachedCard(cardId).evolveFrom ?? undefined;
}

// Lazy, memoized name→evolveFrom index over every cached card JSON. ~160ms for
// ~9k files, built once on first need. Lets us recover evolution data for a set
// that lacks it from any other cached printing of the same species.
let _index: Map<string, string> | null = null;
function evolveFromIndex(): Map<string, string> {
  if (_index) return _index;
  const idx = new Map<string, string>();
  try {
    for (const f of readdirSync(CACHE_DIR)) {
      if (!f.endsWith(".json")) continue;
      try {
        const d = JSON.parse(readFileSync(join(CACHE_DIR, f), "utf-8")) as { name?: string; evolveFrom?: string };
        if (typeof d.name === "string" && typeof d.evolveFrom === "string" && d.evolveFrom) {
          const k = d.name.toLowerCase();
          if (!idx.has(k)) idx.set(k, d.evolveFrom);
        }
      } catch {}
    }
  } catch {}
  _index = idx;
  return idx;
}

/**
 * Strip a Mega name to its base species:
 *   "Mega Feraligatr ex"   → "Feraligatr"
 *   "Mega Charizard X ex"  → "Charizard"   (X/Y is the Mega variant tag, not the species)
 */
export function megaBaseSpecies(name: string): string | null {
  const m = name.match(/^mega\s+(.+?)(?:\s+[a-z])?(?:\s+ex)?$/i);
  return m ? m[1].trim() : null;
}

/**
 * Walk `evolveFrom` links downward into an ordered list of names (basic → start).
 * Pure: `lookupEvolveFrom` is injected so this is unit-testable offline.
 */
export async function resolveChainNames(
  startName: string,
  startEvolveFrom: string | undefined,
  lookupEvolveFrom: (name: string) => Promise<string | undefined>,
  maxDepth = 4,
): Promise<string[]> {
  const names = [startName];
  const seen = new Set([startName.toLowerCase()]);
  let ef = startEvolveFrom;
  let depth = 0;
  while (ef && depth < maxDepth) {
    if (seen.has(ef.toLowerCase())) break; // cycle guard
    names.unshift(ef);
    seen.add(ef.toLowerCase());
    ef = await lookupEvolveFrom(ef);
    depth++;
  }
  return names;
}

/** Resolve a name's `evolveFrom`: loaded printing → cache index → TCGdex bridge. */
export async function lookupEvolveFromByName(name: string): Promise<string | undefined> {
  const loaded = findCardByName(name);
  if (loaded) {
    const ef = getCardEvolveFrom(loaded.id);
    if (ef) return ef;
  }
  const indexed = evolveFromIndex().get(name.toLowerCase());
  if (indexed) return indexed;
  try {
    return await fetchCardEvolveFromByName(name);
  } catch {
    return undefined; // network unavailable → chain stops gracefully
  }
}

/**
 * The `evolveFrom` to start a chain from when a card's own JSON has none.
 * Tries another printing of the same name, then (for Mega cards) the base
 * species' pre-evolution.
 */
async function deriveStartEvolveFrom(name: string): Promise<string | undefined> {
  const own = evolveFromIndex().get(name.toLowerCase());
  if (own) return own;
  const species = megaBaseSpecies(name);
  if (species) return lookupEvolveFromByName(species);
  return undefined;
}

export interface EvolutionInfo {
  id: string;
  stage: string | null;
  /** Ordered names basic → this card. */
  chain: string[];
  /** Trainer rules text / Special Energy text (for the setup sim's rule inference). */
  effect?: string;
  /** Pokémon ability text. */
  abilities?: Array<{ name: string; effect: string }>;
}

export async function resolveEvolutionInfo(cardId: string): Promise<EvolutionInfo | null> {
  await ensureCardLoaded(cardId);
  const card = getCard(cardId);
  if (!card) return null;

  const cached = readCachedCard(cardId);
  let start = cached.evolveFrom ?? undefined;
  const stage = (card.stage ?? "").toLowerCase();
  if (!start && (stage === "stage1" || stage === "stage2")) {
    start = await deriveStartEvolveFrom(card.name);
  }
  const chain = await resolveChainNames(card.name, start, lookupEvolveFromByName);
  const abilities = (cached.abilities ?? [])
    .map((a) => ({ name: a.name ?? "", effect: a.effect ?? "" }))
    .filter((a) => a.effect);
  return {
    id: cardId,
    stage: card.stage ?? null,
    chain,
    effect: cached.effect ?? undefined,
    abilities: abilities.length ? abilities : undefined,
  };
}
