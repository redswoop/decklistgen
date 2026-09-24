import { describe, test, expect, beforeAll } from "bun:test";
import { Hono } from "hono";
import { writeFileSync, mkdirSync, existsSync, unlinkSync, utimesSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import proxyRouter from "./proxy.js";

const CACHE_DIR = join(import.meta.dir, "../../../cache");

const app = new Hono();
app.route("/pokeproxy", proxyRouter);

describe("GET /pokeproxy/image/:cardId/:type with ?w= thumbnail", () => {
  const THUMB_CARD_ID = "cel25-1";
  const COMPOSITE_SUFFIX = "_composite.png";

  beforeAll(async () => {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    // Create a 500x700 test PNG for the composite image
    const testPng = await sharp({
      create: { width: 500, height: 700, channels: 3, background: { r: 128, g: 128, b: 128 } },
    }).png().toBuffer();
    writeFileSync(join(CACHE_DIR, `${THUMB_CARD_ID}${COMPOSITE_SUFFIX}`), testPng);
  });

  test("serves full-res image without ?w param", async () => {
    const res = await app.request(`/pokeproxy/image/${THUMB_CARD_ID}/composite`);
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(500);
    expect(meta.height).toBe(700);
  });

  test("serves resized thumbnail with ?w=250", async () => {
    const thumbPath = join(CACHE_DIR, `${THUMB_CARD_ID}_composite_w250.png`);
    if (existsSync(thumbPath)) unlinkSync(thumbPath);

    const res = await app.request(`/pokeproxy/image/${THUMB_CARD_ID}/composite?w=250`);
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(250);
    expect(meta.height).toBe(350);
  });

  test("serves cached thumb on second request", async () => {
    await app.request(`/pokeproxy/image/${THUMB_CARD_ID}/composite?w=100`);
    const thumbPath = join(CACHE_DIR, `${THUMB_CARD_ID}_composite_w100.png`);
    expect(existsSync(thumbPath)).toBe(true);

    const res = await app.request(`/pokeproxy/image/${THUMB_CARD_ID}/composite?w=100`);
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(100);
  });

  test("regenerates thumb when source is newer", async () => {
    const thumbPath = join(CACHE_DIR, `${THUMB_CARD_ID}_composite_w150.png`);
    await app.request(`/pokeproxy/image/${THUMB_CARD_ID}/composite?w=150`);
    expect(existsSync(thumbPath)).toBe(true);

    const sourcePath = join(CACHE_DIR, `${THUMB_CARD_ID}${COMPOSITE_SUFFIX}`);
    const future = new Date(Date.now() + 10000);
    utimesSync(sourcePath, future, future);

    const res = await app.request(`/pokeproxy/image/${THUMB_CARD_ID}/composite?w=150`);
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(150);
  });

  test("clamps width to valid range", async () => {
    const res = await app.request(`/pokeproxy/image/${THUMB_CARD_ID}/composite?w=5`);
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(16); // clamped to min 16
  });
});

describe("GET /pokeproxy/image/:cardId/source fetches the original on a miss", () => {
  // cel25-2, not cel25-1: cards.test.ts overwrites cel25-1.json with a fixture
  // that has no image URL, and we need a real imageBase to resolve.
  const CARD_ID = "cel25-2";
  const srcPath = join(CACHE_DIR, `${CARD_ID}.png`);

  test("downloads from tcgdex once, caches, and serves same-origin", async () => {
    if (existsSync(srcPath)) unlinkSync(srcPath);
    const png = await sharp({
      create: { width: 20, height: 28, channels: 3, background: { r: 200, g: 10, b: 10 } },
    }).png().toBuffer();

    const realFetch = globalThis.fetch;
    let hits = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/high.png")) {
        hits++;
        return new Response(png, { status: 200, headers: { "Content-Type": "image/png" } });
      }
      return realFetch(input, init);
    }) as typeof fetch;
    try {
      const res = await app.request(`/pokeproxy/image/${CARD_ID}/source`);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
      const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
      expect(meta.width).toBe(20);
      expect(existsSync(srcPath)).toBe(true);

      const again = await app.request(`/pokeproxy/image/${CARD_ID}/source`);
      expect(again.status).toBe(200);
      expect(hits).toBe(1);
    } finally {
      globalThis.fetch = realFetch;
      if (existsSync(srcPath)) unlinkSync(srcPath);
    }
  });
});
