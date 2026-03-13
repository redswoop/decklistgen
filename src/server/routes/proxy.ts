import { Hono } from "hono";
import { existsSync, readFileSync, statSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getCard, loadSet, isSetLoaded } from "../services/card-store.js";
import { ping as comfyPing, COMFYUI_URL } from "../services/comfyui.js";
import { submitJob, listJobs, getJob, cancelJob, clearCompleted } from "../services/gen-queue.js";
import { getPromptForCard, saveCardPrompt } from "../services/prompt-db.js";
import { getCardSettings, updateCardSettings, deleteCardSettings } from "../services/card-settings.js";
import { getCustomizedCards, deleteCardArtifacts, invalidateCustomizedCardsCache } from "../services/customized-cards.js";
import { getDeck } from "../services/deck-store.js";
import { generatePrintHtml } from "../services/pokeproxy/index.js";
import { requireAuth, requireAuthorized } from "../middleware/auth.js";
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

const VALID_CARD_ID = /^[a-zA-Z0-9._-]+$/;

const FULLART_DEFAULT_PROMPT =
  "Expand this image into a full illustration that fills the entire canvas. " +
  "Remove all text, borders, and card frame elements. " +
  "The subject should be the main focus with a detailed, atmospheric background.";

function isValidCardId(cardId: string): boolean {
  return VALID_CARD_ID.test(cardId) && !cardId.includes("..");
}

function cachePath(cardId: string, suffix: string): string {
  return join(CACHE_DIR, `${cardId}${suffix}`);
}

function hasFile(cardId: string, suffix: string): boolean {
  return existsSync(cachePath(cardId, suffix));
}

function getStatus(cardId: string) {
  const hasClean = hasFile(cardId, "_clean.png");
  const hasComposite = hasFile(cardId, "_composite.png");

  // mtime of the newest cleaned image — used by client for cache-busting across page reloads
  let mtime = 0;
  if (hasComposite) {
    try { mtime = Math.max(mtime, statSync(cachePath(cardId, "_composite.png")).mtimeMs); } catch {}
  }
  if (hasClean) {
    try { mtime = Math.max(mtime, statSync(cachePath(cardId, "_clean.png")).mtimeMs); } catch {}
  }

  return {
    hasClean,
    hasComposite,
    hasSvg: hasFile(cardId, ".svg"),
    hasFullart: hasFile(cardId, "_fullart.png"),
    mtime: mtime || undefined,
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
  fullart?: boolean;
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
  let isProcessed = false;

  for (const suffix of ["_composite.png", "_clean.png", ".png"]) {
    const p = cachePath(cardId, suffix);
    if (existsSync(p)) {
      imageB64 = (await readFile(p)).toString("base64");
      isProcessed = suffix !== ".png";
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

  // Determine template — processed standard cards render as fullart (they've been expanded)
  const fullart = isFullArt(cardData as TcgdexCard);
  const isBasicEnergy = (cardData.category === "Energy") && !cardData.effect;
  let templateName: TemplateName;
  if (isBasicEnergy) templateName = "basic-energy";
  else if (fullart || isProcessed || opts?.fullart) templateName = "fullart";
  else templateName = "standard";

  resetIconIds();

  const renderOpts: import("../services/pokeproxy/templates/index.js").FullartOptions = {};
  if (opts?.fontSize != null) renderOpts.fontSize = opts.fontSize;
  if (opts?.maxCover != null) renderOpts.maxCover = opts.maxCover;

  return renderFromTemplate(templateName, cardData, imageB64, renderOpts);
}

const app = new Hono<AppEnv>();

/** Diagnostic: test ComfyUI connectivity from the server process */
app.get("/comfyui-ping", async (c) => {
  const ok = await comfyPing();
  return c.json({ ok, url: COMFYUI_URL });
});

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
  if (!isValidCardId(cardId)) return c.json({ error: "Invalid card ID" }, 400);
  return c.json({ cardId, ...getStatus(cardId) });
});

/** Batch status check for multiple cards */
app.post("/status/batch", async (c) => {
  const { cardIds, includeGenInfo } = await c.req.json<{ cardIds: string[]; includeGenInfo?: boolean }>();
  if (!Array.isArray(cardIds) || cardIds.length > 500) {
    return c.json({ error: "cardIds must be an array of at most 500" }, 400);
  }
  const results: Record<string, Record<string, unknown>> = {};
  for (const cardId of cardIds) {
    if (!isValidCardId(cardId)) continue;
    const status = getStatus(cardId);
    if (!includeGenInfo) {
      results[cardId] = status;
      continue;
    }
    // Enrich with generation info: skip, isStale, staleSummary
    await ensureCardLoaded(cardId);
    const cardData = loadCardData(cardId);
    const promptResult = getPromptForCard(cardData);
    let isStale = false;
    let staleSummary: string | undefined;
    if (status.hasClean) {
      const metaPath = cachePath(cardId, "_clean_meta.json");
      if (existsSync(metaPath)) {
        try {
          const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
          if (meta.rule !== promptResult.ruleName) {
            isStale = true;
            staleSummary = `rule changed: ${meta.rule} → ${promptResult.ruleName}`;
          } else if (promptResult.prompt && promptResult.prompt !== meta.prompt) {
            isStale = true;
            staleSummary = `prompt text changed (rule: ${promptResult.ruleName})`;
          }
        } catch {}
      }
    }
    results[cardId] = {
      ...status,
      skip: promptResult.skip,
      isStale,
      staleSummary,
    };
  }
  return c.json(results);
});

/** Serve a cleaned/composite image from cache */
app.get("/image/:cardId/:type", async (c) => {
  const cardId = c.req.param("cardId");
  if (!isValidCardId(cardId)) return c.json({ error: "Invalid card ID" }, 400);
  const type = c.req.param("type");
  if (type !== "clean" && type !== "composite" && type !== "source" && type !== "fullart") {
    return c.json({ error: "type must be 'clean', 'composite', 'source', or 'fullart'" }, 400);
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
  if (!isValidCardId(cardId)) return c.json({ error: "Invalid card ID" }, 400);
  logAction("proxy.svg", getClientIp(c), { cardId });
  const query = c.req.query();
  // User-scoped settings as defaults (if authenticated), query params override
  const user = c.get("user");
  const stored = user ? getCardSettings(user.id, cardId) : {};
  const svgOpts: SvgRenderOptions = {};
  svgOpts.fontSize = query.fontSize ? Math.max(1, Math.min(200, parseFloat(query.fontSize) || 0)) : stored.fontSize;
  svgOpts.maxCover = query.maxCover ? Math.max(0, Math.min(1, parseFloat(query.maxCover) || 0)) : stored.maxCover;
  if (query.synth != null) svgOpts.synth = true;
  if (query.fullart != null) svgOpts.fullart = true;
  try {
    const svg = await generateSvgFromTemplate(cardId, svgOpts);
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e: any) {
    console.error("SVG generation failed:", e);
    return c.json({ error: "SVG generation failed" }, 500);
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
  if (!isValidCardId(cardId)) return c.json({ error: "Invalid card ID" }, 400);
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
app.put("/prompt/:cardId", requireAuthorized, async (c) => {
  const cardId = c.req.param("cardId");
  if (!isValidCardId(cardId)) return c.json({ error: "Invalid card ID" }, 400);
  logAction("card.promptOverride", getClientIp(c), { cardId });
  const { prompt } = await c.req.json<{ prompt: string }>();
  if (!prompt || typeof prompt !== "string") {
    return c.json({ error: "prompt is required" }, 400);
  }
  saveCardPrompt(cardId, prompt);
  return c.json({ cardId, status: "saved" });
});

app.post("/generate/:cardId", requireAuthorized, async (c) => {
  const cardId = c.req.param("cardId");
  if (!isValidCardId(cardId)) return c.json({ error: "Invalid card ID" }, 400);
  const force = c.req.query("force") === "true";
  const seedParam = c.req.query("seed");
  const mode = c.req.query("mode") === "fullart" ? "fullart" : "clean";
  logAction("proxy.generate", getClientIp(c), { cardId, seed: seedParam, force, mode });
  const promptOverride = c.req.query("prompt") || undefined;
  const seed = seedParam ? Math.max(0, Math.min(999999999, parseInt(seedParam, 10) || 0)) : force ? Math.floor(Math.random() * 999999) : 42;

  const existsSuffix = mode === "fullart" ? "_fullart.png" : "_composite.png";
  if (!force && hasFile(cardId, existsSuffix)) {
    return c.json({ cardId, status: "already_exists" });
  }

  // Resolve prompt before queuing
  const cardData = loadCardData(cardId);
  let prompt: string;
  let ruleName: string;

  if (promptOverride) {
    prompt = promptOverride;
    ruleName = "manual-override";
  } else {
    const result = getPromptForCard(cardData);
    if (mode === "fullart") {
      prompt = result.prompt || FULLART_DEFAULT_PROMPT;
      ruleName = result.skip ? "fullart-default" : result.ruleName;
    } else {
      if (result.skip) {
        return c.json({ cardId, status: "skipped", rule: result.ruleName });
      }
      if (!result.prompt) {
        return c.json({ cardId, status: "no_prompt", rule: result.ruleName }, 400);
      }
      prompt = result.prompt;
      ruleName = result.ruleName;
    }
  }

  // Resolve card name + image base for queue display
  await ensureCardLoaded(cardId);
  const card = getCard(cardId);
  const user = c.get("user")!;

  const job = submitJob({
    cardId,
    cardName: card?.name || cardId,
    cardImageBase: card?.imageBase || "",
    mode,
    force,
    seed,
    prompt,
    ruleName,
    submittedBy: user.displayName || user.email,
  });

  return c.json({ jobId: job.id, cardId, status: "queued" });
});

// --- Queue endpoints ---

app.get("/queue", requireAuth, (c) => {
  return c.json({ jobs: listJobs() });
});

app.get("/queue/:jobId", requireAuth, (c) => {
  const job = getJob(c.req.param("jobId"));
  if (!job) return c.json({ error: "Job not found" }, 404);
  return c.json(job);
});

app.post("/queue/:jobId/cancel", requireAuthorized, (c) => {
  const ok = cancelJob(c.req.param("jobId"));
  return c.json({ ok });
});

app.post("/queue/clear", requireAuthorized, (c) => {
  const cleared = clearCompleted();
  return c.json({ ok: true, cleared });
});

/** Print-ready HTML sheet for an entire deck */
app.get("/print/:deckId", requireAuth, async (c) => {
  const user = c.get("user")!;
  const deckId = c.req.param("deckId");
  const deck = await getDeck(deckId, user.id);
  if (!deck) return c.json({ error: "Deck not found" }, 404);

  resetIconIds();

  const cardSvgs: [number, string][] = [];
  for (const entry of deck.cards) {
    const cardId = entry.card.id;
    const stored = getCardSettings(user.id, cardId);
    const svg = await generateSvgFromTemplate(cardId, {
      fontSize: stored.fontSize,
      maxCover: stored.maxCover,
    });
    cardSvgs.push([entry.count, svg]);
  }

  const html = generatePrintHtml(cardSvgs);
  return c.html(html);
});

// --- Card settings endpoints (require auth) ---

/** Get proxy settings for a card */
app.get("/settings/:cardId", requireAuth, (c) => {
  const user = c.get("user")!;
  const cardId = c.req.param("cardId");
  if (!isValidCardId(cardId)) return c.json({ error: "Invalid card ID" }, 400);
  return c.json(getCardSettings(user.id, cardId));
});

/** Update proxy settings (merge patch) */
app.put("/settings/:cardId", requireAuthorized, async (c) => {
  const user = c.get("user")!;
  const cardId = c.req.param("cardId");
  if (!isValidCardId(cardId)) return c.json({ error: "Invalid card ID" }, 400);
  logAction("card.settingsUpdate", getClientIp(c), { cardId });
  const patch = await c.req.json();
  const result = updateCardSettings(user.id, cardId, patch);
  return c.json(result);
});

/** Clear proxy settings */
app.delete("/settings/:cardId", requireAuth, (c) => {
  const user = c.get("user")!;
  const cardId = c.req.param("cardId");
  if (!isValidCardId(cardId)) return c.json({ error: "Invalid card ID" }, 400);
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
app.delete("/customized/:cardId", requireAuthorized, async (c) => {
  const cardId = c.req.param("cardId");
  if (!isValidCardId(cardId)) return c.json({ error: "Invalid card ID" }, 400);
  await deleteCardArtifacts(cardId);
  return c.json({ ok: true, cardId });
});

/** Batch delete cache artifacts */
app.post("/customized/batch/delete", requireAuthorized, async (c) => {
  const { cardIds } = await c.req.json<{ cardIds: string[] }>();
  if (!Array.isArray(cardIds)) return c.json({ error: "cardIds must be an array" }, 400);
  for (const cardId of cardIds) {
    if (!isValidCardId(cardId)) continue;
    await deleteCardArtifacts(cardId);
  }
  return c.json({ ok: true, deleted: cardIds.length });
});

export default app;
