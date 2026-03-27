import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import { Hono } from "hono";
import { writeFileSync, mkdirSync, existsSync, unlinkSync, utimesSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import proxyRouter from "./proxy.js";
import { loadSet } from "../services/card-store.js";
import { resetIconIds } from "../services/pokeproxy/type-icons.js";

const CACHE_DIR = join(import.meta.dir, "../../../cache");

const MOCK_CARD_ID = "cel25-1";
const MOCK_CARD_JSON = {
  id: "cel25-1",
  localId: "1",
  name: "Ho-Oh",
  category: "Pokemon",
  hp: 130,
  types: ["Fire"],
  stage: "Basic",
  retreat: 2,
  rarity: "Rare",
  set: { id: "cel25", name: "Celebrations" },
  attacks: [
    { cost: ["Fire", "Colorless"], name: "Sacred Fire", effect: "This attack does 50 damage." },
    { cost: ["Fire", "Fire", "Colorless"], name: "Fire Blast", effect: "Discard an Energy.", damage: 120 },
  ],
  weaknesses: [{ type: "Lightning", value: "×2" }],
};

// Tiny 1x1 white PNG
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "base64"
);

const app = new Hono();
app.route("/pokeproxy", proxyRouter);

describe("GET /pokeproxy/svg/:cardId with query params", () => {
  beforeAll(async () => {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(join(CACHE_DIR, `${MOCK_CARD_ID}.json`), JSON.stringify(MOCK_CARD_JSON));
    writeFileSync(join(CACHE_DIR, `${MOCK_CARD_ID}.png`), TINY_PNG);
    await loadSet("CEL");
  });

  beforeEach(() => resetIconIds());

  test("renders SVG without query params", async () => {
    const res = await app.request(`/pokeproxy/svg/${MOCK_CARD_ID}`);
    expect(res.status).toBe(200);
    const svg = await res.text();
    expect(svg).toStartWith("<svg");
    expect(svg).toContain("Ho-Oh");
  });

  test("renders SVG with fontSize param", async () => {
    const res = await app.request(`/pokeproxy/svg/${MOCK_CARD_ID}?fontSize=28`);
    expect(res.status).toBe(200);
    const svg = await res.text();
    expect(svg).toStartWith("<svg");
    expect(svg).toContain("Ho-Oh");
  });

  test("unknown query params do not break rendering", async () => {
    const res = await app.request(`/pokeproxy/svg/${MOCK_CARD_ID}?fontSize=24`);
    expect(res.status).toBe(200);
    const svg = await res.text();
    expect(svg).toStartWith("<svg");
  });

  test("renders SVG with maxCover param", async () => {
    // maxCover only affects fullart, but should not error on standard
    const res = await app.request(`/pokeproxy/svg/${MOCK_CARD_ID}?maxCover=0.4`);
    expect(res.status).toBe(200);
    const svg = await res.text();
    expect(svg).toStartWith("<svg");
  });
});

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
    // Clean up any existing thumb
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
    // First request generates the thumb
    await app.request(`/pokeproxy/image/${THUMB_CARD_ID}/composite?w=100`);
    const thumbPath = join(CACHE_DIR, `${THUMB_CARD_ID}_composite_w100.png`);
    expect(existsSync(thumbPath)).toBe(true);

    // Second request should still work (serves from cache)
    const res = await app.request(`/pokeproxy/image/${THUMB_CARD_ID}/composite?w=100`);
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(100);
  });

  test("regenerates thumb when source is newer", async () => {
    // Create thumb first
    const thumbPath = join(CACHE_DIR, `${THUMB_CARD_ID}_composite_w150.png`);
    await app.request(`/pokeproxy/image/${THUMB_CARD_ID}/composite?w=150`);
    expect(existsSync(thumbPath)).toBe(true);

    // Touch the source file to make it newer
    const sourcePath = join(CACHE_DIR, `${THUMB_CARD_ID}${COMPOSITE_SUFFIX}`);
    const future = new Date(Date.now() + 10000);
    utimesSync(sourcePath, future, future);

    // Request should regenerate
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
