import { Hono } from "hono";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

const POKEPROXY_DIR = process.env.POKEPROXY_DIR ?? "/Users/armen/src/pokeproxy";
const POKEPROXY_CACHE = join(POKEPROXY_DIR, "cache");
const POKEPROXY_OUTPUT = join(POKEPROXY_DIR, "output");
const FRAMEHOUSE_URL = process.env.FRAMEHOUSE_URL ?? "http://localhost:3000";

const app = new Hono();

/** Check what pokeproxy assets exist for a card */
app.get("/status/:cardId", (c) => {
  const cardId = c.req.param("cardId");
  const hasClean = existsSync(join(POKEPROXY_CACHE, `${cardId}_clean.png`));
  const hasComposite = existsSync(join(POKEPROXY_CACHE, `${cardId}_composite.png`));
  const hasSvg = existsSync(join(POKEPROXY_OUTPUT, `${cardId}.svg`));
  const hasOriginal = existsSync(join(POKEPROXY_CACHE, `${cardId}.png`));
  return c.json({ cardId, hasClean, hasComposite, hasSvg, hasOriginal });
});

/** Batch status check for multiple cards */
app.post("/status/batch", async (c) => {
  const { cardIds } = await c.req.json<{ cardIds: string[] }>();
  const results: Record<string, { hasClean: boolean; hasComposite: boolean; hasSvg: boolean }> = {};
  for (const cardId of cardIds) {
    results[cardId] = {
      hasClean: existsSync(join(POKEPROXY_CACHE, `${cardId}_clean.png`)),
      hasComposite: existsSync(join(POKEPROXY_CACHE, `${cardId}_composite.png`)),
      hasSvg: existsSync(join(POKEPROXY_OUTPUT, `${cardId}.svg`)),
    };
  }
  return c.json(results);
});

/** Serve a cleaned/composite image */
app.get("/image/:cardId/:type", async (c) => {
  const cardId = c.req.param("cardId");
  const type = c.req.param("type"); // "clean" or "composite"
  if (type !== "clean" && type !== "composite") {
    return c.json({ error: "type must be 'clean' or 'composite'" }, 400);
  }

  const filePath = join(POKEPROXY_CACHE, `${cardId}_${type}.png`);
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
  const filePath = join(POKEPROXY_OUTPUT, `${cardId}.svg`);
  if (!existsSync(filePath)) {
    return c.json({ error: "Not found" }, 404);
  }

  const data = await readFile(filePath, "utf-8");
  return new Response(data, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
});

/** Generate cleaned image via pokecleaner (calls Python) */
app.post("/generate/:cardId", async (c) => {
  const cardId = c.req.param("cardId");

  // Check if already exists
  const hasComposite = existsSync(join(POKEPROXY_CACHE, `${cardId}_composite.png`));
  if (hasComposite) {
    return c.json({ cardId, status: "already_exists" });
  }

  // We need the source image in pokeproxy cache. Check if it's there.
  const srcExists = existsSync(join(POKEPROXY_CACHE, `${cardId}.png`));
  if (!srcExists) {
    // Try to download it first via TCGdex
    // The card ID format is like sv06.5-036, image URL is https://assets.tcgdex.net/en/{setId}/{localId}/high.png
    const parts = cardId.match(/^(.+)-(\d+)$/);
    if (!parts) return c.json({ error: "Invalid card ID format" }, 400);
    const [, setId, localId] = parts;
    const imageUrl = `https://assets.tcgdex.net/en/${setId}/${localId}/high.png`;
    try {
      const resp = await fetch(imageUrl, { headers: { "User-Agent": "DecklistGen/1.0" } });
      if (!resp.ok) return c.json({ error: "Failed to fetch source image" }, 500);
      const { writeFile, mkdir } = await import("node:fs/promises");
      await mkdir(POKEPROXY_CACHE, { recursive: true });
      await writeFile(join(POKEPROXY_CACHE, `${cardId}.png`), Buffer.from(await resp.arrayBuffer()));
    } catch (e: any) {
      return c.json({ error: `Failed to fetch source: ${e.message}` }, 500);
    }
  }

  // Spawn pokecleaner
  return new Promise<Response>((resolve) => {
    const proc = spawn("python3", [
      join(POKEPROXY_DIR, "pokecleaner.py"),
      cardId,
      "--server", FRAMEHOUSE_URL,
    ], { cwd: POKEPROXY_DIR });

    let output = "";
    proc.stdout.on("data", (d) => { output += d.toString(); });
    proc.stderr.on("data", (d) => { output += d.toString(); });

    proc.on("close", (code) => {
      const hasResult = existsSync(join(POKEPROXY_CACHE, `${cardId}_composite.png`));
      if (code === 0 && hasResult) {
        resolve(c.json({ cardId, status: "generated", output }));
      } else {
        resolve(c.json({ cardId, status: "failed", code, output }, 500));
      }
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      proc.kill();
      resolve(c.json({ cardId, status: "timeout" }, 504));
    }, 300_000);
  });
});

export default app;
