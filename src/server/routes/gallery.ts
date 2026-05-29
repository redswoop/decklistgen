import { Hono } from "hono";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isFullArt } from "../../shared/utils/detect-fullart.js";
import { getPromptForCard, saveCardPrompt } from "../services/prompt-db.js";
import { getCard, loadSet, isSetLoaded } from "../services/card-store.js";
import { REVERSE_SET_MAP } from "../../shared/constants/set-codes.js";
import type { TcgdexCard } from "../../shared/types/card.js";

const CACHE_DIR = join(import.meta.dir, "../../../cache");

/** Load card data from cached JSON file */
function loadCachedCard(cardId: string): Record<string, unknown> | null {
  const jsonPath = join(CACHE_DIR, `${cardId}.json`);
  if (!existsSync(jsonPath)) return null;
  try {
    const text = readFileSync(jsonPath, "utf-8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const TEST_CARDS = [
  // Standard Pokemon (white background, art window)
  { label: "PokemonBasic", cardId: "sv01-001" },
  { label: "PokemonStage1", cardId: "sv01-006" },
  { label: "PokemonStage2", cardId: "cel25-15" },
  // Full-art Pokemon (full-bleed art, overlay text)
  { label: "PokemonEX", cardId: "sv01-019" },
  { label: "PokemonEX Stage2", cardId: "sv01-065" },
  { label: "PokemonEX Ultra", cardId: "sv01-231" },
  { label: "PokemonV", cardId: "cel25-16" },
  { label: "PokemonVMAX", cardId: "cel25-7" },
  { label: "Illustration Rare", cardId: "sv01-207" },
  // Trainers
  { label: "TrainerItem", cardId: "sv01-172" },
  { label: "TrainerSupporter", cardId: "sv01-175" },
  { label: "TrainerStadium", cardId: "sv03-196" },
  { label: "TrainerTool", cardId: "sv02-173" },
  { label: "Trainer FullArt", cardId: "cel25-24" },
  // Additional fullart types
  { label: "PokemonVSTAR", cardId: "swsh12.5-019" },
  { label: "PokemonDragon EX", cardId: "sv08.5-073" },
  { label: "PokemonDragon std", cardId: "sv06.5-045" },
  { label: "Pokemon Text-Heavy", cardId: "cel25-21" },
  // Energy
  { label: "EnergyBasic Dark", cardId: "sv06.5-098" },
  { label: "EnergyBasic Metal", cardId: "sv06.5-099" },
  { label: "EnergySpecial", cardId: "sv09-190" },
];

const app = new Hono();

/** Build a single GalleryCard row from a cardId + optional label. */
function buildGalleryCard(cardId: string, label = "") {
  const cached = loadCachedCard(cardId);
  const storeCard = getCard(cardId);
  const card = cached ?? (storeCard ? {
    id: storeCard.id,
    localId: storeCard.localId,
    name: storeCard.name,
    category: storeCard.category,
    hp: storeCard.hp,
    types: storeCard.energyTypes,
    stage: storeCard.stage,
    retreat: storeCard.retreat,
    rarity: storeCard.rarity,
    trainerType: storeCard.trainerType,
    set: { name: storeCard.setName, id: storeCard.setId },
  } : null);
  const hasClean = existsSync(join(CACHE_DIR, `${cardId}_clean.png`));
  const hasComposite = existsSync(join(CACHE_DIR, `${cardId}_composite.png`));
  const hasSource = existsSync(join(CACHE_DIR, `${cardId}.png`));
  let cleanMeta: Record<string, unknown> | null = null;
  const metaPath = join(CACHE_DIR, `${cardId}_clean_meta.json`);
  if (existsSync(metaPath)) {
    try { cleanMeta = JSON.parse(readFileSync(metaPath, "utf-8")); } catch {}
  }
  const promptResult = card ? getPromptForCard(card) : null;

  return {
    label,
    cardId,
    name: (card?.name as string) ?? cardId,
    category: (card?.category as string) ?? "?",
    stage: (card?.stage as string) ?? null,
    hp: (card?.hp as number) ?? null,
    rarity: (card?.rarity as string) ?? null,
    energyTypes: (card?.types as string[]) ?? [],
    effect: (card?.effect as string) ?? null,
    isFullArt: card ? isFullArt(card as TcgdexCard) : false,
    hasClean,
    hasComposite,
    hasSource,
    cleanMeta,
    promptRule: promptResult?.ruleName ?? null,
    promptText: promptResult?.prompt ?? null,
    promptSkip: promptResult?.skip ?? false,
    // Full enriched Card from the in-memory store. Lets the client mount the
    // CSS card renderer without a second per-card fetch. May be null if the
    // store hasn't loaded this card's set (cached-JSON-only path).
    card: storeCard ?? null,
  };
}

/** Auto-load any sets needed for a list of card IDs. */
async function ensureSetsLoaded(cardIds: string[]): Promise<void> {
  const setsNeeded = new Set<string>();
  for (const cardId of cardIds) {
    const setId = cardId.replace(/-[^-]+$/, "");
    const setCode = REVERSE_SET_MAP[setId];
    if (setCode && !isSetLoaded(setCode)) setsNeeded.add(setCode);
  }
  for (const code of setsNeeded) {
    try { await loadSet(code); } catch {}
  }
}

/** Return gallery card data. With no query, returns the TEST_CARDS reference
 *  set with their labels. With `?ids=a,b,c`, returns those specific cards
 *  (labels are blank — the client provides its own labels for deck cards). */
app.get("/cards", async (c) => {
  const idsParam = c.req.query("ids");
  if (idsParam) {
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
    await ensureSetsLoaded(ids);
    return c.json(ids.map((id) => buildGalleryCard(id)));
  }
  await ensureSetsLoaded(TEST_CARDS.map((t) => t.cardId));
  return c.json(TEST_CARDS.map(({ label, cardId }) => buildGalleryCard(cardId, label)));
});

/** Save a card-specific prompt to the database */
app.post("/prompt/:cardId", async (c) => {
  const cardId = c.req.param("cardId");
  const { prompt } = await c.req.json<{ prompt: string }>();
  if (!prompt || typeof prompt !== "string") {
    return c.json({ error: "prompt is required" }, 400);
  }
  saveCardPrompt(cardId, prompt.trim());
  return c.json({ cardId, status: "saved", prompt: prompt.trim() });
});

export default app;
