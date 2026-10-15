/**
 * Cache + card-data utilities — the parts of the old render-svg.ts that
 * outlived the SVG renderer. These back the clean-image pipeline:
 * `/api/pokeproxy/status`, `/api/pokeproxy/image`, `/api/pokeproxy/generate`.
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getCard, loadSet, isSetLoaded } from "../card-store.js";
import { REVERSE_SET_MAP } from "../../../shared/constants/set-codes.js";
import { cardImageUrl } from "../../../shared/utils/card-image-url.js";
import { getCustomArtPath, getCustomCardRaw } from "../custom-sets.js";

const CACHE_DIR = join(import.meta.dir, "../../../../cache");

export function cachePath(cardId: string, suffix: string): string {
  return join(CACHE_DIR, `${cardId}${suffix}`);
}

/**
 * Where a card's art file lives: `cache/<id><suffix>` when the pipeline has
 * produced one, else — for the source scan and the clean art only — a custom
 * set's artwork, which is already clean. Undefined when neither exists.
 */
export function resolveArtFile(cardId: string, suffix: string): string | undefined {
  const cached = cachePath(cardId, suffix);
  if (existsSync(cached)) return cached;
  if (suffix === ".png" || suffix === "_clean.png") return getCustomArtPath(cardId);
  return undefined;
}

/** Load card data from cache JSON or card store. */
export function loadCardData(cardId: string): Record<string, unknown> {
  const custom = getCustomCardRaw(cardId);
  if (custom) return custom as unknown as Record<string, unknown>;
  const jsonPath = cachePath(cardId, ".json");
  if (existsSync(jsonPath)) {
    try {
      return JSON.parse(readFileSync(jsonPath, "utf-8"));
    } catch {}
  }
  const card = getCard(cardId);
  if (!card) return { id: cardId };
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

export async function ensureCardLoaded(cardId: string): Promise<void> {
  if (getCard(cardId)) return;
  const setId = cardId.replace(/-[^-]+$/, "");
  const setCode = REVERSE_SET_MAP[setId];
  if (setCode && !isSetLoaded(setCode)) {
    await loadSet(setCode);
  }
}

export async function ensureSourceImage(cardId: string): Promise<boolean> {
  const srcPath = cachePath(cardId, ".png");
  if (existsSync(srcPath)) return true;
  if (getCustomArtPath(cardId)) return true; // served straight from the custom set

  await ensureCardLoaded(cardId);
  const card = getCard(cardId);
  if (!card?.imageBase) return false;

  const imageUrl = cardImageUrl(card.imageBase, "high");
  const resp = await fetch(imageUrl, { headers: { "User-Agent": "DecklistGen/1.0" } });
  if (!resp.ok) return false;

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(srcPath, Buffer.from(await resp.arrayBuffer()));
  return true;
}
