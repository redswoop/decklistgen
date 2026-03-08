import { Hono } from "hono";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir, unlink, stat } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { getCard, loadSet, isSetLoaded } from "../services/card-store.js";
import { cleanCardImage } from "../services/comfyui.js";
import { getPromptForCard } from "../services/prompt-db.js";
import { REVERSE_SET_MAP } from "../../shared/constants/set-codes.js";
import { isFullArt } from "../../shared/utils/detect-fullart.js";
import type { TcgdexCard } from "../../shared/types/card.js";
import {
  generateStandardSvg, generateFullartSvg, generateBasicEnergySvg,
  resetIconIds,
} from "../services/pokeproxy/renderer.js";
import { renderFromTemplate } from "../services/pokeproxy/templates/index.js";
import type { TemplateName } from "../services/pokeproxy/templates/index.js";

const CACHE_DIR = join(import.meta.dir, "../../../cache");
const POKEPROXY_DIR = join(import.meta.dir, "../../../pokeproxy");
const RENDERER_PATH = join(POKEPROXY_DIR, "pokeproxy.py");

/** Get mtime of a file, or 0 if it doesn't exist. */
async function mtime(path: string): Promise<number> {
  try {
    return (await stat(path)).mtimeMs;
  } catch {
    return 0;
  }
}

/** Check if a cached SVG is stale (image or renderer is newer). */
async function isSvgStale(cardId: string): Promise<boolean> {
  const svgPath = cachePath(cardId, ".svg");
  const svgTime = await mtime(svgPath);
  if (svgTime === 0) return true;

  // Stale if renderer was updated
  const rendererTime = await mtime(RENDERER_PATH);
  if (rendererTime > svgTime) return true;

  // Stale if best available image is newer
  for (const suffix of ["_composite.png", "_clean.png", ".png"]) {
    const imgTime = await mtime(cachePath(cardId, suffix));
    if (imgTime > 0) return imgTime > svgTime;
  }

  return true; // no image at all — regenerate to attempt download
}

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

/** Load card data from cache JSON or card store (for prompt matching). */
function loadCardData(cardId: string): Record<string, unknown> {
  const jsonPath = cachePath(cardId, ".json");
  if (existsSync(jsonPath)) {
    try {
      return JSON.parse(require("node:fs").readFileSync(jsonPath, "utf-8"));
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
  if (!card?.imageUrl) return false;

  const resp = await fetch(card.imageUrl, { headers: { "User-Agent": "DecklistGen/1.0" } });
  if (!resp.ok) return false;

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(srcPath, Buffer.from(await resp.arrayBuffer()));
  return true;
}

/** Spawn pokeproxy bridge.py to generate an SVG */
async function generateSvg(cardId: string): Promise<string> {
  // Check file availability once
  const status = getStatus(cardId);
  const hasSource = hasFile(cardId, ".png");

  // Get the best available image for this card
  let imagePath: string;
  if (status.hasComposite) {
    imagePath = cachePath(cardId, "_composite.png");
  } else if (status.hasClean) {
    imagePath = cachePath(cardId, "_clean.png");
  } else if (hasSource) {
    imagePath = cachePath(cardId, ".png");
  } else {
    // Download it
    if (!(await ensureSourceImage(cardId))) {
      throw new Error(`No image available for ${cardId}`);
    }
    imagePath = cachePath(cardId, ".png");
  }

  const imageData = await readFile(imagePath);
  const imageBase64 = imageData.toString("base64");

  // Load card data: prefer cached JSON, fall back to card store
  const jsonPath = cachePath(cardId, ".json");
  let cardData: Record<string, unknown>;
  if (existsSync(jsonPath)) {
    cardData = JSON.parse(await readFile(jsonPath, "utf-8"));
  } else {
    await ensureCardLoaded(cardId);
    const card = getCard(cardId);
    if (!card) throw new Error(`Card not found: ${cardId}`);
    cardData = {
      id: card.id,
      localId: card.localId,
      name: card.name,
      category: card.category,
      hp: card.hp,
      types: card.energyTypes,
      stage: card.stage,
      retreat: card.retreat,
      rarity: card.rarity,
      set: { name: card.setName, id: card.setId },
      trainerType: card.trainerType,
    };
  }

  const fullart = isFullArt(cardData as TcgdexCard);
  const renderHeader = fullart; // Always show name/HP header on fullart cards

  const input = JSON.stringify({
    card: cardData,
    image_base64: imageBase64,
    is_fullart: fullart,
    options: {
      render_header: renderHeader,
    },
  });

  return new Promise<string>((resolve, reject) => {
    const venvPython = join(POKEPROXY_DIR, ".venv", "bin", "python");
    const pythonBin = existsSync(venvPython) ? venvPython : "python3";
    const proc = spawn(pythonBin, [join(POKEPROXY_DIR, "bridge.py")], {
      cwd: POKEPROXY_DIR,
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });

    proc.on("close", (code) => {
      if (code === 0 && stdout) {
        resolve(stdout);
      } else {
        reject(new Error(`bridge.py failed (code ${code}): ${stderr}`));
      }
    });

    proc.stdin.write(input);
    proc.stdin.end();

    setTimeout(() => {
      proc.kill();
      reject(new Error("SVG generation timeout"));
    }, 30_000);
  });
}

const app = new Hono();

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

/** Render SVG using the template engine (no cache, no Python). */
async function generateSvgFromTemplate(cardId: string): Promise<string> {
  // Get best available image
  let imagePath: string | null = null;
  for (const suffix of ["_composite.png", "_clean.png", ".png"]) {
    const p = cachePath(cardId, suffix);
    if (existsSync(p)) { imagePath = p; break; }
  }
  if (!imagePath) {
    if (!(await ensureSourceImage(cardId))) throw new Error(`No image available for ${cardId}`);
    imagePath = cachePath(cardId, ".png");
  }

  const imageB64 = (await readFile(imagePath)).toString("base64");

  // Load card data
  const jsonPath = cachePath(cardId, ".json");
  let cardData: Record<string, unknown>;
  if (existsSync(jsonPath)) {
    cardData = JSON.parse(await readFile(jsonPath, "utf-8"));
  } else {
    await ensureCardLoaded(cardId);
    const card = getCard(cardId);
    if (!card) throw new Error(`Card not found: ${cardId}`);
    cardData = {
      id: card.id, localId: card.localId, name: card.name,
      category: card.category, hp: card.hp, types: card.energyTypes,
      stage: card.stage, retreat: card.retreat, rarity: card.rarity,
      set: { name: card.setName, id: card.setId }, trainerType: card.trainerType,
    };
  }

  // Determine template
  const fullart = isFullArt(cardData as TcgdexCard);
  const isBasicEnergy = (cardData.category === "Energy") && !cardData.effect;
  let templateName: TemplateName;
  if (isBasicEnergy) templateName = "basic-energy";
  else if (fullart) templateName = "fullart";
  else templateName = "standard";

  resetIconIds();
  return renderFromTemplate(templateName, cardData, imageB64);
}

/** Serve an SVG proxy card (generate if missing or stale) */
app.get("/svg/:cardId", async (c) => {
  const cardId = c.req.param("cardId");
  const renderer = c.req.query("renderer");

  // Template renderer: no cache, render live
  if (renderer === "template") {
    try {
      const svg = await generateSvgFromTemplate(cardId);
      return new Response(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "no-cache",
        },
      });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  }

  const svgPath = cachePath(cardId, ".svg");

  const stale = await isSvgStale(cardId);
  if (!stale) {
    const data = await readFile(svgPath, "utf-8");
    return new Response(data, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  // Generate (or regenerate)
  try {
    const svg = await generateSvg(cardId);
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(svgPath, svg);
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/** Force-regenerate an SVG proxy card */
app.post("/svg/:cardId/regenerate", async (c) => {
  const cardId = c.req.param("cardId");
  const svgPath = cachePath(cardId, ".svg");
  if (existsSync(svgPath)) {
    await unlink(svgPath);
  }
  try {
    const svg = await generateSvg(cardId);
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(svgPath, svg);
    return c.json({ cardId, status: "regenerated" });
  } catch (e: any) {
    return c.json({ cardId, status: "failed", error: e.message }, 500);
  }
});

app.post("/generate/:cardId", async (c) => {
  const cardId = c.req.param("cardId");
  const force = c.req.query("force") === "true";
  const seedParam = c.req.query("seed");
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

export default app;
