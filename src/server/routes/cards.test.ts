import { describe, test, expect, beforeAll } from "bun:test";
import { Hono } from "hono";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import cardsRouter from "./cards.js";
import { loadSet } from "../services/card-store.js";

const CACHE_DIR = join(import.meta.dir, "../../../cache");

// Mock card data in cache
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
  resistances: [{ type: "Fighting", value: "-30" }],
  description: "It will reveal itself before a pure-hearted Trainer.",
};

const app = new Hono();
app.route("/cards", cardsRouter);

describe("GET /cards/:id/detail", () => {
  beforeAll(async () => {
    // Ensure cache dir exists and write mock JSON
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(join(CACHE_DIR, `${MOCK_CARD_ID}.json`), JSON.stringify(MOCK_CARD_JSON));
    // Load the set so card-store knows about this card
    await loadSet("CEL");
  });

  test("returns 404 for unknown card", async () => {
    const res = await app.request("/cards/nonexistent-999/detail");
    expect(res.status).toBe(404);
  });

  test("returns CardDetail with attacks and abilities", async () => {
    const res = await app.request(`/cards/${MOCK_CARD_ID}/detail`);
    expect(res.status).toBe(200);

    const detail = await res.json();
    expect(detail.id).toBe(MOCK_CARD_ID);
    expect(detail.name).toBe("Ho-Oh");

    // Attacks
    expect(detail.attacks).toHaveLength(2);
    expect(detail.attacks[0].name).toBe("Sacred Fire");
    expect(detail.attacks[0].cost).toEqual(["Fire", "Colorless"]);
    expect(detail.attacks[1].damage).toBe("120");

    // Weaknesses
    expect(detail.weaknesses).toHaveLength(1);
    expect(detail.weaknesses[0].type).toBe("Lightning");
    expect(detail.weaknesses[0].value).toBe("×2");

    // Resistances
    expect(detail.resistances).toHaveLength(1);
    expect(detail.resistances[0].type).toBe("Fighting");

    // Description
    expect(detail.description).toContain("pure-hearted");
  });

  test("returns Card fields alongside detail fields", async () => {
    const res = await app.request(`/cards/${MOCK_CARD_ID}/detail`);
    const detail = await res.json();

    // Standard Card fields should be present
    expect(detail.setCode).toBeDefined();
    expect(detail.category).toBe("Pokemon");
    expect(detail.hp).toBe(130);
    expect(detail.imageBase).toBeDefined();
  });
});
