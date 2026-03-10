import { Hono } from "hono";
import { existsSync, readFileSync } from "node:fs";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { getCard, loadSet, isSetLoaded } from "../services/card-store.js";
import { cleanCardImage } from "../services/comfyui.js";
import { getPromptForCard, saveCardPrompt } from "../services/prompt-db.js";
import { getCardSettings, updateCardSettings, deleteCardSettings } from "../services/card-settings.js";
import { getCustomizedCards, deleteCardArtifacts, invalidateCustomizedCardsCache } from "../services/customized-cards.js";
import { requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";
import { REVERSE_SET_MAP } from "../../shared/constants/set-codes.js";
import { cardImageUrl } from "../../shared/utils/card-image-url.js";
import { isFullArt } from "../../shared/utils/detect-fullart.js";
import type { TcgdexCard } from "../../shared/types/card.js";
import { resetIconIds, renderFromTemplate } from "../services/pokeproxy/templates/index.js";
import type { TemplateName } from "../services/pokeproxy/templates/index.js";
import { renderEnergyPreviewSvg } from "../services/pokeproxy/energy-preview.js";
import { logAction, getClientIp } from "../services/logger.js";

const CACHE_DIR = join(import.meta.dir, "../../../cache");

function cachePath(cardId: string, suffix: string): string {
  return join(CACHE_DIR, `${cardId}${suffix}`);
}

function hasFile(cardId: string, suffix: string): boolean {
  return existsSync(cachePath(cardId, suffix));
}

function getStatus(cardId: string) {
  return {
    hasClean: hasFile(cardId, "_clean.png"),
    hasComposite: hasFile(cardId, "_composite.png"),
    hasSvg: hasFile(cardId, ".svg"),
  };
}

/** Load card data from cache JSON or card store. */
function loadCardData(cardId: string): Record<string, unknown> {
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

async function ensureCardLoaded(cardId: string): Promise<void> {
  if (getCard(cardId)) return;
  const setId = cardId.replace(/-[^-]+$/, "");
  const setCode = REVERSE_SET_MAP[setId];
  if (setCode && !isSetLoaded(setCode)) {
    await loadSet(setCode);
  }
}

async function ensureSourceImage(cardId: string): Promise<boolean> {
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

interface SvgRenderOptions {
  fontSize?: number;
  maxCover?: number;
  synth?: boolean;
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

/** Render SVG using the template engine. */
async function generateSvgFromTemplate(cardId: string, opts?: SvgRenderOptions): Promise<string> {
  // Get best available image (optional — SVG can render without artwork)
  let imageB64 = "";
  for (const suffix of ["_composite.png", "_clean.png", ".png"]) {
    const p = cachePath(cardId, suffix);
    if (existsSync(p)) {
      imageB64 = (await readFile(p)).toString("base64");
      break;
    }
  }
  if (!imageB64) {
    if (await ensureSourceImage(cardId)) {
      imageB64 = (await readFile(cachePath(cardId, ".png"))).toString("base64");
    }
  }

  // Load card data
  await ensureCardLoaded(cardId);
  const cardData = loadCardData(cardId);

  // Synth mode: keep real art/metadata, replace text with glyph-exercising attacks
  if (opts?.synth) {
    cardData.attacks = SYNTH_ATTACKS;
    cardData.abilities = SYNTH_ABILITIES;
  }

  // Determine template
  const fullart = isFullArt(cardData as TcgdexCard);
  const isBasicEnergy = (cardData.category === "Energy") && !cardData.effect;
  let templateName: TemplateName;
  if (isBasicEnergy) templateName = "basic-energy";
  else if (fullart) templateName = "fullart";
  else templateName = "standard";

  resetIconIds();

  const renderOpts: import("../services/pokeproxy/templates/index.js").FullartOptions = {};
  if (opts?.fontSize != null) renderOpts.fontSize = opts.fontSize;
  if (opts?.maxCover != null) renderOpts.maxCover = opts.maxCover;

  return renderFromTemplate(templateName, cardData, imageB64, renderOpts);
}

const app = new Hono<AppEnv>();

/** Energy glyph color preview — all 11 types in a row */
app.get("/energy-preview", (c) => {
  const svg = renderEnergyPreviewSvg();
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
});

/** Check what proxy assets exist for a card */
app.get("/status/:cardId", (c) => {
  const cardId = c.req.param("cardId");
  return c.json({ cardId, ...getStatus(cardId) });
});

/** Batch status check for multiple cards */
app.post("/status/batch", async (c) => {
  const { cardIds } = await c.req.json<{ cardIds: string[] }>();
  const results: Record<string, ReturnType<typeof getStatus>> = {};
  for (const cardId of cardIds) {
    results[cardId] = getStatus(cardId);
  }
  return c.json(results);
});

/** Serve a cleaned/composite image from cache */
app.get("/image/:cardId/:type", async (c) => {
  const cardId = c.req.param("cardId");
  const type = c.req.param("type");
  if (type !== "clean" && type !== "composite" && type !== "source") {
    return c.json({ error: "type must be 'clean', 'composite', or 'source'" }, 400);
  }

  const filePath = cachePath(cardId, type === "source" ? ".png" : `_${type}.png`);
  if (!existsSync(filePath)) {
    return c.json({ error: "Not found" }, 404);
  }

  const data = await readFile(filePath);
  return new Response(data, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
});

/** Serve an SVG proxy card */
app.get("/svg/:cardId", async (c) => {
  const cardId = c.req.param("cardId");
  logAction("proxy.svg", getClientIp(c), { cardId });
  const query = c.req.query();
  // User-scoped settings as defaults (if authenticated), query params override
  const user = c.get("user");
  const stored = user ? getCardSettings(user.id, cardId) : {};
  const svgOpts: SvgRenderOptions = {};
  svgOpts.fontSize = query.fontSize ? parseFloat(query.fontSize) : stored.fontSize;
  svgOpts.maxCover = query.maxCover ? parseFloat(query.maxCover) : stored.maxCover;
  if (query.synth != null) svgOpts.synth = true;
  try {
    const svg = await generateSvgFromTemplate(cardId, svgOpts);
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/** Force-regenerate an SVG proxy card (SVGs are rendered on-the-fly, so this is a no-op) */
app.post("/svg/:cardId/regenerate", (c) => {
  const cardId = c.req.param("cardId");
  return c.json({ cardId, status: "regenerated" });
});

/** Get the resolved prompt for a card */
app.get("/prompt/:cardId", async (c) => {
  const cardId = c.req.param("cardId");
  await ensureCardLoaded(cardId);
  const cardData = loadCardData(cardId);
  const result = getPromptForCard(cardData);

  // Also check if there's a previous generation's metadata
  let lastUsed: { prompt?: string; seed?: number; rule?: string } | null = null;
  const metaPath = cachePath(cardId, "_clean_meta.json");
  if (existsSync(metaPath)) {
    try {
      lastUsed = JSON.parse(readFileSync(metaPath, "utf-8"));
    } catch {}
  }

  return c.json({
    cardId,
    ruleName: result.ruleName,
    prompt: result.prompt,
    skip: result.skip,
    lastUsed,
  });
});

/** Save a card-specific prompt override */
app.put("/prompt/:cardId", async (c) => {
  const cardId = c.req.param("cardId");
  logAction("card.promptOverride", getClientIp(c), { cardId });
  const { prompt } = await c.req.json<{ prompt: string }>();
  if (!prompt || typeof prompt !== "string") {
    return c.json({ error: "prompt is required" }, 400);
  }
  saveCardPrompt(cardId, prompt);
  return c.json({ cardId, status: "saved" });
});

app.post("/generate/:cardId", async (c) => {
  const cardId = c.req.param("cardId");
  const force = c.req.query("force") === "true";
  const seedParam = c.req.query("seed");
  logAction("proxy.generate", getClientIp(c), { cardId, seed: seedParam, force });
  const promptOverride = c.req.query("prompt") || undefined;
  // Use provided seed, or random on force, or default 42
  const seed = seedParam ? parseInt(seedParam, 10) : force ? Math.floor(Math.random() * 999999) : 42;

  if (!force && hasFile(cardId, "_composite.png")) {
    return c.json({ cardId, status: "already_exists" });
  }

  // Ensure source image in cache
  if (!hasFile(cardId, ".png")) {
    if (!(await ensureSourceImage(cardId))) {
      return c.json({ error: `Card not loaded or has no image: ${cardId}` }, 400);
    }
  }

  // Look up the prompt for this card
  const cardData = loadCardData(cardId);
  let prompt: string;
  let ruleName: string;

  if (promptOverride) {
    prompt = promptOverride;
    ruleName = "manual-override";
  } else {
    const result = getPromptForCard(cardData);
    if (result.skip) {
      return c.json({ cardId, status: "skipped", rule: result.ruleName });
    }
    if (!result.prompt) {
      return c.json({ cardId, status: "no_prompt", rule: result.ruleName }, 400);
    }
    prompt = result.prompt;
    ruleName = result.ruleName;
  }

  // Read source, resize to FLUX dimensions, clean via ComfyUI
  const srcData = await readFile(cachePath(cardId, ".png"));
  const srcBase64 = srcData.toString("base64");

  try {
    const cleanBase64 = await cleanCardImage(srcBase64, seed, prompt);

    // Save clean image (composite = clean until proper compositing is added)
    const cleanBuffer = Buffer.from(cleanBase64, "base64");
    await mkdir(CACHE_DIR, { recursive: true });
    const writes: Promise<void>[] = [
      writeFile(cachePath(cardId, "_clean.png"), cleanBuffer),
      writeFile(cachePath(cardId, "_composite.png"), cleanBuffer),
      // Save metadata about the clean operation
      writeFile(cachePath(cardId, "_clean_meta.json"), JSON.stringify({
        prompt,
        rule: ruleName,
        seed,
        timestamp: new Date().toISOString(),
        cardId,
      }, null, 2)),
    ];
    // Invalidate stale SVG so it regenerates with the cleaned image
    if (hasFile(cardId, ".svg")) {
      writes.push(unlink(cachePath(cardId, ".svg")));
    }
    await Promise.all(writes);

    return c.json({ cardId, status: "generated", seed, rule: ruleName, prompt });
  } catch (e: any) {
    return c.json({ cardId, status: "failed", error: e.message }, 500);
  }
});

// --- Card settings endpoints (require auth) ---

/** Get proxy settings for a card */
app.get("/settings/:cardId", requireAuth, (c) => {
  const user = c.get("user")!;
  const cardId = c.req.param("cardId");
  return c.json(getCardSettings(user.id, cardId));
});

/** Update proxy settings (merge patch) */
app.put("/settings/:cardId", requireAuth, async (c) => {
  const user = c.get("user")!;
  const cardId = c.req.param("cardId");
  logAction("card.settingsUpdate", getClientIp(c), { cardId });
  const patch = await c.req.json();
  const result = updateCardSettings(user.id, cardId, patch);
  return c.json(result);
});

/** Clear proxy settings */
app.delete("/settings/:cardId", requireAuth, (c) => {
  const user = c.get("user")!;
  const cardId = c.req.param("cardId");
  const deleted = deleteCardSettings(user.id, cardId);
  return c.json({ ok: deleted });
});

// --- Customized cards endpoints ---

/** List all customized cards with staleness + deck membership */
app.get("/customized", async (c) => {
  const user = c.get("user");
  const result = await getCustomizedCards(user?.id);
  return c.json(result);
});

/** Delete all cache artifacts for a card */
app.delete("/customized/:cardId", async (c) => {
  const cardId = c.req.param("cardId");
  await deleteCardArtifacts(cardId);
  return c.json({ ok: true, cardId });
});

/** Batch delete cache artifacts */
app.post("/customized/batch/delete", async (c) => {
  const { cardIds } = await c.req.json<{ cardIds: string[] }>();
  for (const cardId of cardIds) {
    await deleteCardArtifacts(cardId);
  }
  return c.json({ ok: true, deleted: cardIds.length });
});

export default app;
