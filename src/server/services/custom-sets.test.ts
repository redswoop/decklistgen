import { describe, test, expect, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import {
  DEFAULT_CUSTOM_SETS_DIR,
  getCustomArtPath,
  getCustomCardRaw,
  getCustomSetCards,
  isCustomSet,
  listCustomSets,
  registerCustomSets,
} from "./custom-sets.js";
import { SET_MAP, SET_NAMES, REVERSE_SET_MAP, getEra } from "../../shared/constants/set-codes.js";
import { loadSet, getCard, findCardBySetAndNumber, isSetLoaded } from "./card-store.js";
import { getCardDetail } from "./card-detail.js";
import { getArtStatus } from "./card-generation.js";
import { resolveArtFile } from "./pokeproxy/cache.js";
import customSetsRouter from "../routes/custom-sets.js";
import proxyRouter from "../routes/proxy.js";

afterAll(() => {
  // Other test files share the module registry; leave it on the real sets.
  registerCustomSets(DEFAULT_CUSTOM_SETS_DIR);
});

describe("custom sets — the committed Feelings Deck", () => {
  test("registers FEEL in the shared set maps as a custom-era set", () => {
    expect(registerCustomSets(DEFAULT_CUSTOM_SETS_DIR)).toContain("FEEL");
    expect(SET_MAP.FEEL).toBe("custom-feel");
    expect(SET_NAMES.FEEL).toBe("Feelings Deck");
    expect(REVERSE_SET_MAP["custom-feel"]).toBe("FEEL");
    expect(getEra("custom-feel")).toBe("custom");
    expect(isCustomSet("feel")).toBe(true);
    expect(isCustomSet("SVI")).toBe(false);
  });

  test("lists the set with its card count", () => {
    const feel = listCustomSets().find((s) => s.code === "FEEL");
    expect(feel?.cards.length).toBe(8);
    expect(feel?.id).toBe("custom-feel");
  });

  test("shapes cards like TCGdex cards with ids, image base and set block filled in", () => {
    const cards = getCustomSetCards("FEEL");
    const kettlit = cards.find((c) => c.name === "Kettlit")!;
    expect(kettlit.id).toBe("custom-feel-001");
    expect(kettlit.image).toBe("/api/custom-sets/art/custom-feel-001");
    expect(kettlit.set).toEqual({ id: "custom-feel", name: "Feelings Deck", cardCount: { official: 8, total: 8 } });
    expect(kettlit.abilities?.[0]?.name).toBe("Everyone Else");
    expect(kettlit.attacks?.map((a) => a.name)).toEqual(["I'm getting mad."]);
    expect(getCustomCardRaw("custom-feel-001")).toBe(kettlit);
    expect(getCustomCardRaw("sv01-001")).toBeUndefined();
  });

  test("every card follows the two-line grammar: an 'Everyone Else' ability and one say-line attack", () => {
    // Mirrors the Feelings Deck page: the big line is what you're saying
    // (the attack), the small line is what everybody else does (the
    // ability), and every card closes with the one rule.
    for (const c of getCustomSetCards("FEEL")) {
      expect(c.abilities?.map((a) => a.name)).toEqual(["Everyone Else"]);
      expect(c.abilities?.[0]?.effect.length).toBeGreaterThan(0);
      expect(c.attacks?.length).toBe(1);
      expect(c.attacks?.[0]?.cost).toEqual([c.types?.[0]]);
      expect(c.attacks?.[0]?.name.length).toBeGreaterThan(0);
      expect(c.attacks?.[0]?.effect).toStartWith('When you get this card, say "OK."');
    }
  });

  test("every card has a committed artwork PNG", () => {
    for (const c of getCustomSetCards("FEEL")) {
      expect(getCustomArtPath(c.id)).toEndWith(`/feelings/art/${c.localId}.png`);
    }
    expect(getCustomArtPath("sv01-001")).toBeUndefined();
    expect(getCustomArtPath("custom-feel-999")).toBeUndefined();
  });
});

describe("custom sets — card store, detail and import resolution", () => {
  test("loadSet reads the cards from disk, never TCGdex", async () => {
    await loadSet("FEEL");
    expect(isSetLoaded("FEEL")).toBe(true);
    const card = getCard("custom-feel-007")!;
    expect(card.name).toBe("Haltadon");
    expect(card.era).toBe("custom");
    expect(card.setCode).toBe("FEEL");
    expect(card.setName).toBe("Feelings Deck");
    expect(card.energyTypes).toEqual(["Metal"]);
    expect(card.hp).toBe(100);
    expect(card.imageBase).toBe("/api/custom-sets/art/custom-feel-007");
  });

  test("a decklist line 'FEEL 7' resolves to the custom card", async () => {
    await loadSet("FEEL");
    expect(findCardBySetAndNumber("FEEL", "7")?.id).toBe("custom-feel-007");
    expect(findCardBySetAndNumber("feel", "007")?.id).toBe("custom-feel-007");
  });

  test("getCardDetail carries the ability and attacks without a cache JSON", async () => {
    const detail = await getCardDetail("custom-feel-006");
    expect(detail?.name).toBe("Shellter");
    expect(detail?.abilities[0]?.name).toBe("Everyone Else");
    expect(detail?.abilities[0]?.effect).toBe("Don't follow me. I'll come back.");
    expect(detail?.attacks.map((a) => a.name)).toEqual(["I need to be alone."]);
    expect(detail?.attacks[0]?.cost).toEqual(["Water"]);
    expect(detail?.attacks[0]?.damage).toBeUndefined();
    expect(detail?.retreat).toBe(0);
  });
});

describe("custom sets — artwork doubles as clean art", () => {
  const app = new Hono();
  app.route("/custom-sets", customSetsRouter);
  app.route("/pokeproxy", proxyRouter);

  test("resolveArtFile falls back to the custom PNG for source and clean only", () => {
    const art = getCustomArtPath("custom-feel-001");
    expect(resolveArtFile("custom-feel-001", ".png")).toBe(art);
    expect(resolveArtFile("custom-feel-001", "_clean.png")).toBe(art);
    expect(resolveArtFile("custom-feel-001", "_composite.png")).toBeUndefined();
  });

  test("art status reports hasClean so the proxy renderer uses it", () => {
    const status = getArtStatus("custom-feel-001");
    expect(status.hasClean).toBe(true);
    expect(status.hasComposite).toBe(false);
    expect(status.mtime).toBeGreaterThan(0);
  });

  test("GET /custom-sets lists the Feelings Deck", async () => {
    const res = await app.request("/custom-sets");
    expect(res.status).toBe(200);
    expect(await res.json()).toContainEqual({ code: "FEEL", id: "custom-feel", name: "Feelings Deck", cardCount: 8 });
  });

  test("GET /custom-sets/art/:id/<any>.png serves the artwork", async () => {
    for (const file of ["high.png", "low.png", "high.webp"]) {
      const res = await app.request(`/custom-sets/art/custom-feel-001/${file}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      const buf = Buffer.from(await res.arrayBuffer());
      expect(buf.subarray(1, 4).toString()).toBe("PNG");
    }
    expect((await app.request("/custom-sets/art/custom-feel-999/high.png")).status).toBe(404);
    expect((await app.request("/custom-sets/art/..%2Fx/high.png")).status).toBe(400);
  });

  test("GET /pokeproxy/image/:id/clean and /source serve the custom PNG", async () => {
    for (const type of ["clean", "source"]) {
      const res = await app.request(`/pokeproxy/image/custom-feel-002/${type}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
    }
    expect((await app.request("/pokeproxy/image/custom-feel-002/composite")).status).toBe(404);
  });
});

describe("custom sets — discovery and validation", () => {
  function fixtureDir(files: Record<string, unknown>): string {
    const dir = mkdtempSync(join(tmpdir(), "custom-sets-"));
    for (const [folder, body] of Object.entries(files)) {
      mkdirSync(join(dir, folder, "art"), { recursive: true });
      writeFileSync(join(dir, folder, "set.json"), typeof body === "string" ? body : JSON.stringify(body));
    }
    return dir;
  }

  test("registers valid sets, skips broken ones, and never shadows a TCGdex code", () => {
    const dir = fixtureDir({
      good: { code: "HOUS", id: "custom-house", name: "House Cards", cards: [{ localId: "1", name: "Mop", category: "Pokemon" }] },
      noprefix: { code: "NOPE", id: "nope", name: "Bad id", cards: [] },
      clash: { code: "SVI", id: "custom-svi", name: "Clash", cards: [] },
      garbage: "{not json",
    });
    const warn = console.warn;
    console.warn = () => {};
    try {
      expect(registerCustomSets(dir)).toEqual(["HOUS"]);
    } finally {
      console.warn = warn;
    }
    expect(SET_MAP.HOUS).toBe("custom-house");
    expect(SET_MAP.SVI).toBe("sv01");
    expect(SET_MAP.NOPE).toBeUndefined();
    expect(getCustomSetCards("HOUS")[0]?.id).toBe("custom-house-1");
    // No PNG in art/ yet → no art path, so status falls back to "no clean art".
    expect(getCustomArtPath("custom-house-1")).toBeUndefined();
    // The previous registry (FEEL) is gone until re-registered.
    expect(SET_MAP.FEEL).toBeUndefined();
  });

  test("a missing directory registers nothing", () => {
    expect(registerCustomSets(join(tmpdir(), "does-not-exist-" + Date.now()))).toEqual([]);
  });

  test("re-registering the real directory restores the Feelings Deck", () => {
    expect(registerCustomSets(DEFAULT_CUSTOM_SETS_DIR)).toContain("FEEL");
    expect(SET_MAP.FEEL).toBe("custom-feel");
  });
});
