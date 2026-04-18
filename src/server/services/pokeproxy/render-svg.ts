import { existsSync, readFileSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getCard, loadSet, isSetLoaded } from "../card-store.js";
import { REVERSE_SET_MAP } from "../../../shared/constants/set-codes.js";
import { cardImageUrl } from "../../../shared/utils/card-image-url.js";
import type { TcgdexCard } from "../../../shared/types/card.js";
import { suggestTemplate } from "../../../shared/utils/suggest-template.js";
import { resetIconIds } from "./type-icons.js";
import { setCardIdPrefix } from "./svg-frame.js";
import { renderFromJsonTemplate } from "./render-json-template.js";

const CACHE_DIR = join(import.meta.dir, "../../../../cache");

export interface SvgRenderOptions {
  synth?: boolean;
  fullart?: boolean;
}

export function cachePath(cardId: string, suffix: string): string {
  return join(CACHE_DIR, `${cardId}${suffix}`);
}

/** Load card data from cache JSON or card store. */
export function loadCardData(cardId: string): Record<string, unknown> {
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

/** Synthetic attacks/abilities that exercise all 11 energy glyph types. */
const SYNTH_ATTACKS = [
  {
    name: "Prismatic Burst",
    cost: ["Grass", "Fire", "Water", "Colorless"],
    damage: "150",
    effect: "Discard a {L}{P}{F} Energy from this Pokémon.",
  },
  {
    name: "Shadow Forge",
    cost: ["Darkness", "Metal", "Dragon"],
    damage: "90+",
    effect: "This attack does 20 more damage for each {Y}{N}{C} Energy attached to this Pokémon.",
  },
];

const SYNTH_ABILITIES = [
  {
    type: "Ability",
    name: "Elemental Veil",
    effect: "Attacks that cost {G}{R}{W} Energy do 30 less damage to this Pokémon. If it has {L}{P}{F}{D}{M}{Y}{N}{C} attached, prevent all effects.",
  },
];

let _analyzeImageBrightness: ((buf: Buffer) => Promise<number>) | null = null;
async function getAnalyzeImageBrightness() {
  if (!_analyzeImageBrightness) {
    const mod = await import("./image-brightness.js");
    _analyzeImageBrightness = mod.analyzeImageBrightness;
  }
  return _analyzeImageBrightness;
}

/** Render SVG using the template engine.
 *  artCardId: optional override — use this card's image instead of cardId's. */
export async function generateSvgFromTemplate(
  cardId: string,
  opts?: SvgRenderOptions,
  artCardId?: string,
  idPrefix?: string,
): Promise<string> {
  const imageId = artCardId ?? cardId;

  let imageB64 = "";
  let isProcessed = false;

  for (const suffix of ["_composite.png", "_clean.png", ".png"]) {
    const p = cachePath(imageId, suffix);
    if (existsSync(p)) {
      imageB64 = (await readFile(p)).toString("base64");
      isProcessed = suffix !== ".png";
      break;
    }
  }
  if (!imageB64) {
    if (await ensureSourceImage(imageId)) {
      imageB64 = (await readFile(cachePath(imageId, ".png"))).toString("base64");
    }
  }

  await ensureCardLoaded(cardId);
  const cardData = loadCardData(cardId);

  if (opts?.synth) {
    cardData.attacks = SYNTH_ATTACKS;
    cardData.abilities = SYNTH_ABILITIES;
  }

  let templateName = suggestTemplate(cardData as TcgdexCard);
  if (templateName === "pokemon-standard" && (isProcessed || opts?.fullart)) {
    templateName = "pokemon-fullart";
  }

  if (imageB64 && (templateName === "pokemon-fullart" || templateName === "trainer")) {
    try {
      const analyzeImageBrightness = await getAnalyzeImageBrightness();
      const imageBuffer = Buffer.from(imageB64, "base64");
      const brightness = await analyzeImageBrightness(imageBuffer);
      cardData._textMode = brightness > 0.6 ? "dark" : "light";
    } catch {}
  }

  resetIconIds();
  setCardIdPrefix(idPrefix ?? `${cardId}-`);
  const svg = renderFromJsonTemplate(templateName, cardData, imageB64);
  setCardIdPrefix("");
  return svg;
}
