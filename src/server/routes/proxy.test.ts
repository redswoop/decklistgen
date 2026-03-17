import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import { Hono } from "hono";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
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
