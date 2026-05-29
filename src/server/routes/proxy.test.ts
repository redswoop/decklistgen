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
