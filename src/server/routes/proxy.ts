import { Hono } from "hono";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { getCard } from "../services/card-store.js";
import { cleanCardImage } from "../services/comfyui.js";

const CACHE_DIR = join(import.meta.dir, "../../../cache");
const POKEPROXY_DIR = join(import.meta.dir, "../../../pokeproxy");

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

async function ensureSourceImage(cardId: string): Promise<boolean> {
  const srcPath = cachePath(cardId, ".png");
  if (existsSync(srcPath)) return true;

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
  const card = getCard(cardId);
  if (!card) throw new Error(`Card not found: ${cardId}`);

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

  // Load the card's cached JSON to get full TCGdex data for the renderer
  const jsonPath = cachePath(cardId, ".json");
  let cardData: Record<string, unknown>;
  if (existsSync(jsonPath)) {
    cardData = JSON.parse(await readFile(jsonPath, "utf-8"));
  } else {
    // Fallback: construct minimal card data from our normalized card
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

  const isFullart = card.isFullArt;
  const renderHeader = isFullart && status.hasClean && !status.hasComposite;

  const input = JSON.stringify({
    card: cardData,
    image_base64: imageBase64,
    is_fullart: isFullart,
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
  if (type !== "clean" && type !== "composite") {
    return c.json({ error: "type must be 'clean' or 'composite'" }, 400);
  }

  const filePath = cachePath(cardId, `_${type}.png`);
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

/** Serve an SVG proxy card (generate if missing) */
app.get("/svg/:cardId", async (c) => {
  const cardId = c.req.param("cardId");
  const svgPath = cachePath(cardId, ".svg");

  if (existsSync(svgPath)) {
    const data = await readFile(svgPath, "utf-8");
    return new Response(data, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  // Try to generate on the fly
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

/** Generate cleaned image via ComfyUI (direct, no framehouse) */
app.post("/generate/:cardId", async (c) => {
  const cardId = c.req.param("cardId");

  if (hasFile(cardId, "_composite.png")) {
    return c.json({ cardId, status: "already_exists" });
  }

  // Ensure source image in cache
  if (!hasFile(cardId, ".png")) {
    if (!(await ensureSourceImage(cardId))) {
      return c.json({ error: `Card not loaded or has no image: ${cardId}` }, 400);
    }
  }

  // Read source, resize to FLUX dimensions, clean via ComfyUI
  const srcData = await readFile(cachePath(cardId, ".png"));
  const srcBase64 = srcData.toString("base64");

  try {
    const cleanBase64 = await cleanCardImage(srcBase64);

    // Save clean image (composite = clean until proper compositing is added)
    const cleanBuffer = Buffer.from(cleanBase64, "base64");
    await mkdir(CACHE_DIR, { recursive: true });
    const writes: Promise<void>[] = [
      writeFile(cachePath(cardId, "_clean.png"), cleanBuffer),
      writeFile(cachePath(cardId, "_composite.png"), cleanBuffer),
    ];
    // Invalidate stale SVG so it regenerates with the cleaned image
    if (hasFile(cardId, ".svg")) {
      writes.push(unlink(cachePath(cardId, ".svg")));
    }
    await Promise.all(writes);

    return c.json({ cardId, status: "generated" });
  } catch (e: any) {
    return c.json({ cardId, status: "failed", error: e.message }, 500);
  }
});

export default app;
