/**
 * Cache + card-data utilities — the parts of the old render-svg.ts that
 * outlived the SVG renderer. These back the clean-image pipeline:
 * `/api/pokeproxy/status`, `/api/pokeproxy/image`, `/api/pokeproxy/generate`.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
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

/** The image kinds a card can have: the original scan and the pipeline's renders. */
export const ART_TYPES = ["source", "clean", "composite", "fullart"] as const;
export type ArtType = (typeof ART_TYPES)[number];

export function isArtType(value: string): value is ArtType {
  return (ART_TYPES as readonly string[]).includes(value);
}

export function artSuffix(type: ArtType): string {
  return type === "source" ? ".png" : `_${type}.png`;
}

export const MAX_THUMB_WIDTH = 2048;

/**
 * Read a card's image as PNG bytes — full size, or resized to `width` pixels
 * (clamped to 16…2048; the thumbnail is cached on disk next to the original and
 * rebuilt when the original is newer). The source scan is fetched from TCGdex
 * on a miss. Undefined when the card has no such image.
 */
export async function readArtImage(cardId: string, type: ArtType, width = 0): Promise<Buffer | undefined> {
  const suffix = artSuffix(type);
  if (type === "source" && !resolveArtFile(cardId, suffix)) await ensureSourceImage(cardId);
  const filePath = resolveArtFile(cardId, suffix);
  if (!filePath) return undefined;

  const targetWidth = width ? Math.max(16, Math.min(MAX_THUMB_WIDTH, Math.floor(width) || 0)) : 0;
  if (!targetWidth) return readFile(filePath);

  const thumbPath = cachePath(cardId, `${suffix.replace(".png", "")}_w${targetWidth}.png`);
  const sourceMtime = statSync(filePath).mtimeMs;
  const thumbFresh = existsSync(thumbPath) && statSync(thumbPath).mtimeMs >= sourceMtime;
  if (!thumbFresh) {
    const resized = await sharp(await readFile(filePath)).resize({ width: targetWidth }).png().toBuffer();
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(thumbPath, resized);
  }
  return readFile(thumbPath);
}
